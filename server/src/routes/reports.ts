import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { getAuthUser } from "../lib/auth";
import { audit } from "../lib/audit";
import { unauthenticated, forbidden } from "../lib/errors";

export const reports = new Hono();

// GET /api/reports?assessmentId&from&to&format=json|csv — admin reports.view/export
reports.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  if (!user.permissions.includes("reports.view")) return forbidden(c);

  const url = new URL(c.req.url);
  const assessmentId = url.searchParams.get("assessmentId");
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");
  const period = url.searchParams.get("period");
  if (period && !from) {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
    if (days) from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }
  const format = url.searchParams.get("format") ?? "json";

  const where: Record<string, unknown> = { status: "SUBMITTED" };
  if (assessmentId) (where as any).assessmentId = assessmentId;
  if (from || to) {
    (where as any).submittedAt = {};
    if (from) (where as any).submittedAt.gte = new Date(from);
    if (to) (where as any).submittedAt.lte = new Date(to);
  }

  const assignments = await prisma.assessmentAssignment.findMany({
    where: where as never,
    include: {
      user: { select: { id: true, name: true, email: true } },
      result: true,
      assessment: { select: { title: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const canSeeIndividual = user.permissions.includes("results.individual.view");
  const rows = assignments.map((a: any) => ({
    assignmentId: a.id,
    assessmentId: a.assessmentId,
    assessmentTitle: a.assessment.title,
    userId: canSeeIndividual ? a.user.id : undefined,
    userName: canSeeIndividual ? a.user.name : undefined,
    userEmail: canSeeIndividual ? a.user.email : undefined,
    status: a.status,
    submittedAt: a.submittedAt,
    overallSelf: a.result?.overallSelf ? Number(a.result.overallSelf) : null,
    overallOrg: a.result?.overallOrg ? Number(a.result.overallOrg) : null,
    overallCombined: a.result?.overallCombined ? Number(a.result.overallCombined) : null,
  }));

  if (format === "csv") {
    if (!user.permissions.includes("reports.export")) return forbidden(c);
    const header = ["assignmentId", "assessmentTitle", "submittedAt", "overallSelf", "overallOrg", "overallCombined"];
    if (canSeeIndividual) header.splice(1, 0, "userEmail", "userName");
    const lines = [header.join(",")];
    for (const r of rows) {
      const cols: (string | number | null)[] = [];
      if (canSeeIndividual) cols.push(r.assignmentId, r.userEmail ?? "", r.userName ?? "", r.assessmentTitle, r.submittedAt?.toISOString() ?? "", String(r.overallSelf ?? ""), String(r.overallOrg ?? ""), String(r.overallCombined ?? ""));
      else cols.push(r.assignmentId, r.assessmentTitle, r.submittedAt?.toISOString() ?? "", String(r.overallSelf ?? ""), String(r.overallOrg ?? ""), String(r.overallCombined ?? ""));
      lines.push(cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    await audit({ actorId: user.id, action: "reports.export", entity: "report", metadata: { format: "csv", assessmentId, from, to } });
    return c.text(lines.join("\n"), 200, { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=report.csv" });
  }

  await audit({ actorId: user.id, action: "reports.view", entity: "report", metadata: { format, assessmentId, from, to } });
  return c.json({ data: rows, total: rows.length });
});
