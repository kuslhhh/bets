import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthUser, requirePermission } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, notFound, unauthenticated, zodDetails } from "../lib/errors";

export const questions = new Hono();

// Helpers
async function isPublishedAssessment(assessmentId: string): Promise<boolean> {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId }, select: { status: true } });
  return a?.status === "PUBLISHED";
}

async function hasResponses(questionId: string): Promise<boolean> {
  const count = await prisma.response.count({ where: { questionId } });
  if (count > 0) return true;
  const textCount = await prisma.textAnswer.count({ where: { questionId } });
  return textCount > 0;
}



// POST /api/questions — create question + options
const createQuestionSchema = z.object({
  assessmentId: z.string().uuid(),
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  type: z.enum(["SINGLE_SELECT", "TEXT_MULTI_SLOT"]),
  promptText: z.string().min(1).max(5000),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  slotCount: z.number().int().min(1).max(10).optional().nullable(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(10),
        optionText: z.string().min(1).max(2000),
        scoreValue: z.number().int().refine((v) => [25, 50, 75, 100].includes(v), { message: "score must be 25,50,75,100" }),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

questions.post("/", requirePermission("questions.manage"), async (c) => {
  const parsed = createQuestionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));

  const { assessmentId, sectionId, categoryId, type, promptText, order, isRequired, slotCount, options } = parsed.data;

  if (await isPublishedAssessment(assessmentId)) return conflict(c, "assessment is PUBLISHED — structural changes frozen (create new assessment)");

  // Validate section belongs to assessment
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section || section.assessmentId !== assessmentId) return badRequest(c, "section does not belong to assessment");
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat || cat.sectionId !== sectionId) return badRequest(c, "category does not belong to section");
  }

  if (type === "SINGLE_SELECT") {
    if (!options || options.length < 2) return badRequest(c, "SINGLE_SELECT requires at least 2 options");
  }
  if (type === "TEXT_MULTI_SLOT" && options && options.length > 0) return badRequest(c, "TEXT_MULTI_SLOT must not have options");

  const maxOrder = await prisma.question.count({ where: { assessmentId, sectionId } });
  const finalOrder = order ?? maxOrder + 1;

  const user = c.get("user");
  const question = await prisma.question.create({
    data: {
      assessmentId,
      sectionId,
      categoryId: categoryId ?? null,
      type,
      promptText,
      order: finalOrder,
      isRequired: isRequired ?? (type === "SINGLE_SELECT"),
      slotCount: type === "TEXT_MULTI_SLOT" ? (slotCount ?? 4) : null,
      status: "DRAFT",
      createdBy: user.id,
      options: type === "SINGLE_SELECT" && options ? { create: options.map((o) => ({ label: o.label, optionText: o.optionText, scoreValue: o.scoreValue, order: o.order })) } : undefined,
    },
    include: { options: true },
  });

  await audit({ actorId: user.id, action: "questions.create", entity: "question", entityId: question.id });
  return c.json({ question }, 201);
});

// GET /api/questions/:id
questions.get("/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const id = c.req.param("id");
  const q = await prisma.question.findUnique({ where: { id }, include: { options: { orderBy: { order: "asc" } }, category: true, section: true } });
  if (!q) return notFound(c);
  const isAdmin = user.permissions.includes("questions.manage");
  if (!isAdmin) {
    const assessment = await prisma.assessment.findUnique({ where: { id: q.assessmentId }, select: { status: true } });
    if (assessment?.status !== "PUBLISHED") return notFound(c);
    // strip scores
    const sanitized = { ...q, options: q.options.map((o) => ({ id: o.id, label: o.label, optionText: o.optionText, order: o.order })) };
    return c.json({ question: sanitized });
  }
  const hasResp = await hasResponses(id);
  return c.json({ question: q, hasResponses: hasResp });
});

// PATCH /api/questions/:id — direct edit with frozen guard
const patchQuestionSchema = z.object({
  promptText: z.string().min(1).max(5000).optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  slotCount: z.number().int().min(1).max(10).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
  // options full replace if provided
  options: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(10),
        optionText: z.string().min(1).max(2000),
        scoreValue: z.number().int().refine((v) => [25, 50, 75, 100].includes(v)),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
  categoryId: z.string().uuid().optional().nullable(),
});

questions.patch("/:id", requirePermission("questions.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = patchQuestionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));

  const existing = await prisma.question.findUnique({ where: { id }, include: { options: true } });
  if (!existing) return notFound(c);

  const isPublished = await isPublishedAssessment(existing.assessmentId);
  const hasResp = await hasResponses(id);

  // Frozen checks: on PUBLISHED, structural changes not allowed
  if (isPublished) {
    const wantsTypeChange = false; // type not in patch schema, so not allowed anyway
    const wantsOptionsChange = parsed.data.options !== undefined;
    const wantsCategoryChange = parsed.data.categoryId !== undefined && parsed.data.categoryId !== existing.categoryId;
    if (wantsOptionsChange || wantsCategoryChange) {
      return conflict(c, "assessment is PUBLISHED — structural add/remove/retype frozen");
    }
    if (parsed.data.slotCount !== undefined && parsed.data.slotCount !== existing.slotCount) {
      return conflict(c, "assessment is PUBLISHED — slotCount frozen");
    }
  }

  // If options provided, check score permission
  if (parsed.data.options) {
    const user = c.get("user");
    const canManageScores = user.permissions.includes("questions.scores.manage");
    const scoreChanged = parsed.data.options.some((o) => {
      const existingOpt = existing.options.find((eo) => eo.id === o.id || eo.label === o.label);
      return existingOpt && existingOpt.scoreValue !== o.scoreValue;
    });
    // Also new options imply scores
    if (scoreChanged && !canManageScores) return conflict(c, "questions.scores.manage required to change scores");
  }

  const user = c.get("user");
  const updateData: Record<string, unknown> = {};
  if (parsed.data.promptText !== undefined) updateData.promptText = parsed.data.promptText;
  if (parsed.data.order !== undefined) updateData.order = parsed.data.order;
  if (parsed.data.isRequired !== undefined) updateData.isRequired = parsed.data.isRequired;
  if (parsed.data.slotCount !== undefined) updateData.slotCount = parsed.data.slotCount;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;

  let updated;
  if (parsed.data.options !== undefined) {
    // Replace options: delete missing, upsert provided
    const incoming = parsed.data.options;
    // Delete options not in incoming (by id or label)
    const incomingIds = new Set(incoming.filter((o) => o.id).map((o) => o.id as string));
    const toDelete = existing.options.filter((o) => !incomingIds.has(o.id) && !incoming.some((i) => i.label === o.label));
    // Simpler: delete all and recreate when structural change allowed (only DRAFT)
    await prisma.questionOption.deleteMany({ where: { questionId: id } });
    updated = await prisma.question.update({
      where: { id },
      data: {
        ...updateData,
        options: { create: incoming.map((o) => ({ label: o.label, optionText: o.optionText, scoreValue: o.scoreValue, order: o.order })) },
      },
      include: { options: true },
    });
  } else {
    updated = await prisma.question.update({ where: { id }, data: updateData, include: { options: true } });
  }

  await audit({ actorId: user.id, action: "questions.update", entity: "question", entityId: id, metadata: { hasResponses: hasResp } });
  return c.json({ question: updated, hasResponses: hasResp });
});

// PATCH /api/questions/:id/status — toggle
const statusSchema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]) });
questions.patch("/:id/status", requirePermission("questions.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = statusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const q = await prisma.question.findUnique({ where: { id } });
  if (!q) return notFound(c);
  const updated = await prisma.question.update({ where: { id }, data: { status: parsed.data.status }, include: { options: true } });
  const user = c.get("user");
  await audit({ actorId: user.id, action: "questions.status", entity: "question", entityId: id, metadata: { status: parsed.data.status } });
  return c.json({ question: updated });
});
