import { handle } from "hono/vercel";
import app from "../../../server/src/app.js";

// Single Hono app serves the whole API; this file only binds the route path.
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
