import { handle } from "hono/vercel";
import app from "../../server/app";

// Vercel serverless wrapper (Node.js runtime). The Hono app itself lives in
// server/ and is runtime-agnostic; local dev uses Bun (server/index.ts).
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
