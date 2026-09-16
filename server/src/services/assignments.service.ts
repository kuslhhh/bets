// Assignment taking-flow business logic (no Hono imports — HTTP mapping stays
// in routes/assignments.ts). Single implementation for the previously duplicated
// save-responses and submit paths (assignment-id vs assessment-id aliases).

import { prisma } from "../lib/prisma";
import { computeCategoryBreakdown, computeOverallSplit } from "../lib/scoring/engine";
import { SCORING_VERSION } from "../lib/scoring/constants";

// --- Typed errors (routes map these to the {error,details} envelope) ---

export type ServiceErrorStatus = 400 | 404 | 409;

export class ServiceError extends Error {
  status: ServiceErrorStatus;
  details: unknown;
  constructor(status: ServiceErrorStatus, details?: unknown) {
    super(typeof details === "string" ? details : "service error");
    this.status = status;
    this.details = details;
  }
}

export function badRequestError(details?: unknown): ServiceError {
  return new ServiceError(400, details);
}

export function notFoundError(): ServiceError {
  return new ServiceError(404);
}

export function conflictError(details?: unknown): ServiceError {
  return new ServiceError(409, details);
}

// --- Types ---

export interface Progress {
  answered: number;
  required: number;
}

export interface SaveResponsesInput {
  responses?: { questionId: string; questionOptionId: string }[];
  textAnswers?: { questionId: string; slotIndex: number; answerText?: string | null }[];
}

export interface SubmitOutcome {
  resultId: string;
  overallSelf: number;
  overallOrg: number;
  overallCombined: number;
  minCategoryScore: number;
  maxCategoryScore: number;
  idempotent?: boolean;
}

// --- Progress ---

export async function getRequiredCount(assessmentId: string): Promise<number> {
  return prisma.question.count({ where: { assessmentId, isRequired: true, type: "SINGLE_SELECT" } });
}

export async function getProgress(assignmentId: string, assessmentId: string): Promise<Progress> {
  const required = await getRequiredCount(assessmentId);
  const answered = await prisma.response.count({ where: { assignmentId } });
  return { answered, required };
}

// --- Assignment lifecycle ---

export const RETAKE_COOLDOWN_DAYS = 45;
const RETAKE_COOLDOWN_MS = RETAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export interface CooldownStatus {
  eligible: boolean;
  nextEligibleAt: string | null;
  daysRemaining: number;
  latestAssignmentId: string | null;
}

export function cooldownFromSubmittedAt(submittedAt: Date | string | null, nowMs = Date.now()): Omit<CooldownStatus, "latestAssignmentId"> {
  if (!submittedAt) return { eligible: true, nextEligibleAt: null, daysRemaining: 0 };
  const submittedMs = new Date(submittedAt).getTime();
  const nextMs = submittedMs + RETAKE_COOLDOWN_MS;
  const remaining = nextMs - nowMs;
  if (remaining <= 0) return { eligible: true, nextEligibleAt: null, daysRemaining: 0 };
  return {
    eligible: false,
    nextEligibleAt: new Date(nextMs).toISOString(),
    daysRemaining: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
  };
}

type ActiveAssignment = Awaited<ReturnType<typeof prisma.assessmentAssignment.findFirst>>;

function isPrismaUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

export async function getRetakeStatus(userId: string, assessmentId: string, nowMs = Date.now()): Promise<CooldownStatus> {
  const lastSubmitted = await prisma.assessmentAssignment.findFirst({
    where: { assessmentId, userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    select: { id: true, submittedAt: true },
  });
  const cd = cooldownFromSubmittedAt(lastSubmitted?.submittedAt ?? null, nowMs);
  return { ...cd, latestAssignmentId: lastSubmitted?.id ?? null };
}

async function assertRetakeEligible(userId: string, assessmentId: string): Promise<void> {
  const status = await getRetakeStatus(userId, assessmentId);
  if (!status.eligible) {
    throw conflictError({
      code: "COOLDOWN",
      message: `Next attempt available in ${status.daysRemaining} day(s)`,
      nextEligibleAt: status.nextEligibleAt,
      daysRemaining: status.daysRemaining,
      latestAssignmentId: status.latestAssignmentId,
    });
  }
}

export async function ensureActiveAssignment(userId: string, assessmentId: string) {
  const active = await prisma.assessmentAssignment.findFirst({
    where: { assessmentId, userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
  });
  if (active) return active;
  await assertRetakeEligible(userId, assessmentId);
  const latest = await prisma.assessmentAssignment.findMany({
    where: { assessmentId, userId },
    orderBy: { attempt: "desc" },
    take: 1,
    select: { attempt: true },
  });
  const attempt = (latest[0]?.attempt ?? 0) + 1;
  try {
    return await prisma.assessmentAssignment.create({
      data: { assessmentId, userId, status: "ASSIGNED", attempt, assignedBy: null },
    });
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) throw err;
    // Concurrent start raced on same attempt — return the winner's row.
    const raced = await prisma.assessmentAssignment.findFirst({
      where: { assessmentId, userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    });
    if (raced) return raced;
    // Fallback: retry with incremented attempt once
    const retryLatest = await prisma.assessmentAssignment.findMany({
      where: { assessmentId, userId },
      orderBy: { attempt: "desc" },
      take: 1,
      select: { attempt: true },
    });
    const retryAttempt = (retryLatest[0]?.attempt ?? attempt) + 1;
    return prisma.assessmentAssignment.create({
      data: { assessmentId, userId, status: "ASSIGNED", attempt: retryAttempt, assignedBy: null },
    });
  }
}

function ensureEditable(assignment: { status: string; dueAt: Date | null }): void {
  if (assignment.status === "SUBMITTED" || assignment.status === "EXPIRED") {
    throw conflictError("assignment already submitted or expired");
  }
  if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
    throw conflictError("assignment expired");
  }
}

async function ensurePublishedAssessment(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw notFoundError();
  if (assessment.status !== "PUBLISHED") throw conflictError("assessment not published");
  return assessment;
}

/** Start by assignment id (resolves + validates ownership). Returns the assignment to send. */
export async function startByAssignment(userId: string, assignmentId: string, isManager: boolean) {
  const existing = await prisma.assessmentAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing) throw notFoundError();
  if (existing.userId !== userId && !isManager) throw notFoundError();
  if (existing.status === "SUBMITTED") throw conflictError("already submitted");
  if (existing.status === "EXPIRED") throw conflictError("assignment expired");
  await ensurePublishedAssessment(existing.assessmentId);
  ensureEditable(existing);
  if (existing.status === "IN_PROGRESS") return existing;
  return prisma.assessmentAssignment.update({
    where: { id: assignmentId },
    data: { status: "IN_PROGRESS", startedAt: existing.startedAt ?? new Date() },
  });
}

/** Self-serve start by assessment id (auto-creates the assignment row). */
export async function startByAssessment(userId: string, assessmentId: string) {
  await ensurePublishedAssessment(assessmentId);
  const assignment = await ensureActiveAssignment(userId, assessmentId);
  ensureEditable(assignment);
  if (assignment.status === "ASSIGNED") {
    return prisma.assessmentAssignment.update({
      where: { id: assignment.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }
  return assignment;
}

/**
 * Resolve the assignment for a save/start/submit call where the path id may be
 * either an assignment id or (self-serve alias) an assessment id.
 */
export async function resolveAssignment(params: {
  id: string;
  userId: string;
  isManager: boolean;
}): Promise<{ assignment: NonNullable<ActiveAssignment>; isNew: boolean }> {
  const { id, userId, isManager } = params;
  const byId = await prisma.assessmentAssignment.findUnique({ where: { id } });
  if (byId) {
    if (byId.userId !== userId && !isManager) throw notFoundError();
    return { assignment: byId, isNew: false };
  }
  // Treat id as assessmentId (self-serve alias).
  await ensurePublishedAssessment(id);
  const created = await ensureActiveAssignment(userId, id);
  if (created.status === "ASSIGNED") {
    const started = await prisma.assessmentAssignment.update({
      where: { id: created.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    return { assignment: started, isNew: true };
  }
  return { assignment: created, isNew: false };
}

// --- Saving drafts ---

export async function saveResponses(
  assignmentId: string,
  input: SaveResponsesInput,
): Promise<{ saved: number; progress: Progress }> {
  const assignment = await prisma.assessmentAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw notFoundError();
  ensureEditable(assignment);
  await ensurePublishedAssessment(assignment.assessmentId);

  // Validate before transaction — throw is cheap, no DB writes yet
  let validatedResponses: { questionId: string; option: { id: string; scoreValue: number } }[] = [];
  let validatedText: { questionId: string; slotIndex: number; answerText: string | null }[] = [];
  if (input.responses) {
    const qIds = [...new Set(input.responses.map((r) => r.questionId))];
    const questions = await prisma.question.findMany({ where: { id: { in: qIds } } });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const oIds = [...new Set(input.responses.map((r) => r.questionOptionId))];
    const options = await prisma.questionOption.findMany({ where: { id: { in: oIds } } });
    const oMap = new Map(options.map((o) => [o.id, o]));
    for (const r of input.responses) {
      const question = qMap.get(r.questionId);
      if (!question || question.assessmentId !== assignment.assessmentId) {
        throw badRequestError(`question ${r.questionId} not in assessment`);
      }
      if (question.type !== "SINGLE_SELECT") {
        throw badRequestError(`question ${r.questionId} is not SINGLE_SELECT`);
      }
      const option = oMap.get(r.questionOptionId);
      if (!option || option.questionId !== r.questionId) {
        throw badRequestError(`option ${r.questionOptionId} not in question`);
      }
      validatedResponses.push({ questionId: r.questionId, option });
    }
  }
  if (input.textAnswers) {
    const qIds = [...new Set(input.textAnswers.map((t) => t.questionId))];
    const questions = await prisma.question.findMany({ where: { id: { in: qIds } } });
    const qMap = new Map(questions.map((q) => [q.id, q]));
    for (const t of input.textAnswers) {
      const question = qMap.get(t.questionId);
      if (!question || question.assessmentId !== assignment.assessmentId) {
        throw badRequestError(`question ${t.questionId} not in assessment`);
      }
      if (question.type !== "TEXT_MULTI_SLOT") {
        throw badRequestError(`question ${t.questionId} is not TEXT_MULTI_SLOT`);
      }
      if (t.slotIndex >= (question.slotCount ?? 4)) {
        throw badRequestError(`slotIndex ${t.slotIndex} out of range`);
      }
      validatedText.push({ questionId: t.questionId, slotIndex: t.slotIndex, answerText: t.answerText ?? null });
    }
  }

  // Atomic: all upserts + updatedAt in one transaction — any failure rolls back
  const saved = validatedResponses.length + validatedText.length;
  await prisma.$transaction(async (tx) => {
    for (const r of validatedResponses) {
      await tx.response.upsert({
        where: { assignmentId_questionId: { assignmentId: assignment.id, questionId: r.questionId } },
        update: { questionOptionId: r.option.id, scoreValue: r.option.scoreValue },
        create: {
          assignmentId: assignment.id,
          questionId: r.questionId,
          questionOptionId: r.option.id,
          scoreValue: r.option.scoreValue,
        },
      });
    }
    for (const t of validatedText) {
      await tx.textAnswer.upsert({
        where: {
          assignmentId_questionId_slotIndex: {
            assignmentId: assignment.id,
            questionId: t.questionId,
            slotIndex: t.slotIndex,
          },
        },
        update: { answerText: t.answerText },
        create: {
          assignmentId: assignment.id,
          questionId: t.questionId,
          slotIndex: t.slotIndex,
          answerText: t.answerText,
        },
      });
    }
    await tx.assessmentAssignment.update({ where: { id: assignment.id }, data: { updatedAt: new Date() } });
  });

  const progress = await getProgress(assignment.id, assignment.assessmentId);
  return { saved, progress };
}

export async function clearResponses(assignmentId: string): Promise<{ progress: Progress }> {
  const assignment = await prisma.assessmentAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw notFoundError();
  ensureEditable(assignment);
  await prisma.$transaction([
    prisma.response.deleteMany({ where: { assignmentId } }),
    prisma.textAnswer.deleteMany({ where: { assignmentId } }),
  ]);
  const progress = await getProgress(assignmentId, assignment.assessmentId);
  await prisma.assessmentAssignment.update({ where: { id: assignmentId }, data: { updatedAt: new Date() } });
  return { progress };
}

// --- Submit (single implementation for both aliases) ---

export async function submitAssignment(
  assignmentId: string,
  opts: { idempotencyKey?: string | null } = {},
): Promise<SubmitOutcome> {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { id: assignmentId },
    include: { assessment: true },
  });
  if (!assignment) throw notFoundError();
  // Idempotency: if a result already exists and the caller supplies a key,
  // return it even when the assignment is already SUBMITTED (sequential replay).
  const existingResult = await prisma.assessmentResult.findUnique({ where: { assignmentId } });
  if (existingResult) {
    if (opts.idempotencyKey) {
      return {
        resultId: existingResult.id,
        overallSelf: existingResult.overallSelf ? Number(existingResult.overallSelf) : 0,
        overallOrg: existingResult.overallOrg ? Number(existingResult.overallOrg) : 0,
        overallCombined: (existingResult as unknown as { overallCombined: unknown }).overallCombined
          ? Number((existingResult as unknown as { overallCombined: unknown }).overallCombined)
          : 0,
        minCategoryScore: existingResult.minCategoryScore ? Number(existingResult.minCategoryScore) : 0,
        maxCategoryScore: existingResult.maxCategoryScore ? Number(existingResult.maxCategoryScore) : 0,
        idempotent: true,
      };
    }
    throw conflictError("already submitted");
  }
  if (assignment.status === "SUBMITTED" || assignment.status === "EXPIRED") {
    throw conflictError("already submitted or expired");
  }
  if (assignment.status !== "ASSIGNED" && assignment.status !== "IN_PROGRESS") {
    throw conflictError("invalid status");
  }
  if (assignment.assessment.status !== "PUBLISHED") throw conflictError("assessment not published");
  if (assignment.dueAt && new Date(assignment.dueAt) < new Date()) {
    await prisma.assessmentAssignment.update({ where: { id: assignmentId }, data: { status: "EXPIRED" } });
    throw conflictError("assignment expired");
  }

  const requiredQuestions = await prisma.question.findMany({
    where: { assessmentId: assignment.assessmentId, isRequired: true, type: "SINGLE_SELECT" },
  });
  const responses = await prisma.response.findMany({ where: { assignmentId } });
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const missing: string[] = [];
  for (const q of requiredQuestions) {
    if (!responseMap.has(q.id)) missing.push(q.id);
  }
  if (missing.length) {
    throw badRequestError({ missing, message: "incomplete — required questions missing" });
  }

  const categories = await prisma.category.findMany({
    where: { section: { assessmentId: assignment.assessmentId } },
    orderBy: [{ sectionId: "asc" }, { order: "asc" }],
    include: { section: true },
  });
  const scoreByQuestion = new Map(responses.map((r) => [r.questionId, r.scoreValue]));
  const { categoryScoresData, selfScores, orgScores } = computeCategoryBreakdown(
    categories.map((cat) => ({ id: cat.id, sectionOrder: cat.section.order })),
    requiredQuestions,
    scoreByQuestion,
  );

  const overall = computeOverallSplit(selfScores, orgScores);

  let result: { id: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction to avoid TOCTOU race with concurrent submit
      const insideExisting = await tx.assessmentResult.findUnique({ where: { assignmentId } });
      if (insideExisting) {
        // Let outer catch handle idempotency mapping via P2002-like path
        const err = new Error("already submitted") as Error & { code?: string };
        (err as unknown as { _isInsideExists: boolean })._isInsideExists = true;
        throw err;
      }
      const res = await tx.assessmentResult.create({
        data: {
          assignmentId,
          overallSelf: overall.overallSelf,
          overallOrg: overall.overallOrg,
          overallCombined: overall.overallCombined,
          minCategoryScore: overall.minCategoryScore,
          maxCategoryScore: overall.maxCategoryScore,
          scoringVersion: SCORING_VERSION,
        },
      });
      for (const cs of categoryScoresData) {
        await tx.categoryScore.create({
          data: {
            resultId: res.id,
            categoryId: cs.categoryId,
            averageScore: cs.averageScore,
            questionCount: cs.questionCount,
            minScore: cs.minScore,
            maxScore: cs.maxScore,
          },
        });
      }
      await tx.assessmentAssignment.update({
        where: { id: assignmentId },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      return res;
    });
  } catch (err) {
    const isInsideExists = Boolean((err as unknown as { _isInsideExists?: boolean })?._isInsideExists);
    if (isInsideExists || isPrismaUniqueViolation(err)) {
      const existing = await prisma.assessmentResult.findUnique({ where: { assignmentId } });
      if (existing) {
        if (opts.idempotencyKey) {
          return {
            resultId: existing.id,
            overallSelf: existing.overallSelf ? Number(existing.overallSelf) : 0,
            overallOrg: existing.overallOrg ? Number(existing.overallOrg) : 0,
            overallCombined: (existing as unknown as { overallCombined: unknown }).overallCombined
              ? Number((existing as unknown as { overallCombined: unknown }).overallCombined)
              : 0,
            minCategoryScore: existing.minCategoryScore ? Number(existing.minCategoryScore) : 0,
            maxCategoryScore: existing.maxCategoryScore ? Number(existing.maxCategoryScore) : 0,
            idempotent: true,
          };
        }
        throw conflictError("already submitted");
      }
    }
    throw err;
  }

  return {
    resultId: result.id,
    overallSelf: overall.overallSelf,
    overallOrg: overall.overallOrg,
    overallCombined: overall.overallCombined,
    minCategoryScore: overall.minCategoryScore,
    maxCategoryScore: overall.maxCategoryScore,
  };
}
