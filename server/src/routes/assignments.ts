// Assignment taking-flow endpoints (thin HTTP layer).
// Business logic lives in services/assignments.service.ts — this module only
// validates requests, checks authZ, calls the service, and formats responses.
import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthUser, requirePermission } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, forbidden, notFound, unauthenticated, zodDetails } from "../lib/errors";
import { parsePagination } from "../lib/pagination";
import {
  ServiceError,
  getProgress,
  getRetakeStatus,
  resolveAssignment,
  startByAssessment,
  startByAssignment,
  saveResponses,
  clearResponses,
  submitAssignment,
} from "../services/assignments.service";
import { rateLimit } from "../lib/rate-limit";

export const assignments = new Hono();

function serviceError(c: import("hono").Context, e: unknown) {
  if (e instanceof ServiceError) {
    if (e.status === 400) return badRequest(c, e.details);
    if (e.status === 404) return notFound(c);
    return conflict(c, e.details);
  }
  throw e;
}

function canRespond(user: { permissions: string[] }): boolean {
  return user.permissions.includes("assignments.self.respond") || user.permissions.includes("assignments.manage");
}
function isAdminRole(user: { roleCode: string }): boolean {
  return user.roleCode === "ADMIN";
}

// GET /api/my-assessments and GET /api/assignments (list own)
async function handleMyAssessments(c: import("hono").Context) {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const { page, pageSize, skip } = parsePagination(new URL(c.req.url));
  const where = { userId: user.id };
  const [total, data] = await Promise.all([
    prisma.assessmentAssignment.count({ where }),
    prisma.assessmentAssignment.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      include: { assessment: { select: { id: true, title: true, status: true } } },
    }),
  ]);
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

// GET /api/assessments/:id/eligibility — 45-day retake status for self-serve gateway
assignments.get("/assessments/:id/eligibility", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  if (!canRespond(user)) return notFound(c);
  const assessmentId = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return notFound(c);
  if (assessment.status !== "PUBLISHED") return conflict(c, "assessment not published");
  const active = await prisma.assessmentAssignment.findFirst({
    where: { assessmentId, userId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    select: { id: true, status: true },
  });
  if (active) return c.json({ eligible: true, hasActive: true, assignmentId: active.id, status: active.status });
  const status = await getRetakeStatus(user.id, assessmentId);
  return c.json({ ...status, hasActive: false });
});

// POST /api/assessments/:id/start (self-serve auto-create)
assignments.post("/assessments/:id/start", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  if (!canRespond(user)) return notFound(c);
  const assessmentId = c.req.param("id");
  try {
    const assignment = await startByAssessment(user.id, assessmentId);
    await audit({ actorId: user.id, action: "assignments.start", entity: "assignment", entityId: assignment.id });
    return c.json({ assignment });
  } catch (e) {
    return serviceError(c, e);
  }
});

// POST /api/assignments/:id/start (id may be an assignment id or an assessment id)
assignments.post("/assignments/:id/start", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  if (!canRespond(user)) return notFound(c);
  const id = c.req.param("id");
  try {
    const existing = await prisma.assessmentAssignment.findUnique({ where: { id } });
    if (existing) {
      const assignment = await startByAssignment(user.id, id, user.permissions.includes("assignments.manage"));
      // Original behavior: no audit row when already IN_PROGRESS.
      if (existing.status !== "IN_PROGRESS") {
        await audit({ actorId: user.id, action: "assignments.start", entity: "assignment", entityId: assignment.id });
      }
      return c.json({ assignment });
    }
    const before = await prisma.assessmentAssignment.findFirst({
      where: { assessmentId: id, userId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    });
    const assignment = await startByAssessment(user.id, id);
    if (!before || before.status !== "IN_PROGRESS") {
      await audit({ actorId: user.id, action: "assignments.start", entity: "assignment", entityId: assignment.id });
    }
    return c.json({ assignment });
  } catch (e) {
    return serviceError(c, e);
  }
});

// PUT /api/assignments/:id/responses — autosave drafts (partial) with auto-create alias
const responsesSchema = z.object({
  responses: z.array(z.object({ questionId: z.string().min(1), questionOptionId: z.string().min(1) })).optional(),
  textAnswers: z.array(z.object({ questionId: z.string().min(1), slotIndex: z.number().int().min(0), answerText: z.string().max(5000).nullable().optional() })).optional(),
});

assignments.put("/assignments/:id/responses", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  const id = c.req.param("id");
  const parsed = responsesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  try {
    const { assignment } = await resolveAssignment({
      id,
      userId: user.id,
      isManager: user.permissions.includes("assignments.manage"),
    });
    const { saved, progress } = await saveResponses(assignment.id, parsed.data);
    return c.json({ saved, progress });
  } catch (e) {
    return serviceError(c, e);
  }
});

// DELETE /api/assignments/:id/responses — clear drafts (reset progress to 0)
assignments.delete("/assignments/:id/responses", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  const id = c.req.param("id");
  const assignment = await prisma.assessmentAssignment.findUnique({ where: { id } });
  if (!assignment) return notFound(c);
  if (assignment.userId !== user.id && !user.permissions.includes("assignments.manage")) return notFound(c);
  try {
    const { progress } = await clearResponses(id);
    return c.json({ cleared: true, progress });
  } catch (e) {
    return serviceError(c, e);
  }
});

assignments.put("/assessments/:id/responses", async (c) => {
  // alias where :id is assessmentId — delegates through same resolution path as
  // PUT /assignments/:id/responses to keep save logic single-sourced.
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  const assessmentId = c.req.param("id");
  const parsed = responsesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  try {
    const { assignment } = await resolveAssignment({ id: assessmentId, userId: user.id, isManager: false });
    const { saved, progress } = await saveResponses(assignment.id, parsed.data);
    return c.json({ saved, progress, assignmentId: assignment.id });
  } catch (e) {
    return serviceError(c, e);
  }
});

// POST /api/assessments/:id/assign — disabled in single-assessment self-serve mode
assignments.post("/assessments/:id/assign", rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "assign" }), requirePermission("assignments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Bulk assign disabled — self-serve single assessment only" }, 410);
});

// POST /api/assignments/:id/submit — validate → scoring transaction
assignments.post("/assignments/:id/submit", rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "submit" }), async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  const id = c.req.param("id");
  const assignment = await prisma.assessmentAssignment.findUnique({ where: { id } });
  if (!assignment) return notFound(c);
  if (assignment.userId !== user.id && !user.permissions.includes("assignments.manage")) return notFound(c);
  try {
    const outcome = await submitAssignment(id, { idempotencyKey: c.req.header("Idempotency-Key") });
    await audit({ actorId: user.id, action: "assignments.submit", entity: "assignment", entityId: id });
    if (outcome.idempotent) {
      return c.json(
        {
          resultId: outcome.resultId,
          overallSelf: outcome.overallSelf,
          overallOrg: outcome.overallOrg,
          overallCombined: outcome.overallCombined,
          idempotent: true,
        },
        200,
      );
    }
    return c.json(
      {
        resultId: outcome.resultId,
        overallSelf: outcome.overallSelf,
        overallOrg: outcome.overallOrg,
        overallCombined: outcome.overallCombined,
        minCategoryScore: outcome.minCategoryScore,
        maxCategoryScore: outcome.maxCategoryScore,
      },
      201,
    );
  } catch (e) {
    return serviceError(c, e);
  }
});

// Alias POST /api/assessments/:id/submit (self-serve, find active assignment)
assignments.post("/assessments/:id/submit", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (isAdminRole(user)) return forbidden(c);
  const assessmentId = c.req.param("id");
  const assignment = await prisma.assessmentAssignment.findFirst({
    where: { assessmentId, userId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
  });
  if (!assignment) return badRequest(c, "no active assignment — start assessment first");
  try {
    const outcome = await submitAssignment(assignment.id, { idempotencyKey: c.req.header("Idempotency-Key") });
    await audit({ actorId: user.id, action: "assignments.submit", entity: "assignment", entityId: assignment.id });
    if (outcome.idempotent) return c.json({ resultId: outcome.resultId, idempotent: true }, 200);
    return c.json(
      {
        resultId: outcome.resultId,
        overallSelf: outcome.overallSelf,
        overallOrg: outcome.overallOrg,
        overallCombined: outcome.overallCombined,
        minCategoryScore: outcome.minCategoryScore,
        maxCategoryScore: outcome.maxCategoryScore,
      },
      201,
    );
  } catch (e) {
    return serviceError(c, e);
  }
});
