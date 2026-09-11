import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requirePermission } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, zodDetails } from "../lib/errors";

export const users = new Hono();

// POST /api/users — admin creates user with role (users.manage)

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  roleCode: z.string().min(1).max(50),
  // Same strength rules as reset-password (PROJECT.md §9).
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