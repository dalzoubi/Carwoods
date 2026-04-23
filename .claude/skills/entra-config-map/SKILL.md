---
name: entra-config-map
description: Collect Entra/Azure auth and API configuration values from the repository and produce an exact placement checklist for SPA env vars, API Function App settings, and GitHub secrets/variables. Use when the user asks what values are needed, where each value goes, or why portal auth returns 401/Unknown role.
---

# Entra Config Map

## Purpose

Create a single source of truth for auth/config values and tell the user exactly:

- what each value should be,
- where to set it,
- and which values must match across SPA and API.

## Inputs to read first

1. Root `.env` (for `VITE_*` values used locally)
2. `docs/portal/ENV_CONTRACT.md` (authoritative variable names and semantics)
3. `infra/azure/README.md` (deployment locations + GitHub secret/variable conventions)
4. `.github/workflows/azure-functions-deploy.yml` and `.github/workflows/azure-sql-migrations.yml` (which settings are used in CI)
5. `src/entraAuth.js` and `apps/api/src/lib/jwtVerify.ts` (how the frontend requests tokens and how the API validates them)

## Workflow

1. Extract all relevant keys:
   - **Frontend**: `VITE_API_BASE_URL`, `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_AUTHORITY`, `VITE_ENTRA_API_SCOPE`
   - **API**: `ENTRA_API_AUDIENCE`, `ENTRA_ISSUER`, `ENTRA_OPENID_METADATA_URL` (optional), `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`
   - **CI/infra**: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_FUNCTION_APP_NAME`, `AZURE_SQL_SERVER_NAME`, `AZURE_SQL_ADMIN_PASSWORD`
2. Build cross-checks:
   - `VITE_ENTRA_API_SCOPE` must reference the same API app as `ENTRA_API_AUDIENCE`
   - API issuer must match the token issuer format accepted by the backend (`v2.0` tenant/ciam issuer)
   - API base URL in the SPA must target the deployed Function App host
3. Return exact placement guidance using the output format below
4. If any value is missing/ambiguous, list it under **Missing Values** with one concrete action to obtain it

## Output format (always use)

```markdown
## Put These Values Here

| Key | Value to use | Where to set it | Why it matters |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## Must Match Checks
- Check 1
- Check 2

## Missing Values
- Key: how to obtain it quickly

## Quick Verification
- Step 1
- Step 2
- Step 3
```

## Location labels (use these exactly)

- `Local SPA .env` (repo root)
- `Vercel Project Environment Variables` (frontend deploy)
- `Azure Function App > Configuration > Application settings`
- `GitHub Repo Settings > Secrets and variables > Actions (Secrets)`
- `GitHub Repo Settings > Secrets and variables > Actions (Variables)`

## Guardrails

- Never expose or echo secret values in full unless the user explicitly asks
- Prefer masked output for secrets (`****`) and explain where each secret should come from
- If `/api/portal/me` returns `401`, prioritize issuer/audience/scope mismatch analysis before DB role debugging
- Keep terminology consistent: `SPA app`, `API app`, `scope`, `audience`, `issuer`
