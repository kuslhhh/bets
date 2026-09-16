// Integration: seed content counts. Requires TEST_DATABASE_URL.
import { describe, it, expect, beforeAll } from "vitest";
import { getTestDbStatus } from "./helpers";

const { hasDb, ci } = getTestDbStatus();
if (!hasDb && ci) throw new Error("TEST_DATABASE_URL is required in CI — integration tests must run against the isolated finance_test database");

describe.runIf(hasDb)("seed counts (integration)", () => {
  let prisma: typeof import("../src/lib/prisma").prisma;

  beforeAll(async () => {
    ({ prisma } = await import("../src/lib/prisma"));
  });

  it("has 2 roles and 14 permissions", async () => {
    const roles = await prisma.role.count();
    const perms = await prisma.permission.count();
    expect(roles).toBe(2);
    expect(perms).toBe(14);
  });
  it("has 6 categories, 16 questions, 56 options", async () => {
    const cats = await prisma.category.count();
    const qs = await prisma.question.count();
    const opts = await prisma.questionOption.count();
    expect(cats).toBeGreaterThanOrEqual(6);
    expect(qs).toBeGreaterThanOrEqual(16);
    expect(opts).toBeGreaterThanOrEqual(56);
  });
});
