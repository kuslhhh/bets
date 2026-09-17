import { prisma } from "./prisma.js";

// Audit helper — never throws.
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("[audit] write failed", entry.action, err);
  }
}
