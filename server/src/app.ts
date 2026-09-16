import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { users, handleListRoles, handleListPermissions } from "./routes/users";
import { assessments } from "./routes/assessments";
import { questions } from "./routes/questions";
import { assignments } from "./routes/assignments";
import { results } from "./routes/results";
import { dashboard } from "./routes/dashboard";
import { reports } from "./routes/reports";
import { requirePermission } from "./lib/auth";

const app = new Hono().basePath("/api");

app.use("*", cors({ origin: ["http://localhost:5173", "http://localhost:3000"], credentials: true }));
app.use("*", secureHeaders());

app.route("/health", health);
app.route("/auth", auth);
app.route("/account", auth);
app.route("/users", users);
// Spec aliases: GET /api/roles and /api/permissions (in addition to /api/users/roles).
// Handlers live in routes/users.ts — single implementation, no duplicated queries.
app.get("/roles", requirePermission("users.view"), handleListRoles);
app.get("/permissions", requirePermission("users.view"), handleListPermissions);
app.route("/assessments", assessments);
app.route("/questions", questions);
app.route("/", assignments);
app.route("/results", results);
app.route("/dashboard", dashboard);
app.route("/reports", reports);

export default app;
export type AppType = typeof app;
