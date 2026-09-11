import { Hono } from "hono";
import { createHash, randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getAuthUser,
} from "../lib/auth";
import { audit } from "../lib/audit";
import { sendPasswordResetEmail, PASSWORD_RESET_TOKEN_TTL_MINUTES } from "../lib/email";
import { mintAccessJWT } from "../lib/jwt";
import { badRequest, conflict, unauthenticated, locked, zodDetails } from "../lib/errors";
import { rateLimit } from "../lib/rate-limit";

export const auth = new Hono();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "must contain an uppercase letter")
    .regex(/[a-z]/, "must contain a lowercase letter")
    .regex(/[0-9]/, "must contain a digit"),
});

auth.post("/register", rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "register" }), async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));

  const email = parsed.data.email.toLowerCase().trim();
  const { name, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return conflict(c, "email already exists");

  const role = await prisma.role.findUnique({ where: { code: "USER" } });
  if (!role) return badRequest(c, "USER role not found — run migrations");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId: role.id },
    select: { id: true, name: true, email: true, createdAt: true, role: { select: { code: true } } },
  });

  await audit({ actorId: user.id, action: "auth.register", entity: "user", entityId: user.id });

  return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role.code } }, 201);
});

const loginSchema = z.object({ email: z.string().min(3).max(254), password: z.string().min(1) });

auth.post("/login", rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "login" }), async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "email and password are required");

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        select: {
          code: true,
          rolePermissions: { select: { permission: { select: { code: true } } } },
        },
      },
    },
  });

  // Generic 401 for unknown user / inactive / locked — no enumeration.
  if (!user || !user.isActive) return unauthenticated(c);
  if (user.lockedUntil && user.lockedUntil > new Date()) return locked(c);

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    if (lock) return locked(c);
    return unauthenticated(c);
  }

  const { token } = await createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // No `secure` in dev (http://localhost:3001); enable behind HTTPS in prod.
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({ actorId: user.id, action: "auth.login", entity: "user", entityId: user.id });

  const accessToken = await mintAccessJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    roleCode: user.role.code,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
  });

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role.code },
    accessToken,
  });
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const userId = await destroySession(token);
    if (userId) {
      await audit({ actorId: userId, action: "auth.logout", entity: "session", entityId: token });
    }
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);

  const accessToken = await mintAccessJWT(user);

  return c.json({
    user: { id: user.id, name: user.name, email: user.email },
    role: user.roleCode,
    permissions: user.permissions,
    accessToken,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "must contain an uppercase letter")
    .regex(/[a-z]/, "must contain a lowercase letter")
    .regex(/[0-9]/, "must contain a digit"),
});

auth.post("/password", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);

  const parsed = changePasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "currentPassword and a strong newPassword are required");

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return unauthenticated(c);

  const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!valid) return unauthenticated(c);

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const currentToken = c.req.header("cookie")?.match(/fa_session=([^;]+)/)?.[1];
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    // revoke other sessions, keep current one if present
    if (currentToken) await tx.session.deleteMany({ where: { userId: user.id, NOT: { sessionToken: currentToken } } });
    else await tx.session.deleteMany({ where: { userId: user.id } });
  });
  await audit({ actorId: user.id, action: "auth.password_changed", entity: "user", entityId: user.id });

  return c.json({ ok: true });
});

const forgotPassSchema = z.object({ email: z.string().min(3).max(254) });

auth.post("/forgot-password", rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "forgot" }), async (c) => {
  const parsed = forgotPassSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "valid email required");

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Invalidate prior tokens for this identifier.
    await prisma.verificationToken.deleteMany({ where: { identifier: `password-reset:${email}` } });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    await prisma.verificationToken.create({
      data: {
        identifier: `password-reset:${email}`,
        token: tokenHash,
        expires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000),
      },
    });

    await sendPasswordResetEmail(email, token);
    await audit({ actorId: user.id, action: "auth.forgot_password", entity: "user", entityId: user.id });
  }

  return c.json({ ok: true });
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "must contain an uppercase letter")
    .regex(/[a-z]/, "must contain a lowercase letter")
    .regex(/[0-9]/, "must contain a digit"),
});

auth.post("/reset-password", rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "reset" }), async (c) => {
  const parsed = resetPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, "token and a strong newPassword are required");

  const { token, newPassword } = parsed.data;
  const tokenHash = sha256Hex(token);

  const match = await prisma.verificationToken.findFirst({ where: { token: tokenHash } });
  if (!match || match.expires < new Date()) {
    return badRequest(c, "invalid or expired reset token");
  }

  const email = match.identifier.replace(/^password-reset:/, "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return badRequest(c, "invalid or expired reset token");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: match.identifier } }),
    prisma.session.deleteMany({ where: { userId: user.id } }), // revoke sessions
  ]);

  await audit({ actorId: user.id, action: "auth.reset_password", entity: "user", entityId: user.id });
  return c.json({ ok: true });
});

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
