// HTTP error envelope — { error: code, details? }
import type { Context } from "hono";

export type ErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "unauthorised"
  | "not_found"
  | "conflict"
  | "locked"
  | "internal_error";

export function errorResponse(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 423 | 500,
  code: ErrorCode,
  details?: unknown,
) {
  return c.json({ error: code, ...(details === undefined ? {} : { details }) }, status);
}

export const badRequest = (c: Context, details?: unknown) => errorResponse(c, 400, "validation_error", details);
export const unauthenticated = (c: Context) => errorResponse(c, 401, "unauthenticated");
export const forbidden = (c: Context) => errorResponse(c, 403, "unauthorised");
export const notFound = (c: Context) => errorResponse(c, 404, "not_found");
export const conflict = (c: Context, details?: unknown) => errorResponse(c, 409, "conflict", details);
export const locked = (c: Context) => errorResponse(c, 423, "locked");

export function zodDetails(err: { issues: { path: PropertyKey[]; message: string }[] }) {
  return err.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}
