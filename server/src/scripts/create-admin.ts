// create-admin.ts — Create/rotate the bootstrap admin user explicitly.
// The baseline admin ships in migration 0002_baseline_content; use this script
// to (re)set its password or create additional admins on demand.
//
//   bun run db:admin                        (from repo root; uses .env)
//   bun --env-file=../.env src/scripts/create-admin.ts [email] [password]   (from server/)
//
// Falls back to ADMIN_EMAIL / ADMIN_PASSWORD env vars when args are omitted.

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";

if (!email || !password) {
  console.error(
    "[create-admin] usage: bun run db:admin [email] [password]\n" +
      "  (or set ADMIN_EMAIL / ADMIN_PASSWORD in .env)",
  );
  process.exit(1);
}

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" }, select: { id: true } });
  if (!adminRole) {
    throw new Error("ADMIN role not found — has migration 0002_baseline_content been applied?");
  }

  const hash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash, roleId: adminRole.id, isActive: true },
    create: { email, passwordHash: hash, name: "BETS Admin", roleId: adminRole.id, isActive: true },
  });

  console.log("[create-admin] admin ready:", user.email);
}

main()
  .catch((err) => {
    console.error("[create-admin] FAILED", err);
    process.exit(1);
  })
  .finally(() => process.exit(0)); // pg driver pool keeps the loop alive otherwise
