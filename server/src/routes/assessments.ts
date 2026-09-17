import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getAuthUser, requirePermission } from "../lib/auth.js";
import { audit } from "../lib/audit.js";
import { badRequest, notFound, unauthenticated, zodDetails } from "../lib/errors.js";

export const assessments = new Hono();

const SINGLETON_ID = "asmt_finance_v1";

// GET /api/assessments — single assessment mode (ignores pagination/filters, always returns singleton if exists)
assessments.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const assessment = await prisma.assessment.findUnique({
    where: { id: SINGLETON_ID },
    select: { id: true, type: true, status: true, title: true, description: true, openAt: true, closeAt: true, publishedAt: true, createdAt: true, updatedAt: true },
  });
  const data = assessment ? [assessment] : [];
  return c.json({ data, page: 1, pageSize: 1, total: data.length });
});

// POST /api/assessments — disabled in single-assessment mode (DB kept)
assessments.post("/", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Creation disabled — single assessment only" }, 410);
});

// GET /api/assessments/:id — detail + tree
assessments.get("/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const id = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          categories: { orderBy: { order: "asc" } },
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } }, category: true },
          },
        },
      },
    },
  });
  if (!assessment) return notFound(c);
  const isAdmin = user.permissions.includes("assessments.manage");
  if (!isAdmin && assessment.status !== "PUBLISHED") return notFound(c);
  if (!isAdmin) {
    // Strip scoreValue for users
    (assessment as any).sections = (assessment as any).sections.map((s: any) => ({
      ...s,
      questions: s.questions.map((q: any) => ({
        ...q,
        options: q.options.map((o: any) => ({ id: o.id, label: o.label, optionText: o.optionText, order: o.order })),
      })),
    }));
  }
  return c.json({ assessment });
});

// PATCH /api/assessments/:id — edit draft fields (text/order allowed on published)
const patchAssessmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  openAt: z.string().datetime().optional().nullable(),
  closeAt: z.string().datetime().optional().nullable(),
});

assessments.patch("/:id", requirePermission("assessments.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = patchAssessmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const existing = await prisma.assessment.findUnique({ where: { id } });
  if (!existing) return notFound(c);
  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.openAt !== undefined) data.openAt = parsed.data.openAt ? new Date(parsed.data.openAt) : null;
  if (parsed.data.closeAt !== undefined) data.closeAt = parsed.data.closeAt ? new Date(parsed.data.closeAt) : null;

  const updated = await prisma.assessment.update({ where: { id }, data });
  const user = c.get("user");
  await audit({ actorId: user.id, action: "assessments.update", entity: "assessment", entityId: id });
  return c.json({ assessment: updated });
});

// POST /api/assessments/:id/publish — disabled (single assessment stays PUBLISHED)
assessments.post("/:id/publish", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Lifecycle disabled — single assessment only" }, 410);
});

// POST /api/assessments/:id/close — disabled
assessments.post("/:id/close", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Lifecycle disabled — single assessment only" }, 410);
});

// POST /api/assessments/:id/archive — disabled
assessments.post("/:id/archive", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Lifecycle disabled — single assessment only" }, 410);
});

// POST /api/assessments/:id/sections — disabled (structure frozen)
assessments.post("/:id/sections", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Structure frozen — single assessment only" }, 410);
});

// GET /api/assessments/:id/questions — tree (admin all, user ACTIVE only, strip scores)
assessments.get("/:id/questions", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);
  const assessmentId = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return notFound(c);
  const isAdmin = user.permissions.includes("assessments.manage") || user.permissions.includes("questions.manage");
  if (!isAdmin && assessment.status !== "PUBLISHED") return notFound(c);
  const sections = await prisma.section.findMany({
    where: { assessmentId },
    orderBy: { order: "asc" },
    include: {
      categories: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } }, category: true } },
    },
  });
  const filtered = !isAdmin
    ? sections.map((s) => ({
        ...s,
        questions: s.questions
          .filter((q) => q.status === "ACTIVE")
          .map((q) => ({ ...q, options: q.options.map((o) => ({ id: o.id, label: o.label, optionText: o.optionText, order: o.order })) })),
      }))
    : sections;
  return c.json({ sections: filtered as never });
});

// POST /api/assessments/sections/:id/categories — disabled (structure frozen)
assessments.post("/sections/:id/categories", requirePermission("assessments.manage"), async (c) => {
  return c.json({ error: "single_assessment_mode", details: "Structure frozen — single assessment only" }, 410);
});
