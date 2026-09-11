import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthUser, requirePermission, revokeAllSessionsForUser } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, forbidden, notFound, unauthenticated, zodDetails } from "../lib/errors";

export const users = new Hono();

// GET /api/roles — must be before /:id
users.get("/roles", requirePermission("users.view"), async (c) => {
  const roles = await prisma.role.findMany({
    include: { rolePermissions: { include: { permission: true } } },
    orderBy: { code: "asc" },
  });
  const data = roles.map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    permissions: r.rolePermissions.map((rp: any) => rp.permission.code),
  }));
  return c.json({ roles: data });
});

users.get("/permissions", requirePermission("users.view"), async (c) => {
  const permissions = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  return c.json({ permissions });
});

// GET /api/users — paginated q/role/isActive
users.get("/", requirePermission("users.view"), async (c) => {
  const url = new URL(c.req.url);
  const q = url.searchParams.get("q")?.trim() ?? null;
  const role = url.searchParams.get("role")?.trim() ?? null;
  const isActiveParam = url.searchParams.get("isActive");
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? 20);
  const pageSize = Number.isNaN(pageSizeRaw) ? 20 : Math.min(100, Math.max(1, pageSizeRaw));

  const where: Record<string, unknown> = {};
  if (q) (where as any).OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (role) (where as any).role = { code: role };
  if (isActiveParam !== null && isActiveParam !== "") {
    if (isActiveParam === "true") (where as any).isActive = true;
    else if (isActiveParam === "false") (where as any).isActive = false;
  }

  const [total, data] = await Promise.all([
    prisma.user.count({ where: where as any }),
    prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, isActive: true, createdAt: true, updatedAt: true, role: { select: { code: true, name: true } } },
    }),
  ]);
  return c.json({ data, page, pageSize, total });
});

// POST /api/users — admin creates user with role (users.manage)
const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  roleCode: z.string().min(1).max(50),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "must contain an uppercase letter")
    .regex(/[a-z]/, "must contain a lowercase letter")
    .regex(/[0-9]/, "must contain a digit"),
});

users.post("/", requirePermission("users.manage"), async (c) => {
  const parsed = createUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));

  const { name, roleCode, password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) return badRequest(c, `unknown roleCode: ${roleCode}`);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return conflict(c, "email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId: role.id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      role: { select: { code: true, name: true } },
    },
  });

  const actor = c.get("user");
  await audit({
    actorId: actor.id,
    action: "users.create",
    entity: "user",
    entityId: user.id,
    metadata: { roleCode },
  });

  return c.json({ user }, 201);
});

// GET /api/users/:id
users.get("/:id", requirePermission("users.view"), async (c) => {
  const id = c.req.param("id");
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true, updatedAt: true, role: { select: { code: true, name: true } } },
  });
  if (!user) return notFound(c);
  // optional assignments summary for admin
  const assignmentsSummary = await prisma.assessmentAssignment.groupBy({
    by: ["status"],
    where: { userId: id },
    _count: { status: true },
  });
  const summary = Object.fromEntries(assignmentsSummary.map((g: any) => [g.status, g._count.status]));
  return c.json({ user: { ...user, assignmentsSummary: summary } });
});

// PATCH /api/users/:id — update name/email/isActive
const patchUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254).optional(),
  isActive: z.boolean().optional(),
});

users.patch("/:id", requirePermission("users.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = patchUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  if (parsed.data.name === undefined && parsed.data.email === undefined && parsed.data.isActive === undefined)
    return badRequest(c, "at least one of name/email/isActive required");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound(c);
  const actor = c.get("user");
  if (parsed.data.isActive === false && actor.id === id) return conflict(c, "cannot deactivate own account");

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.toLowerCase().trim();
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup && dup.id !== id) return conflict(c, "email already exists");
    data.email = email;
  }
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, isActive: true, createdAt: true, updatedAt: true, role: { select: { code: true, name: true } } },
  });

  if (parsed.data.isActive === false) {
    await revokeAllSessionsForUser(id);
  }

  await audit({ actorId: actor.id, action: "users.update", entity: "user", entityId: id, metadata: parsed.data });
  return c.json({ user: updated });
});

// DELETE /api/users/:id — deactivate if history else hard delete
users.delete("/:id", requirePermission("users.manage"), async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound(c);
  const actor = c.get("user");
  if (actor.id === id) return conflict(c, "cannot delete own account");

  const hasHistory = await hasUserHistory(id);
  if (hasHistory) {
    const updated = await prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } });
    await revokeAllSessionsForUser(id);
    await audit({ actorId: actor.id, action: "users.deactivate", entity: "user", entityId: id });
    return c.json({ ok: true, deactivated: true, user: updated });
  }

  await prisma.user.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "users.delete", entity: "user", entityId: id });
  return c.json({ ok: true }, 204 as any);
});

async function hasUserHistory(userId: string): Promise<boolean> {
  const [aCount, auditCount] = await Promise.all([
    prisma.assessmentAssignment.count({ where: { userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);
  if (aCount > 0 || auditCount > 0) return true;
  // Check responses via assignments
  const assignments = await prisma.assessmentAssignment.findMany({ where: { userId }, select: { id: true } });
  if (assignments.length === 0) return false;
  const ids = assignments.map((a) => a.id);
  const rCount = await prisma.response.count({ where: { assignmentId: { in: ids } } });
  if (rCount > 0) return true;
  const tCount = await prisma.textAnswer.count({ where: { assignmentId: { in: ids } } });
  return tCount > 0;
}

// PATCH /api/users/:id/role — change role
const patchRoleSchema = z.object({ roleCode: z.string().min(1).max(50) });

users.patch("/:id/role", requirePermission("users.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = patchRoleSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const { roleCode } = parsed.data;
  const actor = c.get("user");
  if (actor.id === id) return conflict(c, "cannot demote own account");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFound(c);
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) return badRequest(c, `unknown roleCode: ${roleCode}`);

  const updated = await prisma.user.update({
    where: { id },
    data: { roleId: role.id },
    select: { id: true, name: true, email: true, isActive: true, role: { select: { code: true, name: true } } },
  });
  await audit({ actorId: actor.id, action: "users.role_change", entity: "user", entityId: id, metadata: { from: user.roleId, to: roleCode } });
  return c.json({ user: updated });
});
