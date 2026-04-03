# Tenant maintenance portal — implementation prompt (approved for build)

Use this as the authoritative product + technical brief. **Do not expose storage credentials, AI keys, or Entra secrets in the browser.**

## Product

- **Public marketing site** remains on Vite + React (current repo).
- **Tenant portal** at `/portal`: password-protected, app-like (not marketing layout).
- **Admin**: properties, leases, tenants, service requests, messaging, vendors (model + optional UI flag), config, exports, notifications.
- **Data**: Azure SQL (Basic tier), private Blob uploads (SAS), email via Azure Communication Services Email, **Gemini only on backend** for admin reply suggestions.
- **Retention**: 5 years; revoke portal access after lease rules but **do not delete** tenant/request history.

## Azure placement

- **All Azure resources** MUST be created in resource group **`carwoods.com`** (enforced in IaC and deployment scripts).
- Frontend may stay on **Vercel**; API and data on **Azure**.

## Stack (target)

| Layer | Choice |
|--------|--------|
| Auth | Microsoft Entra External ID (Google, Apple, Microsoft, email/password, magic link / OTP as configured) |
| API | Node.js **TypeScript** Azure Functions (preferred) |
| DB | Azure SQL (Basic tier, ~$5/month) |
| Files | Azure Blob Storage (private containers, short-lived SAS) |
| Email | Azure Communication Services Email |
| AI | Gemini via backend adapter only |

## HAR / Apply listings (realistic + aligned with current site)

**Current site behavior (reference):** build-time script fetches `https://www.har.com/homedetail/{id}`, parses JSON-LD + `apply.link` from HTML, generates committed tile data. **There is no documented public HAR API** — ingestion is HTML-based.

**Backend requirements:**

1. **`properties` is source of truth** for `apply_visible` and what `/apply` shows via **`GET /api/public/apply-properties`** (public read-only, no PII).
2. **Listing sync adapter** (clean architecture):
   - `ListingSyncProvider.syncProperty(propertyId): SyncResult`
   - `supports(config): boolean`
   - Implementations: **`HarScrapeProvider`** (same extraction strategy as current Node script, server-side only), **`HarIdxSyncProvider`** (feature-flagged / placeholder until credentialed IDX exists), **`ManualListingProvider`** (manual fields).
3. **Admin create/update — blocking HAR sync when `har_listing_id` is set:**
   - `POST /api/admin/properties` and `PATCH /api/admin/properties/:id` accept optional `har_listing_id`.
   - If present, backend **fetches and parses HAR in the same request**, normalizes metadata, persists to `properties.metadata` (with `last_synced_at`, `sync_source`, `sync_confidence`) **atomically with the property row** before returning success.
   - On failure: return a clear **integration/validation error**; do not silently succeed with empty/stale HAR data for a **new** property that required HAR.
4. **Manual overrides:** admin can lock selected fields; sync must respect locks.
5. **`/apply` migration:** keep existing generated tile data as fallback behind a feature flag until API parity tests pass; then default to `GET /api/public/apply-properties` and remove dependency on generated file when stable.

## Security & RBAC

- Validate **Entra bearer tokens** on every portal/admin API; map `oid`/`sub` → `users.external_auth_subject`.
- **RBAC + row-level** rules: tenant sees only own lease/property context and non-internal messages; admin sees all; vendor scoped to assigned requests when feature enabled.
- Rate-limit sensitive endpoints; audit all mutations; structured logs + correlation IDs.

## Phasing

1. **Phase 1:** IaC (RG `carwoods.com`), schema/migrations, Entra integration, RBAC, properties/leases/tenants admin CRUD, public apply-properties API, `/apply` behind flag.
2. **Phase 2:** Requests, uploads, tenant + admin UI, threading, canned replies, statuses, notifications.
3. **Phase 3:** Gemini suggest-reply, CSV export, HAR hardening (retries, observability), lease revocation job, vendor enhancements, optional realtime.

See [PHASE_GATES.md](./PHASE_GATES.md) for exit criteria.

## Internationalization (marketing + shared chrome)

Existing site rules still apply where shared: **no hard-coded English** in user-visible JSX; use `useTranslation()` and four locale files for any strings that remain in the marketing shell or shared components.

## Repository layout

See [MONOREPO.md](./MONOREPO.md). Packages: `apps/api`, `packages/domain`, `packages/config` (per-folder `npm install` — no root npm workspaces on some Windows network paths). Vite app currently at **repository root** (optional future move to `apps/web`).
