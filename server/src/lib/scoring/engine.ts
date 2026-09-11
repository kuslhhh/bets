export function avg2(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
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
  return { overallSelf, overallOrg, overallCombined, minCategoryScore: Math.min(...all), maxCategoryScore: Math.max(...all) };
}
