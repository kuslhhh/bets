import { handle } from "hono/vercel";
import app from "../server/src/app.js";

// Vercel serverless wrapper (Node.js runtime). The Hono app itself lives in
// server/src and is runtime-agnostic; local dev uses Bun (server/src/index.ts).
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
