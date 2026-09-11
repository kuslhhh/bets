import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthUser, requirePermission } from "../lib/auth";
import { audit } from "../lib/audit";
import { badRequest, conflict, notFound, unauthenticated, zodDetails } from "../lib/errors";

export const assessments = new Hono();

// GET /api/assessments — admin: all, user: published only
assessments.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return unauthenticated(c);

  const url = new URL(c.req.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const isAdmin = user.permissions.includes("assessments.manage");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (!isAdmin) {
    // Users see only PUBLISHED
    where.status = "PUBLISHED";
  }

  const [total, data] = await Promise.all([
    prisma.assessment.count({ where: where as never }),
    prisma.assessment.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, type: true, status: true, title: true, description: true, openAt: true, closeAt: true, publishedAt: true, createdAt: true, updatedAt: true },
    }),
  ]);

  return c.json({ data, page, pageSize, total });
});

// POST /api/assessments — create draft
const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.string().min(1).max(50).optional(),
});

assessments.post("/", requirePermission("assessments.manage"), async (c) => {
  const parsed = createAssessmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const user = c.get("user");
  const assessment = await prisma.assessment.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type ?? "FINANCIAL_MATURITY",
      status: "DRAFT",
      createdBy: user.id,
    },
  });
  await audit({ actorId: user.id, action: "assessments.create", entity: "assessment", entityId: assessment.id });
  return c.json({ assessment }, 201);
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

// POST /api/assessments/:id/publish — validate completeness → PUBLISHED
assessments.post("/:id/publish", requirePermission("assessments.manage"), async (c) => {
  const id = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      sections: { include: { questions: { include: { options: true } } } },
    },
  });
  if (!assessment) return notFound(c);
  if (assessment.status === "PUBLISHED") return c.json({ assessment });
  if (assessment.status !== "DRAFT") return conflict(c, "only DRAFT can be published");

  const errors: string[] = [];
  if (assessment.sections.length === 0) errors.push("at least one section required");
  const allQuestions = assessment.sections.flatMap((s) => s.questions);
  const scored = allQuestions.filter((q) => q.type === "SINGLE_SELECT");
  if (scored.length === 0) errors.push("at least one scored question required");
  for (const q of scored) {
    if (q.options.length < 2) errors.push(`question ${q.id} needs at least 2 options`);
  }
  if (errors.length) return conflict(c, errors);

  const updated = await prisma.assessment.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  const user = c.get("user");
  await audit({ actorId: user.id, action: "assessments.publish", entity: "assessment", entityId: id });
  return c.json({ assessment: updated });
});

// POST /api/assessments/:id/close
assessments.post("/:id/close", requirePermission("assessments.manage"), async (c) => {
  const id = c.req.param("id");
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment) return notFound(c);
  if (assessment.status === "CLOSED") return c.json({ assessment });
  if (assessment.status !== "PUBLISHED") return conflict(c, "only PUBLISHED can be closed");
  const updated = await prisma.assessment.update({ where: { id }, data: { status: "CLOSED" } });
  const user = c.get("user");
  await audit({ actorId: user.id, action: "assessments.close", entity: "assessment", entityId: id });
  return c.json({ assessment: updated });
});

// POST /api/assessments/:id/sections — create section
const createSectionSchema = z.object({ title: z.string().min(1).max(200), order: z.number().int().min(0).optional(), description: z.string().max(2000).optional().nullable() });
assessments.post("/:id/sections", requirePermission("assessments.manage"), async (c) => {
  const id = c.req.param("id");
  const parsed = createSectionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment) return notFound(c);
  if (assessment.status === "PUBLISHED") return conflict(c, "assessment is PUBLISHED — structure frozen");
  const count = await prisma.section.count({ where: { assessmentId: id } });
  const section = await prisma.section.create({ data: { assessmentId: id, title: parsed.data.title, order: parsed.data.order ?? count + 1, description: parsed.data.description ?? null } });
  await audit({ actorId: c.get("user").id, action: "sections.create", entity: "section", entityId: section.id });
  return c.json({ section }, 201);
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
          .filter((q) => q.status === "ACTIVE" || q.status === "DRAFT")
          .map((q) => ({ ...q, options: q.options.map((o) => ({ id: o.id, label: o.label, optionText: o.optionText, order: o.order })) })),
      }))
    : sections;
  return c.json({ sections: filtered as never });
});

// POST /api/assessments/sections/:id/categories — create category
assessments.post("/sections/:id/categories", requirePermission("assessments.manage"), async (c) => {
  const sectionId = c.req.param("id");
  const parsed = z.object({ name: z.string().min(1).max(200), order: z.number().int().min(0).optional(), description: z.string().max(2000).optional().nullable() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, zodDetails(parsed.error));
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { assessment: true } });
  if (!section) return notFound(c);
  if (section.assessment.status === "PUBLISHED") return conflict(c, "assessment is PUBLISHED — structure frozen");
  const count = await prisma.category.count({ where: { sectionId } });
  const category = await prisma.category.create({ data: { sectionId, name: parsed.data.name, order: parsed.data.order ?? count + 1, description: parsed.data.description ?? null } });
  await audit({ actorId: c.get("user").id, action: "categories.create", entity: "category", entityId: category.id });
  return c.json({ category }, 201);
});
