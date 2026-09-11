import { randomBytes } from "node:crypto";
import { getCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import { prisma } from "./prisma";
import { unauthenticated, forbidden, notFound } from "./errors";
import { verifyAccessJWT } from "./jwt";
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
      return {
        id: claims.id,
        email: claims.email,
        name: claims.name,
        roleCode: claims.role,
        permissions: claims.permissions,
      };
    }
  }
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  return getSessionUser(token);
}

/** Require a valid session; sets c.set("user"). 401 otherwise. */
export const requireSession: MiddlewareHandler = async (c, next) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  c.set("user", user);
  await next();
};

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

// --- Scope helpers ---

export async function ownsAssignment(userId: string, assignmentId: string): Promise<boolean> {
  const a = await prisma.assessmentAssignment.findUnique({
    where: { id: assignmentId },
    select: { userId: true },
  });
  return a?.userId === userId;
}

export async function canViewResult(viewer: AuthUser, assignmentId: string): Promise<boolean> {
  const result = await prisma.assessmentResult.findUnique({
    where: { assignmentId },
    select: { assignment: { select: { userId: true } } },
  });
  if (!result) return false;
  if (result.assignment.userId === viewer.id) return viewer.permissions.includes("results.self.view");
  return viewer.permissions.includes("results.individual.view");
}

export { notFound };
