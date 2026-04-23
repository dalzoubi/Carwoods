# apps/api — Claude scope

Azure Functions v4 (TypeScript) for the tenant portal. Runs on the Function App in Azure resource group **`carwoods.com`**. Shared code lives in `packages/domain` and `packages/config`.

## Commands

| Task | Command |
|---|---|
| Build this workspace | `npm run build --prefix apps/api` (or from root: `npm run build:api`) |
| Tests | from `apps/api`: `npm test` |

## Route safety — always check before adding/changing `app.http` routes

A static path like `portal/notifications/delete` can **404 or never match** if it competes with a parameterized route such as `portal/notifications/{id}`. Azure may not resolve static vs. parameter segments the way you expect, especially when methods overlap.

**Preferred patterns:**

1. If **GET** already exists on a **collection** route (e.g. `portal/notifications`), add another HTTP verb on the **same** route when it avoids ambiguity — e.g. bulk delete as `PATCH /api/portal/notifications` with `{ ids }` alongside the existing `GET`.
2. Otherwise put "virtual" subpaths on `{id}` with a reserved segment and method — e.g. `PATCH …/notifications/mark-all-read` on `portal/notifications/{id}`.

**Before finishing:**

- Grep `apps/api/src/functions` for every existing `route:` on the same prefix
- List `methods` for each so you can confirm the new path + method combo is unambiguous
- The `azure-route-check` skill automates this audit — invoke it when in doubt

## Auth

- The SPA requests tokens via `src/entraAuth.js`; the API validates via `apps/api/src/lib/jwtVerify.ts`.
- Issuer / audience / scope must match across SPA `VITE_ENTRA_*` and API `ENTRA_*` settings. If `/api/portal/me` returns 401, start with issuer/audience/scope mismatch analysis before DB role debugging. The `entra-config-map` skill produces the exact placement checklist.

## Database

- `DATABASE_URL` is configured as an **Azure Function App application setting**, not in code.
- Migrations live under `infra/db/migrations/`. Do not run destructive migrations without explicit approval.

## CORS

- Allowed origins are controlled by `CORS_ALLOWED_ORIGINS` on the Function App. Any new deployed SPA origin (Vercel preview, staging) must be added there — not hard-coded.

## Logging

- Avoid logging raw JWTs, email bodies, or PII. Prefer user IDs and event names.

## Deployment

- CI pipelines: `.github/workflows/azure-functions-deploy.yml` and `.github/workflows/azure-sql-migrations.yml`.
- Required GitHub Actions secrets/variables and their names live in `infra/azure/README.md`. Do not introduce new env vars without updating both `docs/portal/ENV_CONTRACT.md` and the workflow inputs.

## Do not

- Expose secret values in responses or logs
- Add new routes without grepping for prefix conflicts first
- Log raw tokens or unredacted emails
- Change public route shapes without updating the SPA client and documenting the contract
