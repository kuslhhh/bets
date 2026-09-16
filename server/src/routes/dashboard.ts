import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { getAuthUser } from "../lib/auth";
import { unauthenticated } from "../lib/errors";
import { getBand } from "../lib/scoring/bands";
import { EXPECTED } from "../lib/scoring/constants";

export const dashboard = new Hono();

// GET /api/dashboard — personal always, organisation gated results.org.view (admin-only)
// Extended: personalHistory = all SUBMITTED per user per form fill (attempt) ordered asc for trend.
// Supports ?userId= for ADMIN with results.individual.view / results.org.view to inspect another user's history.
dashboard.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);

  const url = new URL(c.req.url);
  const requestedUserId = url.searchParams.get("userId");
  let targetUserId = user.id;
  if (requestedUserId && requestedUserId !== user.id) {
    if (!user.permissions.includes("results.individual.view") && !user.permissions.includes("results.org.view")) {
      const { forbidden } = await import("../lib/errors");
      return forbidden(c);
    }
    targetUserId = requestedUserId;
  }

  // Personal: latest result for target user
  const latestAssignment = await prisma.assessmentAssignment.findFirst({
    where: { userId: targetUserId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: { result: true },
  });

  let personal: unknown = null;
  if (latestAssignment?.result) {
    const categoryScores = await prisma.categoryScore.findMany({
      where: { resultId: latestAssignment.result.id },
      include: { category: { include: { section: true } } },
    });
    // perspective split for latest
    const selfCats = categoryScores.filter((cs: any) => cs.category.section.order === 1);
    const orgCats = categoryScores.filter((cs: any) => cs.category.section.order === 2);
    const selfAvgs = selfCats.map((cs: any) => Number(cs.averageScore));
    const orgAvgs = orgCats.map((cs: any) => Number(cs.averageScore));
    personal = {
      assignment: { id: latestAssignment.id, assessmentId: latestAssignment.assessmentId, attempt: (latestAssignment as any).attempt, submittedAt: latestAssignment.submittedAt },
      result: {
        overallSelf: latestAssignment.result.overallSelf ? Number(latestAssignment.result.overallSelf) : null,
        overallOrg: latestAssignment.result.overallOrg ? Number(latestAssignment.result.overallOrg) : null,
        overallCombined: (latestAssignment.result as any).overallCombined ? Number((latestAssignment.result as any).overallCombined) : null,
        minCategoryScore: (latestAssignment.result as any).minCategoryScore ? Number((latestAssignment.result as any).minCategoryScore) : null,
        maxCategoryScore: (latestAssignment.result as any).maxCategoryScore ? Number((latestAssignment.result as any).maxCategoryScore) : null,
        selfMinCategoryScore: selfAvgs.length ? Math.min(...selfAvgs) : null,
        selfMaxCategoryScore: selfAvgs.length ? Math.max(...selfAvgs) : null,
        orgMinCategoryScore: orgAvgs.length ? Math.min(...orgAvgs) : null,
        orgMaxCategoryScore: orgAvgs.length ? Math.max(...orgAvgs) : null,
        scoringVersion: (latestAssignment.result as any).scoringVersion,
      },
      categories: categoryScores.map((cs: any) => ({
        id: cs.categoryId,
        name: cs.category.name,
        sectionOrder: cs.category.section.order,
        sectionTitle: cs.category.section.title,
        averageScore: Number(cs.averageScore),
        minScore: cs.minScore != null ? Number(cs.minScore) : null,
        maxScore: cs.maxScore != null ? Number(cs.maxScore) : null,
        questionCount: cs.questionCount,
        band: getBand(Number(cs.averageScore)),
      })),
    };
  }

  // Personal history: all SUBMITTED per user per form fill (attempt) for trend/table.
  // Batched: one categoryScore query grouped by result (was one query per attempt).
  const submittedAssignments = await prisma.assessmentAssignment.findMany({
    where: { userId: targetUserId, status: "SUBMITTED" },
    orderBy: { submittedAt: "asc" },
    include: { result: true },
  });
  const withResults = submittedAssignments.filter((a) => a.result);
  const allHistoryScores = withResults.length
    ? await prisma.categoryScore.findMany({
        where: { resultId: { in: withResults.map((a) => a.result!.id) } },
        include: { category: { include: { section: true } } },
      })
    : [];
  const scoresByResult = new Map<string, typeof allHistoryScores>();
  for (const cs of allHistoryScores) {
    if (!scoresByResult.has(cs.resultId)) scoresByResult.set(cs.resultId, []);
    scoresByResult.get(cs.resultId)!.push(cs);
  }
  const personalHistory = withResults.map((a) => {
        const cscores = scoresByResult.get(a.result!.id) ?? [];
        const selfAvgs = cscores.filter((cs: any) => cs.category.section.order === 1).map((cs: any) => Number(cs.averageScore));
        const orgAvgs = cscores.filter((cs: any) => cs.category.section.order === 2).map((cs: any) => Number(cs.averageScore));
        return {
          assignmentId: a.id,
          attempt: a.attempt,
          submittedAt: a.submittedAt,
          assessmentId: a.assessmentId,
          result: {
            overallSelf: a.result!.overallSelf ? Number(a.result!.overallSelf) : null,
            overallOrg: a.result!.overallOrg ? Number(a.result!.overallOrg) : null,
            overallCombined: (a.result as any).overallCombined ? Number((a.result as any).overallCombined) : null,
            minCategoryScore: (a.result as any).minCategoryScore ? Number((a.result as any).minCategoryScore) : null,
            maxCategoryScore: (a.result as any).maxCategoryScore ? Number((a.result as any).maxCategoryScore) : null,
            selfMinCategoryScore: selfAvgs.length ? Math.min(...selfAvgs) : null,
            selfMaxCategoryScore: selfAvgs.length ? Math.max(...selfAvgs) : null,
            orgMinCategoryScore: orgAvgs.length ? Math.min(...orgAvgs) : null,
            orgMaxCategoryScore: orgAvgs.length ? Math.max(...orgAvgs) : null,
          },
          categories: cscores.map((cs: any) => ({
            id: cs.categoryId,
            name: cs.category.name,
            sectionOrder: cs.category.section.order,
            averageScore: Number(cs.averageScore),
            minScore: cs.minScore != null ? Number(cs.minScore) : null,
            maxScore: cs.maxScore != null ? Number(cs.maxScore) : null,
            band: getBand(Number(cs.averageScore)),
          })),
        };
      });

  // Organisation aggregates if permitted
  let organisation: unknown = null;
  let completion: unknown = null;

  if (user.permissions.includes("results.org.view")) {
    const [totalAssignments, submitted, inProgress, assigned] = await Promise.all([
      prisma.assessmentAssignment.count(),
      prisma.assessmentAssignment.count({ where: { status: "SUBMITTED" } }),
      prisma.assessmentAssignment.count({ where: { status: "IN_PROGRESS" } }),
      prisma.assessmentAssignment.count({ where: { status: "ASSIGNED" } }),
    ]);

    // Defensive bound: prevents unbounded memory on large histories.
    // Current semantics remain all-time/all-assessments (no filtering); if
    // the dataset exceeds the bound the averages reflect the most recent
    // 5000 category scores. Raise the limit if org grows beyond this.
    const DASHBOARD_MAX_SCORES = 5000;
    const allScores = await prisma.categoryScore.findMany({ take: DASHBOARD_MAX_SCORES, include: { category: true }, orderBy: { resultId: "desc" } });
    // Group by category
    const byCategory = new Map<string, { name: string; scores: number[] }>();
    for (const cs of allScores) {
      if (!byCategory.has(cs.categoryId)) byCategory.set(cs.categoryId, { name: (cs as any).category.name, scores: [] });
      byCategory.get(cs.categoryId)!.scores.push(Number(cs.averageScore));
    }
    const categoryAverages = Array.from(byCategory.entries()).map(([id, v]) => ({
      id,
      name: v.name,
      averageScore: v.scores.reduce((a, b) => a + b, 0) / v.scores.length || 0,
      count: v.scores.length,
      band: getBand(v.scores.reduce((a, b) => a + b, 0) / v.scores.length || 0),
    }));

    // Weakest 3
    const weakest = [...categoryAverages].sort((a, b) => a.averageScore - b.averageScore).slice(0, 3);

    // Users who filled assessments — per-user summary (one row per user with SUBMITTED)
    // Same defensive bound as above.
    const DASHBOARD_MAX_USERS = 5000;
    const submittedWithUsers = await prisma.assessmentAssignment.findMany({
      where: { status: "SUBMITTED" },
      take: DASHBOARD_MAX_USERS,
      include: { user: { select: { id: true, name: true, email: true } }, result: true },
      orderBy: { submittedAt: "desc" },
    });
    const userMap = new Map<string, { userId: string; name: string; email: string; fillCount: number; latestSubmittedAt: Date | null; latestOverallCombined: number | null; latestAttempt: number | null }>();
    for (const a of submittedWithUsers) {
      if (!userMap.has(a.userId)) {
        userMap.set(a.userId, {
          userId: a.userId,
          name: a.user.name,
          email: a.user.email,
          fillCount: 0,
          latestSubmittedAt: null,
          latestOverallCombined: null,
          latestAttempt: null,
        });
      }
      const entry = userMap.get(a.userId)!;
      entry.fillCount += 1;
      // first encountered is latest due to desc order
      if (!entry.latestSubmittedAt) {
        entry.latestSubmittedAt = a.submittedAt;
        entry.latestOverallCombined = a.result?.overallCombined ? Number(a.result.overallCombined) : null;
        entry.latestAttempt = a.attempt;
      }
    }
    const usersSummary = Array.from(userMap.values()).sort((a, b) => (b.latestSubmittedAt?.getTime() ?? 0) - (a.latestSubmittedAt?.getTime() ?? 0));

    organisation = { categoryAverages, weakest, expected: EXPECTED, usersSummary };
    completion = { total: totalAssignments, submitted, inProgress, assigned, submittedRate: totalAssignments ? submitted / totalAssignments : 0 };
  }

  return c.json({ personal, personalHistory, organisation, completion, expected: EXPECTED });
});

// GET /api/dashboard/categories?assignmentId=... or aggregated?period=7d
dashboard.get("/categories", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const url = new URL(c.req.url);
  const assignmentId = url.searchParams.get("assignmentId");
  if (assignmentId) {
    const result = await prisma.assessmentResult.findUnique({
      where: { assignmentId },
      include: { categoryScores: { include: { category: true } }, assignment: true },
    });
    if (!result) return c.json({ categories: [] });
    // scope check: if not owner and not admin individual view, still allow if self?
    const isOwner = result.assignment.userId === user.id;
    if (!isOwner && !user.permissions.includes("results.individual.view") && !user.permissions.includes("results.org.view")) {
      const { notFound } = await import("../lib/errors");
      return notFound(c);
    }
    const categories = result.categoryScores.map((cs: any) => ({
      id: cs.categoryId,
      name: cs.category.name,
      averageScore: Number(cs.averageScore),
      band: getBand(Number(cs.averageScore)),
      expected: EXPECTED,
    }));
    return c.json({ categories });
  }
  // without assignmentId, return organisation averages if permitted
  if (!user.permissions.includes("results.org.view")) return c.json({ categories: [] });
  const allScores = await prisma.categoryScore.findMany({ include: { category: true } });
  const byCategory = new Map<string, { name: string; scores: number[] }>();
  for (const cs of allScores) {
    if (!byCategory.has(cs.categoryId)) byCategory.set(cs.categoryId, { name: (cs as any).category.name, scores: [] });
    byCategory.get(cs.categoryId)!.scores.push(Number(cs.averageScore));
  }
  const categories = Array.from(byCategory.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    averageScore: v.scores.reduce((a, b) => a + b, 0) / v.scores.length || 0,
    band: getBand(v.scores.reduce((a, b) => a + b, 0) / v.scores.length || 0),
    expected: EXPECTED,
  }));
  return c.json({ categories });
});
