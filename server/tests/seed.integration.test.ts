import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma";

describe("seed counts", () => {
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
