import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { getAuthUser } from "../lib/auth";
import { unauthenticated, notFound } from "../lib/errors";
import { getBand } from "../lib/scoring/bands";
import { EXPECTED } from "../lib/scoring/constants";

export const results = new Hono();

// GET /api/results/:assignmentId — owner (results.self.view) or admin (results.individual.view)
results.get("/:assignmentId", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const assignmentId = c.req.param("assignmentId");
  const result = await prisma.assessmentResult.findUnique({
    where: { assignmentId },
    include: { assignment: { select: { userId: true } }, categoryScores: { include: { category: { include: { section: true } } } } },
  });
  if (!result) return notFound(c);
  const isOwner = result.assignment.userId === user.id;
  if (isOwner) {
    if (!user.permissions.includes("results.self.view")) return notFound(c);
  } else {
    if (!user.permissions.includes("results.individual.view")) return notFound(c);
  }
  const [responses, textAnswers] = await Promise.all([
    prisma.response.findMany({ where: { assignmentId } }),
    prisma.textAnswer.findMany({ where: { assignmentId } }),
  ]);

  const categories = result.categoryScores.map((cs: any) => ({
    id: cs.categoryId,
    name: cs.category.name,
    sectionOrder: cs.category.section.order,
    sectionTitle: cs.category.section.title,
    averageScore: Number(cs.averageScore),
    questionCount: cs.questionCount,
    minScore: cs.minScore != null ? Number(cs.minScore) : null,
    maxScore: cs.maxScore != null ? Number(cs.maxScore) : null,
    band: getBand(Number(cs.averageScore)),
    expected: EXPECTED,
  }));

  const insights = [...categories].sort((a, b) => a.averageScore - b.averageScore).map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    score: cat.averageScore,
    band: cat.band,
    priority: cat.averageScore,
  }));

  return c.json({
    result: {
      id: result.id,
      assignmentId: result.assignmentId,
      overallSelf: result.overallSelf ? Number(result.overallSelf) : null,
      overallOrg: result.overallOrg ? Number(result.overallOrg) : null,
      overallCombined: (result as any).overallCombined ? Number((result as any).overallCombined) : null,
      minCategoryScore: result.minCategoryScore ? Number(result.minCategoryScore) : null,
      maxCategoryScore: result.maxCategoryScore ? Number(result.maxCategoryScore) : null,
      scoringVersion: result.scoringVersion,
      calculatedAt: result.calculatedAt,
    },
    categories,
    insights,
    answers: { responses, textAnswers },
    expected: EXPECTED,
  });
});
