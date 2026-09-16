import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "./config";

// PrismaClient singleton — works under Bun hot-reload and Vercel Node.
// Lazy init: constructing PrismaPg at import time would throw when
// DATABASE_URL is missing and break pure unit tests (no DB needed).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; _prismaInst?: PrismaClient };

function createClient(): PrismaClient {
  if (globalForPrisma._prismaInst) return globalForPrisma._prismaInst;
  const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma._prismaInst = client;
  // Also keep `prisma` alias for older hot-reload checks
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// Proxy that defers client creation until first property access.
// This lets unit tests import `prisma` without DATABASE_URL being set.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = globalForPrisma._prismaInst ?? globalForPrisma.prisma ?? createClient();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
