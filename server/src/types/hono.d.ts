import type { AuthUser } from "./contract.js";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}
