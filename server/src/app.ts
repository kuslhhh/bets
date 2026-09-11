import { Hono } from "hono";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { users } from "./routes/users";
import { assessments } from "./routes/assessments";
import { questions } from "./routes/questions";
import { assignments } from "./routes/assignments";

const app = new Hono().basePath("/api");

app.route("/health", health);
app.route("/auth", auth);
app.route("/users", users);
app.route("/assessments", assessments);
app.route("/questions", questions);
app.route("/", assignments);

export default app;
export type AppType = typeof app;
