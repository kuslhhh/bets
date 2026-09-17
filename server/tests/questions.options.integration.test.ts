// Integration: PATCH /api/questions/:id option diff keeps response references valid.
// Requires TEST_DATABASE_URL (skipped otherwise — run with env-file, see docs/REFACTOR_PLAN.md).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestDbStatus } from "./helpers.js";

const { hasDb, ci } = getTestDbStatus();
if (!hasDb && ci) throw new Error("TEST_DATABASE_URL is required in CI — integration tests must run against the isolated finance_test database");

describe.runIf(hasDb)("question option diff (integration)", () => {
  let prisma: typeof import("../src/lib/prisma.js").prisma;
  let app: typeof import("../src/app.js").default;
  const ids: { user?: string; session?: string; assessment?: string; question?: string } = {};
  const email = `optdiff-${Date.now()}@example.com`;
  const token = `test-session-${Date.now()}`;

  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma.js"));
    ({ default: app } = await import("../src/app.js"));
    const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
    if (!adminRole) throw new Error("ADMIN role missing — run migrations");
    const user = await prisma.user.create({
      data: { email, passwordHash: "not-a-real-hash", name: "OptDiff", roleId: adminRole.id },
    });
    ids.user = user.id;
    await prisma.session.create({
      data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 3600_000) },
    });
    ids.session = token;
    const assessment = await prisma.assessment.create({ data: { title: "OptDiff", status: "DRAFT" } });
    ids.assessment = assessment.id;
    const section = await prisma.section.create({ data: { assessmentId: assessment.id, order: 1, title: "S1" } });
    const category = await prisma.category.create({ data: { sectionId: section.id, order: 1, name: "C1" } });
    const question = await prisma.question.create({
      data: {
        assessmentId: assessment.id,
        sectionId: section.id,
        categoryId: category.id,
        type: "SINGLE_SELECT",
        promptText: "Q?",
        order: 1,
        options: {
          create: [
            { label: "a", optionText: "Alpha", scoreValue: 100, order: 1 },
            { label: "b", optionText: "Beta", scoreValue: 50, order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    ids.question = question.id;
    const assignment = await prisma.assessmentAssignment.create({
      data: { assessmentId: assessment.id, userId: user.id, status: "IN_PROGRESS", attempt: 1 },
    });
    const optA = question.options.find((o) => o.label === "a")!;
    await prisma.response.create({
      data: { assignmentId: assignment.id, questionId: question.id, questionOptionId: optA.id, scoreValue: optA.scoreValue },
    });
  });

  afterAll(async () => {
    if (!hasDb || !ids.user) return;
    // Order matters (RESTRICT FKs): responses → assignments → options/questions → user/session.
    const assignments = await prisma.assessmentAssignment.findMany({ where: { userId: ids.user } });
    for (const a of assignments) {
      await prisma.response.deleteMany({ where: { assignmentId: a.id } });
      await prisma.textAnswer.deleteMany({ where: { assignmentId: a.id } });
      await prisma.assessmentAssignment.delete({ where: { id: a.id } });
    }
    if (ids.question) {
      await prisma.questionOption.deleteMany({ where: { questionId: ids.question } });
      await prisma.question.delete({ where: { id: ids.question } });
    }
    if (ids.assessment) {
      const sections = await prisma.section.findMany({ where: { assessmentId: ids.assessment } });
      for (const s of sections) {
        await prisma.category.deleteMany({ where: { sectionId: s.id } });
        await prisma.section.delete({ where: { id: s.id } });
      }
      await prisma.assessment.delete({ where: { id: ids.assessment } });
    }
    await prisma.session.deleteMany({ where: { sessionToken: token } });
    await prisma.auditLog.deleteMany({ where: { actorId: ids.user } });
    await prisma.user.delete({ where: { id: ids.user } });
  });

  function authed(path: string, body: unknown) {
    return app.request(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `fa_session=${token}` },
      body: JSON.stringify(body),
    });
  }

  it("editing option text preserves option ids + existing responses", async () => {
    const q = await prisma.question.findUnique({ where: { id: ids.question! }, include: { options: true } });
    const payload = {
      options: q!.options.map((o) => ({
        id: o.id,
        label: o.label,
        optionText: o.label === "a" ? "Alpha (edited)" : o.optionText,
        scoreValue: o.scoreValue,
        order: o.order,
      })),
    };
    const res = await authed(`/api/questions/${ids.question}`, payload);
    expect(res.status).toBe(200);
    const after = await prisma.question.findUnique({ where: { id: ids.question! }, include: { options: true } });
    // Same ids, edited text applied.
    expect(after!.options.map((o) => o.id).sort()).toEqual(q!.options.map((o) => o.id).sort());
    expect(after!.options.find((o) => o.label === "a")!.optionText).toBe("Alpha (edited)");
    // The pre-existing response still points at a live option.
    const response = await prisma.response.findFirst({ where: { questionId: ids.question! }, include: { option: true } });
    expect(response).not.toBeNull();
    expect(response!.option.id).toBe(response!.questionOptionId);
  });

  it("removing a referenced option is rejected (409), responses untouched", async () => {
    const q = await prisma.question.findUnique({ where: { id: ids.question! }, include: { options: true } });
    const optB = q!.options.find((o) => o.label === "b")!;
    const res = await authed(`/api/questions/${ids.question}`, {
      options: [{ id: optB.id, label: "b", optionText: optB.optionText, scoreValue: optB.scoreValue, order: 1 }],
    });
    expect(res.status).toBe(409);
    const response = await prisma.response.findFirst({ where: { questionId: ids.question! } });
    expect(response).not.toBeNull();
  });
});
