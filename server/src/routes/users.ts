import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requirePermission, revokeAllSessionsForUser } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, notFound, zodDetails } from "../lib/errors";
import { parsePagination } from "../lib/pagination";
import { passwordSchema, hashPassword } from "../lib/password";

export const users = new Hono();

// Shared catalogue handlers — single implementation used by both
// /api/users/roles|permissions and the spec aliases /api/roles|permissions
// (mounted in app.ts). Keeps both URLs without duplicating queries.
export async function handleListRoles(c: import("hono").Context) {
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
}

export async function handleListPermissions(c: import("hono").Context) {
  const permissions = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  return c.json({ permissions });
}

// GET /api/roles — must be before /:id
users.get("/roles", requirePermission("users.view"), handleListRoles);

users.get("/permissions", requirePermission("users.view"), handleListPermissions);

// GET /api/users — paginated q/role/isActive
users.get("/", requirePermission("users.view"), async (c) => {
  const url = new URL(c.req.url);
  const q = url.searchParams.get("q")?.trim() ?? null;
  const role = url.searchParams.get("role")?.trim() ?? null;
  const isActiveParam = url.searchParams.get("isActive");
  const { page, pageSize } = parsePagination(url);

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
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { code: true, name: true } },
        phoneNumber: true,
        designation: true,
        companyName: true,
        industryType: true,
        natureOfWork: true,
        revenueBracket: true,
        product: true,
      },
    }),
  ]);
  return c.json({ data, page, pageSize, total });
});

// POST /api/users — admin creates user with role (users.manage)
const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  roleCode: z.string().min(1).max(50),
  password: passwordSchema,
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

  const passwordHash = await hashPassword(password);
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
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { code: true, name: true } },
      phoneNumber: true,
      designation: true,
      companyName: true,
      industryType: true,
      natureOfWork: true,
      revenueBracket: true,
      product: true,
    },
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

// PATCH /api/users/:id — update name/email/isActive + profile fields
const patchUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254).optional(),
  isActive: z.boolean().optional(),
  phoneNumber: z.string().max(20).optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  industryType: z.string().max(100).optional().nullable(),
  natureOfWork: z.string().max(100).optional().nullable(),
  revenueBracket: z.string().max(50).optional().nullable(),
  product: z.string().max(200).optional().nullable(),
});

users.patch("/:id", requirePermission("users.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = patchUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  if (
    parsed.data.name === undefined &&
    parsed.data.email === undefined &&
    parsed.data.isActive === undefined &&
    parsed.data.phoneNumber === undefined &&
    parsed.data.designation === undefined &&
    parsed.data.companyName === undefined &&
    parsed.data.industryType === undefined &&
    parsed.data.natureOfWork === undefined &&
    parsed.data.revenueBracket === undefined &&
    parsed.data.product === undefined
  )
    return badRequest(c, "at least one field required");

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
  if (parsed.data.phoneNumber !== undefined) data.phoneNumber = parsed.data.phoneNumber?.trim() || null;
  if (parsed.data.designation !== undefined) data.designation = parsed.data.designation?.trim() || null;
  if (parsed.data.companyName !== undefined) data.companyName = parsed.data.companyName?.trim() || null;
  if (parsed.data.industryType !== undefined) data.industryType = parsed.data.industryType?.trim() || null;
  if (parsed.data.natureOfWork !== undefined) data.natureOfWork = parsed.data.natureOfWork?.trim() || null;
  if (parsed.data.revenueBracket !== undefined) data.revenueBracket = parsed.data.revenueBracket?.trim() || null;
  if (parsed.data.product !== undefined) data.product = parsed.data.product?.trim() || null;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { code: true, name: true } },
      phoneNumber: true,
      designation: true,
      companyName: true,
      industryType: true,
      natureOfWork: true,
      revenueBracket: true,
      product: true,
    },
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
  // Existence-style checks (take:1) — was 4 sequential counts + full id load.
  // Responses/textAnswers can't outlive their assignment (CASCADE), and
  // assignments can't outlive their user (RESTRICT), so an assignment row
  // alone proves answer history — no need to count answer tables.
  const [assignment, log] = await Promise.all([
    prisma.assessmentAssignment.findFirst({ where: { userId }, select: { id: true } }),
    prisma.auditLog.findFirst({ where: { actorId: userId }, select: { id: true } }),
  ]);
  if (assignment || log) return true;
  return false;
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
