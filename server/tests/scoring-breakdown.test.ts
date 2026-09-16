// Pure unit tests for the submit-time scoring breakdown (DB-free).
// The breakdown lives in lib/scoring/engine.ts so it stays importable
// without a database connection.
import { describe, it, expect } from "vitest";
import { computeCategoryBreakdown } from "../src/lib/scoring/engine";

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
});
