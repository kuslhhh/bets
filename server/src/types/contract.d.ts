// Shared contract: the shape of an authenticated user as resolved from a DB
// session (id, email, name, role code, permission codes). Imported by both
// session.ts and guards.ts so they don't import each other.
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleCode: string;
  permissions: string[];
}
  