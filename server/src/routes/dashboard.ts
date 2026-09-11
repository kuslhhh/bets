import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { getAuthUser } from "../lib/auth";
import { unauthenticated } from "../lib/errors";
import { getBand } from "../lib/scoring/bands";
import { EXPECTED } from "../lib/scoring/constants";

export const dashboard = new Hono();

// GET /api/dashboard — personal always, organisation gated results.org.view (admin-only)
dashboard.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);

  // Personal: latest result for user
  const latestAssignment = await prisma.assessmentAssignment.findFirst({
    where: { userId: user.id, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: { result: true },
  });

  let personal: unknown = null;
  if (latestAssignment?.result) {
    const categoryScores = await prisma.categoryScore.findMany({
      where: { resultId: latestAssignment.result.id },
      include: { category: true },
    });
    personal = {
      assignment: { id: latestAssignment.id, assessmentId: latestAssignment.assessmentId, submittedAt: latestAssignment.submittedAt },
      result: {
        overallSelf: latestAssignment.result.overallSelf ? Number(latestAssignment.result.overallSelf) : null,
        overallOrg: latestAssignment.result.overallOrg ? Number(latestAssignment.result.overallOrg) : null,
        overallCombined: (latestAssignment.result as any).overallCombined ? Number((latestAssignment.result as any).overallCombined) : null,
      },
      categories: categoryScores.map((cs: any) => ({
        id: cs.categoryId,
        name: cs.category.name,
        averageScore: Number(cs.averageScore),
        band: getBand(Number(cs.averageScore)),
      })),
    };
  }

  // Organisation aggregates if permitted
  let organisation: unknown = null;
  let completion: unknown = null;

  if (user.permissions.includes("results.org.view")) {
    const totalAssignments = await prisma.assessmentAssignment.count();
    const submitted = await prisma.assessmentAssignment.count({ where: { status: "SUBMITTED" } });
    const inProgress = await prisma.assessmentAssignment.count({ where: { status: "IN_PROGRESS" } });
    const assigned = await prisma.assessmentAssignment.count({ where: { status: "ASSIGNED" } });

    const allScores = await prisma.categoryScore.findMany({ include: { category: true } });
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

    organisation = { categoryAverages, weakest, expected: EXPECTED };
    completion = { total: totalAssignments, submitted, inProgress, assigned, submittedRate: totalAssignments ? submitted / totalAssignments : 0 };
  }

  return c.json({ personal, organisation, completion, expected: EXPECTED });
});

// GET /api/dashboard/categories?assignmentId=... or aggregated?period=7d
dashboard.get("/categories", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const url = new URL(c.req.url);
  const assignmentId = url.searchParams.get("assignmentId");
  const period = url.searchParams.get("period");
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
