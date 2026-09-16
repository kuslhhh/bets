# AGENTS.md — finance-assessment

Spec source of truth is `PROJECT.md` (Excel-derived scoring/RBAC/schema). Trust it over guesswork; `PROJECT.md` §2 marks what is DIRECT vs INFERENCE.

## Commands (run from repo root, Bun workspace)

- `bun run dev:server` — Bun hot-reload API on `$PORT` (root `.env`, default 3001)
- `bun run dev:client` — Vite SPA on 5173
- `bun run db:up` first — Postgres 16 on host port **5433** (not 5432)
- `bun run db:migrate` / `db:deploy` / `db:reset` / `db:studio` — Prisma
- `bun run db:admin` — create/reset the bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (or args); there is **no seed** — baseline roles/permissions/Finance v1 content ship in migration `0002_seed_content`
- `bun run typecheck` — `tsc --noEmit` in `server/`; `bun run test` — `vitest run` in `server/` (currently zero test files)

## Env / DB quirks

- Env lives at repo-root `.env` only (`server/.gitignore` ignores `server/.env`). Root scripts inject it via `bun --env-file=...`; running `prisma` manually from `server/` needs `bun --env-file=../.env prisma ...`.
- `DATABASE_URL` → `finance_dev`, `TEST_DATABASE_URL` → `finance_test` (auto-created by `docker/init.sql` on container init). `DIRECT_URL` = non-pooled connection for `migrate deploy`.
- No SMTP in dev is normal: `server/lib/email.ts` logs reset links to console when `SMTP_HOST` is unset.

## Architecture (modular monolith)

- `server/app.ts` — Hono app with `.basePath("/api")`; add routes in `server/routes/` + `app.route(...)`. Entry: `server/index.ts` (Bun, local) vs `api/[[...route]].ts` (Vercel Node, prod).
- **No Bun-only APIs in `server/`** — prod runs on Vercel Node serverless. Use portable libs (e.g. Nodemailer, `server/lib/prisma.ts` singleton works on both).
- `server/prisma/schema.prisma` — ~16 tables (sessions/verification_tokens etc.); Prisma 7: datasource URL comes from `server/prisma.config.ts`, not the schema.
- `client/` is a backend-first placeholder (`App.tsx` stub, `VITE_API_URL` in `client/.env`); per `PROJECT.md` §22 don't build UI until backend APIs pass.
- `client/.env` and root `.env` are both git-tracked dev defaults; never commit real secrets.

## Conventions / gotchas

- AuthZ = `role_permissions` join checked server-side on every request, never role name alone; assignment/scope check applies on top (`PROJECT.md` §4 — 2 roles: `ADMIN`/`USER` only).
- Registration is **public**: `POST /api/auth/register` creates `USER` only; admin is the single seeded `ADMIN` (`ADMIN_EMAIL`), role promotion only via `PATCH /users/:id/role` if recovery needed. No invite flow.
- Taking is **self-serve**: any authed `USER` can start a `PUBLISHED` assessment without admin assignment — assignment row is auto-created on first `start`/`save`; `POST /assessments/:id/assign` remains optional for admin bulk-assign.
- Analytics are **admin-only**: `results.org.view`/`reports.*` gated to `ADMIN`; users see own results only (`results.self.view` / `GET /api/my-assessments`).
- Scoring is backend-only: option scores fixed {100,75,50,25} (`d`=25 opt-out still scores), category = AVG of questions, overall = AVG of category AVGs; snapshot `score_value` into `responses` at write time, results immutable.
- Frozen structure: once an assessment is `PUBLISHED`, allow text/order edits only — no add/remove/retype of questions/options (return 409; new assessment instead).
- Preserve Excel verbatim quirks in `source_text` (`Knowladge`, S2-Q16 numbering) with normalized display names alongside.
