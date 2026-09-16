// Single error-to-message formatter (was copy-pasted in 5 route files).
import { ApiError } from "./api";

export function toMessage(e: unknown): string {
  if (e instanceof ApiError) return `${e.code}: ${JSON.stringify(e.details)}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
