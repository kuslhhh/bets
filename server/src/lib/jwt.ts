import { sign, verify } from "hono/jwt";
import type { AuthUser } from "@/types/contract";

const SECRET = process.env.AUTH_SECRET ?? "__placeholder__";

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
    SECRET,
  );
}

export async function verifyAccessJWT(token: string): Promise<AccessTokenClaims | null> {
  try {
    const payload = await verify(token, SECRET, "HS256");
    if (typeof payload.sub !== "string" || !Array.isArray(payload.permissions)) return null;
    return {
      id: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "",
      permissions: (payload.permissions as unknown[]).filter((p): p is string => typeof p === "string"),
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}
