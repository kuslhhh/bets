import { describe, it, expect } from "vitest";
import { avg2, computeOverallSplit } from "../src/lib/scoring/engine.js";
import { getBand } from "../src/lib/scoring/bands.js";
import { EXPECTED } from "../src/lib/scoring/constants.js";

describe("avg2", () => {
  it("rounds half-up 2dp", () => {
    expect(avg2([100, 75])).toBe(87.5);
    expect(avg2([100, 75, 50])).toBe(75);
    expect(avg2([66.666, 66.666])).toBe(66.67);
  });
  it("handles empty", () => {
    expect(avg2([])).toBe(0);
  });
});

describe("getBand", () => {
  it("band thresholds 75.01/50.01/25.01", () => {
    expect(getBand(100).id).toBe(1);
    expect(getBand(75.01).id).toBe(1);
    expect(getBand(75).id).toBe(2);
    expect(getBand(50.01).id).toBe(2);
    expect(getBand(50).id).toBe(3);
    expect(getBand(25.01).id).toBe(3);
    expect(getBand(25).id).toBe(4);
    expect(getBand(0).id).toBe(4);
  });
  it("expected 75", () => {
    expect(EXPECTED).toBe(75);
  });
});

describe("computeOverallSplit", () => {
  it("mirrors Excel AVERAGEs", () => {
    const self = [87.5, 87.5, 75]; // avg 83.33
    const org = [75, 50, 50]; // avg 58.33
    const overall = computeOverallSplit(self, org);
    expect(overall.overallSelf).toBeCloseTo(83.33, 1);
    expect(overall.overallOrg).toBeCloseTo(58.33, 1);
    expect(overall.overallCombined).toBeCloseTo(70.83, 1);
    expect(overall.minCategoryScore).toBe(50);
    expect(overall.maxCategoryScore).toBe(87.5);
  });
  it("single category produces overall", () => {
    const o = computeOverallSplit([100], []);
    expect(o.overallSelf).toBe(100);
    expect(o.overallOrg).toBe(0);
    expect(o.overallCombined).toBe(100);
  });
});
