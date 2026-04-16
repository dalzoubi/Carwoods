# Tenant maintenance portal — implementation prompt (approved for build)

Use this as the authoritative product + technical brief. **Do not expose storage credentials, AI keys, or Entra secrets in the browser.**

## Delivery method (spec-driven development required)

All future work should follow **spec-driven development**. Treat this as mandatory process, not optional guidance.

### Required execution order for every non-trivial task

1. **Spec first (before implementation):**
   - Create or update a task spec in `docs/specs/`.
   - Start from `docs/specs/SPEC_TEMPLATE.md`.
   - Spec must include: context/problem, scope, out-of-scope, user stories, constraints, assumptions, and risks.
2. **Define acceptance criteria:**
   - Write testable criteria in "Given / When / Then" style where possible.
   - Include UI, API, RBAC/security, i18n, RTL, dark mode, and print expectations when relevant.
3. **Define validation plan:**
   - List exact checks (unit/integration/manual) and commands to run.
   - Map each acceptance criterion to at least one validation step.
4. **Implement against the spec:**
   - Keep changes within approved scope.
   - If new requirements appear, update the spec first, then continue implementation.
5. **Close with traceability:**
   - Record what changed, what was tested, results, and any known gaps.
   - Confirm each acceptance criterion is met (or explicitly deferred with reason).

### Spec quality bar

- Specs must be concrete enough that another engineer can implement without guessing.
- Avoid vague criteria ("looks good", "works better"); use measurable outcomes.
- Include rollback/mitigation notes for risky changes.
- Include dependencies and sequencing for multi-phase work.

### PR and review expectations

- PR description must link the spec file and summarize scope boundaries.
- Review should validate:
  - implementation matches spec,
  - tests cover acceptance criteria,
  - no out-of-scope drift.
- If behavior changes but spec was not updated, treat as incomplete and update spec before merge.

## Product

- **Public marketing site** remains on Vite + React (current repo).
- **Tenant portal** at `/portal`: password-protected, app-like (not marketing layout).
- **Admin + Landlord**: properties, leases, tenants, service requests, messaging, config, exports, notifications.
- **Data**: Azure SQL (Basic tier), private Blob uploads (SAS), email via Azure Communication Services Email, **Gemini only on backend** for landlord/admin reply suggestions.
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
3. **Landlord/Admin create/update — blocking HAR sync when `har_listing_id` is set:**
   - `POST /api/landlord/properties` and `PATCH /api/landlord/properties/:id` accept optional `har_listing_id`.
   - If present, backend **fetches and parses HAR in the same request**, normalizes metadata, persists to `properties.metadata` (with `last_synced_at`, `sync_source`, `sync_confidence`) **atomically with the property row** before returning success.
   - On failure: return a clear **integration/validation error**; do not silently succeed with empty/stale HAR data for a **new** property that required HAR.
4. **Manual overrides:** admin can lock selected fields; sync must respect locks.
5. **`/apply`:** marketing site loads tiles only from **`GET /api/public/apply-properties`** (`RentalPropertyApplyTiles.jsx` + `publicApplyProperties.js`).

## Security & RBAC

- Validate **Entra bearer tokens** on every portal/landlord/admin API; map `oid`/`sub` → `users.external_auth_oid`.
- **RBAC + row-level** rules: tenant sees only own lease/property context and non-internal messages; landlord sees landlord scope; admin sees all.
- Rate-limit sensitive endpoints; audit all mutations; structured logs + correlation IDs.
- For any form fields that collect contact info, always enforce **email and phone validation** on both client and API (do not rely on HTML input type alone).

## Phasing

1. **Phase 1:** IaC (RG `carwoods.com`), schema/migrations, Entra integration, RBAC, properties/leases/tenants landlord/admin CRUD, public apply-properties API, `/apply` consuming that API from the marketing site.
2. **Phase 2:** Requests, uploads, tenant + landlord/admin UI, threading, canned replies, statuses, notifications.
3. **Phase 3:** Gemini suggest-reply, CSV export, HAR hardening (retries, observability), lease revocation job, vendor enhancements, optional realtime.

See [PHASE_GATES.md](./PHASE_GATES.md) for exit criteria.

## Portal UX

The portal is a **dedicated application shell**, not a marketing page. All `/portal/*` routes render inside `PortalLayout` (sidebar + top bar), never inside the marketing site's `ResponsiveNavbar` / `Footer`.

### Layout shell

- **`PortalAuthGate`** wraps the portal — unauthenticated users see a branded login landing (`PortalLoginLanding`) with social sign-in buttons; authenticated users get the full sidebar layout.
- **`PortalLayout`** renders `PortalSidebar` (permanent on desktop, temporary drawer on mobile, 260 px) + `PortalTopBar` (sticky, compact, shows page title + user avatar).
- **`PortalSidebar`** contains: Carwoods logo, role-gated nav links with icons, user footer (avatar + name + role chip + sign-out), and a "Back to site" link.
- **`PortalTopBar`** contains: hamburger toggle (mobile), page title (mapped from route), user avatar + role chip.

### Page patterns

| Pattern | Components | When to use |
|---------|-----------|-------------|
| **Dashboard** | `PortalDashboard` | Portal home — welcome, stat cards, quick actions, recent items |
| **List + detail split pane** | `PortalRequests` | Any list/detail view — side-by-side on desktop, stacked on mobile |
| **Form card** | `PortalProfile`, `PortalAdminLandlords` | Data entry — `Paper variant="outlined"` with `Snackbar` success |
| **Login landing** | `PortalLoginLanding` | Unauthenticated entry — centered card with branding + sign-in |

### MUI component preferences

- **Surfaces**: `Paper variant="outlined"` for cards and panels (not raw `Box` with border).
- **Status**: `Chip` with semantic `color` (`warning`, `info`, `success`).
- **Feedback (base instruction)**: use top `Snackbar` feedback for **all success and error outcomes** in portal flows. Reuse `usePortalFeedback()` + `PortalFeedbackSnackbar`; avoid new inline error/success alerts unless explicitly approved as a UX exception.
- **User identity**: `Avatar` with initials, `Chip` for role badges.
- **Empty states**: always descriptive text, never blank.

### Quality bar

- Every portal page must work in light + dark mode.
- Every portal page must work in RTL (Arabic).
- No hard-coded colors — use MUI theme tokens.
- Login landing must be functional even when the API is unreachable (graceful degradation).
- New pages must add sidebar nav item + i18n keys in all four locales.

## Internationalization (marketing + shared chrome)

Existing site rules still apply where shared: **no hard-coded English** in user-visible JSX; use `useTranslation()` and four locale files for any strings that remain in the marketing shell or shared components.

## Repository layout

See [MONOREPO.md](./MONOREPO.md). Packages: `apps/api`, `packages/domain`, `packages/config` (per-folder `npm install` — no root npm workspaces on some Windows network paths). Vite app currently at **repository root** (optional future move to `apps/web`).
