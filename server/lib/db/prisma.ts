import { PrismaClient } from "@prisma/client";

// PrismaClient singleton: safe under Bun dev hot-reload and Node.js serverless.
// Datasource URLs come from env (DATABASE_URL / DIRECT_URL) — never hardcoded.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
