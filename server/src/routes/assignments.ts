import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthUser, requirePermission } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, notFound, unauthenticated, zodDetails } from "../lib/errors";

export const assignments = new Hono();

// Helpers
async function getRequiredCount(assessmentId: string): Promise<number> {
  return prisma.question.count({ where: { assessmentId, isRequired: true, type: "SINGLE_SELECT" } });
}

async function getProgress(assignmentId: string, assessmentId: string) {
  const required = await getRequiredCount(assessmentId);
  const answered = await prisma.response.count({ where: { assignmentId } });
  return { answered, required };
}

async function ensureActiveAssignment(userId: string, assessmentId: string): Promise<typeof prisma.assessmentAssignment extends never ? never : unknown> {
  // Find active (ASSIGNED/IN_PROGRESS)
  const active = await prisma.assessmentAssignment.findFirst({
    where: { assessmentId, userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
  });
  if (active) return active as never;
  // Create new
  const max = await prisma.assessmentAssignment.findMany({
    where: { assessmentId, userId },
    orderBy: { attempt: "desc" },
    take: 1,
    select: { attempt: true },
  });
  const attempt = (max[0]?.attempt ?? 0) + 1;
  return (await prisma.assessmentAssignment.create({
    data: { assessmentId, userId, status: "ASSIGNED", attempt, assignedBy: null },
  })) as never;
}

// GET /api/my-assessments and GET /api/assignments (list own)
async function handleMyAssessments(c: import("hono").Context) {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const url = new URL(c.req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const where = { userId: user.id };
  const [total, data] = await Promise.all([
    prisma.assessmentAssignment.count({ where }),
    prisma.assessmentAssignment.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { assessment: { select: { id: true, title: true, status: true } } },
    }),
  ]);
  // attach progress
  const withProgress = await Promise.all(
    data.map(async (a: any) => {
      const progress = await getProgress(a.id, a.assessmentId);
      return { ...a, progress };
    }),
  );
  return c.json({ data: withProgress, page, pageSize, total });
}

assignments.get("/my-assessments", async (c) => handleMyAssessments(c));
assignments.get("/assignments", async (c) => handleMyAssessments(c));

// GET /api/assignments/:id — detail + drafts
assignments.get("/assignments/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const id = c.req.param("id");
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { id },
    include: { assessment: true },
  });
  if (!assignment) return notFound(c);
  const isOwner = assignment.userId === user.id;
  const isAdmin = user.permissions.includes("assignments.manage");
  if (!isOwner && !isAdmin) return notFound(c);

  const questions = await prisma.question.findMany({
    where: { assessmentId: assignment.assessmentId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
  const sanitized = !isAdmin
    ? questions.map((q: any) => ({ ...q, options: q.options.map((o: any) => ({ id: o.id, label: o.label, optionText: o.optionText, order: o.order })) }))
    : questions;

  const [responses, textAnswers] = await Promise.all([
    prisma.response.findMany({ where: { assignmentId: id } }),
    prisma.textAnswer.findMany({ where: { assignmentId: id } }),
  ]);

  return c.json({ assignment, questions: sanitized, drafts: { responses, textAnswers } });
});

// POST /api/assessments/:id/start or POST /api/assignments/:id/start (self-serve auto-create)
async function handleStart(c: import("hono").Context, assessmentIdParam?: string) {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (!user.permissions.includes("assignments.self.respond") && !user.permissions.includes("assignments.manage")) {
    // also allow self.respond implicitly
    const hasSelf = user.permissions.includes("assignments.self.respond");
    if (!hasSelf) return notFound(c);
  }
  let assessmentId: string | null = null;
  let assignmentId: string | null = null;
  const id = c.req.param("id");
  if (assessmentIdParam) assessmentId = assessmentIdParam;
  else if (id) {
    // try assignment first
    const existing = await prisma.assessmentAssignment.findUnique({ where: { id } });
    if (existing) {
      assignmentId = id;
      assessmentId = existing.assessmentId;
      if (existing.userId !== user.id && !user.permissions.includes("assignments.manage")) return notFound(c);
      // check status
      if (existing.status === "SUBMITTED") return conflict(c, "already submitted");
      if (existing.status === "EXPIRED") return conflict(c, "assignment expired");
      const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
      if (!assessment || assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
      if (existing.dueAt && new Date(existing.dueAt) < new Date()) return conflict(c, "assignment expired");
      if (existing.status === "IN_PROGRESS") return c.json({ assignment: existing });
      const updated = await prisma.assessmentAssignment.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: existing.startedAt ?? new Date() } });
      await audit({ actorId: user.id, action: "assignments.start", entity: "assignment", entityId: id });
      return c.json({ assignment: updated });
    } else {
      // treat as assessmentId
      assessmentId = id;
    }
  }
  if (!assessmentId) return badRequest(c, "assessmentId required");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return notFound(c);
  if (assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
  // check due? no due on auto-create
  const assignment = (await ensureActiveAssignment(user.id, assessmentId)) as any;
  if (assignment.status === "SUBMITTED") return conflict(c, "already submitted");
  if (assignment.status === "EXPIRED") return conflict(c, "assignment expired");
  if (assignment.status === "ASSIGNED") {
    const updated = await prisma.assessmentAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    await audit({ actorId: user.id, action: "assignments.start", entity: "assignment", entityId: updated.id });
    return c.json({ assignment: updated });
  }
  return c.json({ assignment });
}

assignments.post("/assessments/:id/start", async (c) => handleStart(c, c.req.param("id")));
assignments.post("/assignments/:id/start", async (c) => handleStart(c));

// PUT /api/assignments/:id/responses — autosave drafts (partial) with auto-create alias
const responsesSchema = z.object({
  responses: z.array(z.object({ questionId: z.string().uuid(), questionOptionId: z.string().uuid() })).optional(),
  textAnswers: z.array(z.object({ questionId: z.string().uuid(), slotIndex: z.number().int().min(0), answerText: z.string().max(5000).nullable().optional() })).optional(),
});

async function handlePutResponses(c: import("hono").Context) {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const id = c.req.param("id");
  const parsed = responsesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));

  // Resolve assignment (or auto-create if id is assessmentId)
  let assignment: any = await prisma.assessmentAssignment.findUnique({ where: { id } });
  if (!assignment) {
    // treat id as assessmentId for self-serve PUT /assessments/:id/responses alias
    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) return notFound(c);
    if (assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
    assignment = (await ensureActiveAssignment(user.id, id as string)) as any;
    // if was ASSIGNED, move to IN_PROGRESS
    if (assignment.status === "ASSIGNED") {
      assignment = await prisma.assessmentAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
    }
  }
  if (assignment.userId !== user.id && !user.permissions.includes("assignments.manage")) return notFound(c);
  if (assignment.status === "SUBMITTED" || assignment.status === "EXPIRED") return conflict(c, "assignment already submitted or expired");
  const assessment: any = await prisma.assessment.findUnique({ where: { id: assignment.assessmentId } });
  if (!assessment || assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
  if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) return conflict(c, "assignment expired");

  let saved = 0;
  if (parsed.data.responses) {
    for (const r of parsed.data.responses) {
      const question = await prisma.question.findUnique({ where: { id: r.questionId } });
      if (!question || question.assessmentId !== assignment.assessmentId) return badRequest(c, `question ${r.questionId} not in assessment`);
      if (question.type !== "SINGLE_SELECT") return badRequest(c, `question ${r.questionId} is not SINGLE_SELECT`);
      const option = await prisma.questionOption.findUnique({ where: { id: r.questionOptionId } });
      if (!option || option.questionId !== r.questionId) return badRequest(c, `option ${r.questionOptionId} not in question`);
      await prisma.response.upsert({
        where: { assignmentId_questionId: { assignmentId: assignment.id, questionId: r.questionId } },
        update: { questionOptionId: option.id, scoreValue: option.scoreValue },
        create: { assignmentId: assignment.id, questionId: r.questionId, questionOptionId: option.id, scoreValue: option.scoreValue },
      });
      saved++;
    }
  }
  if (parsed.data.textAnswers) {
    for (const t of parsed.data.textAnswers) {
      const question = await prisma.question.findUnique({ where: { id: t.questionId } });
      if (!question || question.assessmentId !== assignment.assessmentId) return badRequest(c, `question ${t.questionId} not in assessment`);
      if (question.type !== "TEXT_MULTI_SLOT") return badRequest(c, `question ${t.questionId} is not TEXT_MULTI_SLOT`);
      if (t.slotIndex >= (question.slotCount ?? 4)) return badRequest(c, `slotIndex ${t.slotIndex} out of range`);
      await prisma.textAnswer.upsert({
        where: { assignmentId_questionId_slotIndex: { assignmentId: assignment.id, questionId: t.questionId, slotIndex: t.slotIndex } },
        update: { answerText: t.answerText ?? null },
        create: { assignmentId: assignment.id, questionId: t.questionId, slotIndex: t.slotIndex, answerText: t.answerText ?? null },
      });
      saved++;
    }
  }

  const progress = await getProgress(assignment.id, assignment.assessmentId);
  // touch assignment
  await prisma.assessmentAssignment.update({ where: { id: assignment.id }, data: { updatedAt: new Date() } });
  return c.json({ saved, progress });
}

assignments.put("/assignments/:id/responses", async (c) => handlePutResponses(c));
assignments.put("/assessments/:id/responses", async (c) => {
  // alias where :id is assessmentId
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const assessmentId = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return notFound(c);
  if (assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
  let assignment: any = await prisma.assessmentAssignment.findFirst({ where: { assessmentId, userId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } });
  if (!assignment) assignment = (await ensureActiveAssignment(user.id, assessmentId)) as any;
  if (assignment.status === "ASSIGNED") assignment = await prisma.assessmentAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  // delegate to same logic but with assignment id
  const parsed = responsesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  // reuse handle but we have assignment
  let saved = 0;
  if (parsed.data.responses) {
    for (const r of parsed.data.responses) {
      const question = await prisma.question.findUnique({ where: { id: r.questionId } });
      if (!question || question.assessmentId !== assignment.assessmentId) return badRequest(c, `question ${r.questionId} not in assessment`);
      const option = await prisma.questionOption.findUnique({ where: { id: r.questionOptionId } });
      if (!option || option.questionId !== r.questionId) return badRequest(c, `option ${r.questionOptionId} not in question`);
      await prisma.response.upsert({
        where: { assignmentId_questionId: { assignmentId: assignment.id, questionId: r.questionId } },
        update: { questionOptionId: option.id, scoreValue: option.scoreValue },
        create: { assignmentId: assignment.id, questionId: r.questionId, questionOptionId: option.id, scoreValue: option.scoreValue },
      });
      saved++;
    }
  }
  if (parsed.data.textAnswers) {
    for (const t of parsed.data.textAnswers) {
      const question = await prisma.question.findUnique({ where: { id: t.questionId } });
      if (!question || question.assessmentId !== assignment.assessmentId) return badRequest(c, `question ${t.questionId} not in assessment`);
      if (t.slotIndex >= (question.slotCount ?? 4)) return badRequest(c, `slotIndex out of range`);
      await prisma.textAnswer.upsert({
        where: { assignmentId_questionId_slotIndex: { assignmentId: assignment.id, questionId: t.questionId, slotIndex: t.slotIndex } },
        update: { answerText: t.answerText ?? null },
        create: { assignmentId: assignment.id, questionId: t.questionId, slotIndex: t.slotIndex, answerText: t.answerText ?? null },
      });
      saved++;
    }
  }
  const progress = await getProgress(assignment.id, assignment.assessmentId);
  return c.json({ saved, progress, assignmentId: assignment.id });
});

// POST /api/assessments/:id/assign — optional admin bulk assign
const assignSchema = z.object({ userIds: z.array(z.string().uuid()).optional(), assignAllActive: z.boolean().optional(), dueAt: z.string().datetime().optional().nullable() });
assignments.post("/assessments/:id/assign", requirePermission("assignments.manage"), async (c) => {
  const assessmentId = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return notFound(c);
  if (assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
  const parsed = assignSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  let userIds: string[] = parsed.data.userIds ?? [];
  if (parsed.data.assignAllActive) {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    userIds = users.map((u) => u.id);
  }
  if (userIds.length === 0) return badRequest(c, "userIds required or assignAllActive");
  let created = 0, skipped = 0;
  for (const userId of userIds) {
    const existing = await prisma.assessmentAssignment.findFirst({ where: { assessmentId, userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } });
    if (existing) { skipped++; continue; }
    const max = await prisma.assessmentAssignment.findMany({ where: { assessmentId, userId }, orderBy: { attempt: "desc" }, take: 1, select: { attempt: true } });
    const attempt = (max[0]?.attempt ?? 0) + 1;
    await prisma.assessmentAssignment.create({ data: { assessmentId, userId, status: "ASSIGNED", attempt, dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null, assignedBy: c.get("user").id } });
    created++;
  }
  await audit({ actorId: c.get("user").id, action: "assignments.bulk_assign", entity: "assessment", entityId: assessmentId, metadata: { created, skipped } });
  return c.json({ created, skipped });
});
