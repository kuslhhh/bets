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



questions.post("/", requirePermission("questions.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Question creation disabled — single assessment only" }, 410);
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
  // (type is not in the patch schema, so retype is impossible by construction)
  if (isPublished) {
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
    // Diff options so existing response references stay valid (no delete-all):
    // match incoming to existing by id, then by label; update matched,
    // create new, delete only unreferenced options missing from incoming.
    const incoming = parsed.data.options;
    const labels = incoming.map((o) => o.label);
    if (new Set(labels).size !== labels.length) {
      return badRequest(c, "duplicate option labels");
    }
    const existingById = new Map(existing.options.map((o) => [o.id, o]));
    const existingByLabel = new Map(existing.options.map((o) => [o.label, o]));
    const matchedIds = new Set<string>();
    const toUpdate: { id: string; label: string; optionText: string; scoreValue: number; order: number }[] = [];
    const toCreate: { label: string; optionText: string; scoreValue: number; order: number }[] = [];
    for (const o of incoming) {
      const match = (o.id && existingById.get(o.id)) || existingByLabel.get(o.label);
      if (match) {
        matchedIds.add(match.id);
        toUpdate.push({ id: match.id, label: o.label, optionText: o.optionText, scoreValue: o.scoreValue, order: o.order });
      } else {
        toCreate.push({ label: o.label, optionText: o.optionText, scoreValue: o.scoreValue, order: o.order });
      }
    }
    const toDelete = existing.options.filter((o) => !matchedIds.has(o.id));
    if (toDelete.length > 0) {
      const referenced = await prisma.response.count({
        where: { questionId: id, questionOptionId: { in: toDelete.map((o) => o.id) } },
      });
      if (referenced > 0) {
        return conflict(c, "cannot remove options that existing responses reference (deprecate the question instead)");
      }
    }
    updated = await prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.questionOption.deleteMany({ where: { id: { in: toDelete.map((o) => o.id) } } });
      }
      for (const u of toUpdate) {
        await tx.questionOption.update({
          where: { id: u.id },
          data: { label: u.label, optionText: u.optionText, scoreValue: u.scoreValue, order: u.order },
        });
      }
      if (toCreate.length > 0) {
        await tx.questionOption.createMany({ data: toCreate.map((o) => ({ questionId: id, ...o })) });
      }
      return tx.question.update({ where: { id }, data: updateData, include: { options: true } });
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
