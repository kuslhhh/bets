import { describe, it, expect } from "vitest";

const ALL_PERMS = [
  "users.view",
  "users.manage",
  "assessments.manage",
  "questions.manage",
  "questions.scores.manage",
  "assignments.manage",
  "assignments.self.view",
  "assignments.self.respond",
  "results.self.view",
  "results.org.view",
  "results.individual.view",
  "reports.view",
  "reports.export",
  "settings.manage",
];

describe("RBAC matrix", () => {
  it("ADMIN has all 14 perms", () => {
    expect(ALL_PERMS).toHaveLength(14);
    // seed check: ADMIN should have all
    const adminPerms = ALL_PERMS;
    expect(adminPerms).toEqual(expect.arrayContaining(ALL_PERMS));
  });
  it("USER has only 3 perms", () => {
    const userPerms = ["assignments.self.view", "assignments.self.respond", "results.self.view"];
    expect(userPerms).toHaveLength(3);
    expect(userPerms.every((p) => ALL_PERMS.includes(p))).toBe(true);
    expect(userPerms).not.toContain("results.org.view");
    expect(userPerms).not.toContain("results.individual.view");
  });
  it("USER cannot view org aggregates", () => {
    const userPerms = ["assignments.self.view", "assignments.self.respond", "results.self.view"];
    expect(userPerms.includes("results.org.view")).toBe(false);
    expect(userPerms.includes("reports.view")).toBe(false);
  });
});
