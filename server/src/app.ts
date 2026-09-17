import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { health } from "./routes/health.js";
import { auth } from "./routes/auth.js";
import { users, handleListRoles, handleListPermissions } from "./routes/users.js";
import { assessments } from "./routes/assessments.js";
import { questions } from "./routes/questions.js";
import { assignments } from "./routes/assignments.js";
import { results } from "./routes/results.js";
import { dashboard } from "./routes/dashboard.js";
import { reports } from "./routes/reports.js";
import { requirePermission } from "./lib/auth.js";

const app = new Hono().basePath("/api");

const allowedOrigins = ["http://localhost:5173", "http://localhost:3000", process.env.APP_URL].filter(Boolean) as string[];
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (allowedOrigins.includes(origin)) return origin;
      if (origin.endsWith(".vercel.app")) return origin;
      return "";
    },
    credentials: true,
  }),
);
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
