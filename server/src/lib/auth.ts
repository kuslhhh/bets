import { randomBytes } from "node:crypto";
import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { prisma } from "./prisma.js";
import { unauthenticated, forbidden } from "./errors.js";
import { verifyAccessJWT } from "./jwt.js";
import type { AuthUser } from "@/types/contract";

// --- Sessions (cookie DB sessions) ---

export const SESSION_COOKIE = "fa_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  await prisma.session.create({ data: { sessionToken: token, userId, expires } });
  return { token, expires };
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
  });
  if (!session) return null;
  if (session.expires < new Date()) return null;
  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roleCode: session.user.role.code,
    permissions: session.user.role.rolePermissions.map((rp) => rp.permission.code),
  };
}

export async function destroySession(token: string): Promise<string | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true },
  });
  if (session) {
    await prisma.session.delete({ where: { sessionToken: token } });
    return session.userId;
  }
  return null;
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// --- Auth resolution + guards ---

function getBearerToken(c: import("hono").Context): string | undefined {
  const h = c.req.header("Authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : undefined;
}

export async function getAuthUser(c: import("hono").Context): Promise<AuthUser | null> {
  const bearer = getBearerToken(c);
  if (bearer) {
    const claims = await verifyAccessJWT(bearer);
    if (claims) {
      // Re-resolve role/permissions from the DB so role changes and
      // deactivation take effect without waiting for JWT expiry.
      // (The JWT remains a 1h identity hint; the DB is authoritative.)
      const fresh = await prisma.user.findUnique({
        where: { id: claims.id },
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      });
      if (!fresh || !fresh.isActive) return null;
      return {
        id: fresh.id,
        email: fresh.email,
        name: fresh.name,
        roleCode: fresh.role.code,
        permissions: fresh.role.rolePermissions.map((rp) => rp.permission.code),
      };
    }
  }
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  return getSessionUser(token);
}

/** Require a valid session AND a specific permission code. */
export function requirePermission(code: string): MiddlewareHandler {
  return async (c, next) => {
    const user = await getAuthUser(c);
    if (!user) return unauthenticated(c);
    if (!user.permissions.includes(code)) return forbidden(c);
    c.set("user", user);
    await next();
  };
}
