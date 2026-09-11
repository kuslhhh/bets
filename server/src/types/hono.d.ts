import type { AuthUser } from "./contract";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}
