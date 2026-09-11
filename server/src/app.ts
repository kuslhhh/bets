import { Hono } from "hono";
import { health } from "./routes/health";

const app = new Hono().basePath("/api");

app.route("/health", health);

export default app;
export type AppType = typeof app;
