export function avg2(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CategoryScoreInput {
  categoryId: string;
  scores: number[]; // question scores in category
}

export function computeCategoryScores(inputs: CategoryScoreInput[]): { categoryId: string; averageScore: number; questionCount: number; minScore: number | null; maxScore: number | null }[] {
  return inputs.map((c) => ({
    categoryId: c.categoryId,
    averageScore: avg2(c.scores),
    questionCount: c.scores.length,
    minScore: c.scores.length ? Math.min(...c.scores) : null,
    maxScore: c.scores.length ? Math.max(...c.scores) : null,
  }));
}

export function computeOverall(categoryScores: { averageScore: number }[]): { overallSelf: number; overallOrg: number; overallCombined: number; minCategoryScore: number; maxCategoryScore: number } | null {
  // This generic version expects caller to split Self/Org. We provide helper for finance: first 3 = Self, next 3 = Org
  if (categoryScores.length === 0) return null;
  // If 6 categories, split 3/3; else fallback to all
  if (categoryScores.length === 6) {
    const self = avg2(categoryScores.slice(0, 3).map((c) => c.averageScore));
    const org = avg2(categoryScores.slice(3).map((c) => c.averageScore));
    const combined = avg2(categoryScores.map((c) => c.averageScore));
    const scores = categoryScores.map((c) => c.averageScore);
    return { overallSelf: self, overallOrg: org, overallCombined: combined, minCategoryScore: Math.min(...scores), maxCategoryScore: Math.max(...scores) };
  }
  const combined = avg2(categoryScores.map((c) => c.averageScore));
  const scores = categoryScores.map((c) => c.averageScore);
  return { overallSelf: combined, overallOrg: combined, overallCombined: combined, minCategoryScore: Math.min(...scores), maxCategoryScore: Math.max(...scores) };
}

export function computeOverallSplit(selfScores: number[], orgScores: number[]) {
  const overallSelf = avg2(selfScores);
  const overallOrg = avg2(orgScores);
  const overallCombined = avg2([...selfScores, ...orgScores]);
  const all = [...selfScores, ...orgScores];
  return { overallSelf, overallOrg, overallCombined, minCategoryScore: round2(Math.min(...all)), maxCategoryScore: round2(Math.max(...all)) };
}

export interface CategoryBreakdown {
  categoryScoresData: { categoryId: string; averageScore: number; questionCount: number; minScore: number | null; maxScore: number | null }[];
  selfScores: number[];
  orgScores: number[];
}

/** Pure: group required question scores into per-category breakdown + Self/Org splits. */
export function computeCategoryBreakdown(
  categories: { id: string; sectionOrder: number }[],
  requiredQuestions: { id: string; categoryId: string | null }[],
  scoreByQuestion: Map<string, number>,
): CategoryBreakdown {
  const questionsByCategory = new Map<string, string[]>();
  for (const q of requiredQuestions) {
    if (!q.categoryId) continue;
    if (!questionsByCategory.has(q.categoryId)) questionsByCategory.set(q.categoryId, []);
    questionsByCategory.get(q.categoryId)!.push(q.id);
  }
  const categoryScoresData: CategoryBreakdown["categoryScoresData"] = [];
  const selfScores: number[] = [];
  const orgScores: number[] = [];
  for (const cat of categories) {
    const qIds = questionsByCategory.get(cat.id) ?? [];
    if (qIds.length === 0) continue;
    const scores = qIds.map((qid) => scoreByQuestion.get(qid)!);
    // Excel-faithful: overall averages the full-precision category means
    // (Excel rounds display only); persistence stays 2dp via avg2.
    const exact = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avg = avg2(scores);
    categoryScoresData.push({
      categoryId: cat.id,
      averageScore: avg,
      questionCount: scores.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    });
    if (cat.sectionOrder === 1) selfScores.push(exact);
    else orgScores.push(exact);
  }
  return { categoryScoresData, selfScores, orgScores };
}
