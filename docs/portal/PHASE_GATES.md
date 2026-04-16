# Phase gates (entry / exit criteria)

## Phase 1 — Foundation + listings API

**Entry:** Azure subscription access; resource group `carwoods.com` available; Entra External ID tenant decision made.

**Exit:**

- [x] IaC templates/workflows target Functions + **Azure SQL** + supporting resources in **`carwoods.com`**.
- [x] Migrations and seed scripts exist for lookup/status data in `infra/db/migrations`.
- [x] Entra JWT validation on a smoke endpoint; `GET /api/portal/me` returns 401 without token.
- [x] Landlord/Admin CRUD for properties / leases / tenant links (API).
- [x] **`GET /api/public/apply-properties`** returns only `apply_visible` rows; **no PII**.
- [x] **`/apply`** loads public listings from **`GET /api/public/apply-properties`** (no static generated fallback).
- [x] **HAR blocking sync:** create/update with `har_listing_id` persists normalized `metadata` or returns explicit error.

## Phase 2 — Requests + messaging + uploads + mail + portal UX

**Exit:**

- [x] Tenant submit flow with validation (limits: photo count, video, MIME, size) enforced **server-side**.
- [x] Upload intent + metadata persistence; attachment reads limited to authorized users.
- [x] Thread messages; tenants cannot read `is_internal`; audit on mutations.
- [x] Notifications for configured events with idempotency + retry logging.
- [x] **Portal layout shell** with sidebar navigation, top bar, and dedicated auth gate.
- [x] **Dashboard** with welcome card, stat summary, quick actions, and recent requests.
- [x] **Login landing** with branding, social sign-in buttons, and graceful degradation.
- [x] **Requests split pane** (list + detail side-by-side on desktop).
- [x] **Profile polish** with avatar, card layout, and snackbar feedback.
- [x] Marketing navbar simplified to a single "Portal" link (portal has its own sidebar).

## Phase 3 — AI + exports + hardening

**Exit:**

- [x] `POST /api/landlord/requests/:id/suggest-reply` — landlord/admin only; stores observability metadata, not secrets.
- [x] CSV export authorized for landlord/admin.
- [x] Scheduled job: lease end + non-month-to-month revokes access; data retained 5 years.
- [x] Vendor assignment path in management updates + policy/contract tests in API package.

## Global invariants

- No secrets in browser bundles.
- Every mutating API path audited.
- Access control tests must exist for tenant isolation and admin override.
