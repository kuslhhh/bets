import type { PrismaConfig } from "prisma";

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI (migrate) uses DATABASE_URL; runtime uses getDatabaseUrl()
    // which prefers TEST_DATABASE_URL in test/CI for isolation.
    url: process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? "",
  },
} satisfies PrismaConfig;
