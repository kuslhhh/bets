import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { users } from "./routes/users";
import { assessments } from "./routes/assessments";
import { questions } from "./routes/questions";
import { assignments } from "./routes/assignments";
import { results } from "./routes/results";
import { dashboard } from "./routes/dashboard";
import { reports } from "./routes/reports";
import { prisma } from "./lib/prisma";
import { requirePermission } from "./lib/auth";

const app = new Hono().basePath("/api");

app.use("*", cors({ origin: ["http://localhost:5173", "http://localhost:3000"], credentials: true }));
app.use("*", secureHeaders());

app.route("/health", health);
app.route("/auth", auth);
app.route("/account", auth);
app.route("/users", users);
// Spec aliases: GET /api/roles and /api/permissions (in addition to /api/users/roles)
app.get("/roles", requirePermission("users.view"), async (c) => {
  const roles = await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } }, orderBy: { code: "asc" } });
  return c.json({ roles: roles.map((r: any) => ({ id: r.id, code: r.code, name: r.name, description: r.description, permissions: r.rolePermissions.map((rp: any) => rp.permission.code) })) });
});
app.get("/permissions", requirePermission("users.view"), async (c) => {
  const permissions = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  return c.json({ permissions });
});
app.route("/assessments", assessments);
app.route("/questions", questions);
app.route("/", assignments);
app.route("/results", results);
app.route("/dashboard", dashboard);
app.route("/reports", reports);

export default app;
export type AppType = typeof app;
