// Pure unit tests for the submit-time scoring breakdown (DB-free).
// The breakdown lives in lib/scoring/engine.ts so it stays importable
// without a database connection.
import { describe, it, expect } from "vitest";
import { computeCategoryBreakdown, computeOverallSplit } from "../src/lib/scoring/engine";

describe("computeCategoryBreakdown", () => {
  const cats = [
    { id: "c1", sectionOrder: 1 },
    { id: "c2", sectionOrder: 1 },
    { id: "c3", sectionOrder: 2 },
  ];
  const required = [
    { id: "q1", categoryId: "c1" },
    { id: "q2", categoryId: "c1" },
    { id: "q3", categoryId: "c2" },
    { id: "q4", categoryId: "c3" },
    { id: "qx", categoryId: null },
  ];

  it("averages per category and splits Self/Org", () => {
    const scores = new Map([
      ["q1", 100],
      ["q2", 50],
      ["q3", 75],
      ["q4", 25],
    ]);
    const { categoryScoresData, selfScores, orgScores } = computeCategoryBreakdown(cats, required, scores);
    expect(categoryScoresData).toHaveLength(3);
    expect(categoryScoresData[0]).toMatchObject({ categoryId: "c1", averageScore: 75, questionCount: 2, minScore: 50, maxScore: 100 });
    expect(selfScores).toEqual([75, 75]);
    expect(orgScores).toEqual([25]);
  });

  it("skips empty categories and uncategorized questions", () => {
    const { categoryScoresData } = computeCategoryBreakdown(
      [...cats, { id: "empty", sectionOrder: 2 }],
      required,
      new Map([
        ["q1", 100],
        ["q2", 100],
        ["q3", 100],
        ["q4", 100],
      ]),
    );
    expect(categoryScoresData.map((c) => c.categoryId)).toEqual(["c1", "c2", "c3"]);
  });

  it("matches Excel: overall averages full-precision means (Finance 2/2/3 split)", () => {
    // Five categories at 100 + Org Decision [100,50,50] = 200/3.
    // Excel: combined = (500 + 200/3)/6 = 94.4444… → 94.44.
    // Averaging the rounded 66.67 would give 94.45 — the old behaviour.
    const financeCats = [
      { id: "s1k", sectionOrder: 1 },
      { id: "s1t", sectionOrder: 1 },
      { id: "s1d", sectionOrder: 1 },
      { id: "s2k", sectionOrder: 2 },
      { id: "s2t", sectionOrder: 2 },
      { id: "s2d", sectionOrder: 2 },
    ];
    const financeRequired = [
      { id: "a1", categoryId: "s1k" },
      { id: "a2", categoryId: "s1k" },
      { id: "a3", categoryId: "s1t" },
      { id: "a4", categoryId: "s1t" },
      { id: "a5", categoryId: "s1d" },
      { id: "a6", categoryId: "s1d" },
      { id: "a7", categoryId: "s1d" },
      { id: "b1", categoryId: "s2k" },
      { id: "b2", categoryId: "s2k" },
      { id: "b3", categoryId: "s2t" },
      { id: "b4", categoryId: "s2t" },
      { id: "b5", categoryId: "s2d" },
      { id: "b6", categoryId: "s2d" },
      { id: "b7", categoryId: "s2d" },
    ];
    const entries: [string, number][] = financeRequired.map((q) => [q.id, 100]);
    entries.find((e) => e[0] === "b6")![1] = 50;
    entries.find((e) => e[0] === "b7")![1] = 50;
    const { categoryScoresData, selfScores, orgScores } = computeCategoryBreakdown(
      financeCats,
      financeRequired,
      new Map(entries),
    );
    expect(categoryScoresData.find((c) => c.categoryId === "s2d")).toMatchObject({
      averageScore: 66.67,
      questionCount: 3,
      minScore: 50,
      maxScore: 100,
    });
    const overall = computeOverallSplit(selfScores, orgScores);
    expect(overall.overallSelf).toBe(100);
    expect(overall.overallOrg).toBeCloseTo(88.89, 2);
    expect(overall.overallCombined).toBe(94.44);
    expect(overall.minCategoryScore).toBe(66.67);
    expect(overall.maxCategoryScore).toBe(100);
  });
});
