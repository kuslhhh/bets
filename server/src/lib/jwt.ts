import { sign, verify } from "hono/jwt";
import type { AuthUser } from "@/types/contract";
import { getAuthSecret, requireAuthSecret } from "./config";

export interface AccessTokenClaims {
  id: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
}

export async function mintAccessJWT(
  user: Pick<AuthUser, "id" | "roleCode" | "permissions" | "name" | "email">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.roleCode,
      permissions: user.permissions,
      iat: now,
      exp: now + 60 * 60,
    },
    requireAuthSecret(),
  );
}

export async function verifyAccessJWT(token: string): Promise<AccessTokenClaims | null> {
  let secret: string;
  try {
    secret = requireAuthSecret();
  } catch (err) {
    // In production without a real AUTH_SECRET, fail closed — never verify with placeholder
    if (process.env.NODE_ENV === "production") throw err;
    secret = getAuthSecret();
  }
  try {
    const payload = await verify(token, secret, "HS256");
    if (typeof payload.sub !== "string" || !Array.isArray(payload.permissions)) return null;
    return {
      id: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "",
      permissions: (payload.permissions as unknown[]).filter((p): p is string => typeof p === "string"),
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch (err) {
    // Keep useful production logging without leaking token/secret
    if (process.env.NODE_ENV === "production") {
      const msg = err instanceof Error ? err.message : String(err);
      // hono/jwt throws "JwtTokenExpired" etc. — log at warn, not error, and never log token
      if (!msg.includes("expired")) console.warn("[auth] JWT verify failed:", msg.slice(0, 120));
    }
    return null;
  }
}
