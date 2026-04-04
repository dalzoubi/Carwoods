# Phase gates (entry / exit criteria)

## Phase 1 — Foundation + listings API

**Entry:** Azure subscription access; resource group `carwoods.com` available; Entra External ID tenant decision made.

**Exit:**

- [ ] IaC deploys Functions app, PostgreSQL, Blob, ACS (as needed) **into `carwoods.com`**.
- [ ] Migrations apply cleanly to empty DB; seed data for lookup tables (categories, priorities, statuses) if required.
- [ ] Entra JWT validation on a smoke endpoint; `GET /api/portal/me` returns 401 without token.
- [ ] Landlord/Admin CRUD for properties / leases / tenant links (minimal UI or API-only with tests).
- [ ] **`GET /api/public/apply-properties`** returns only `apply_visible` rows; **no PII**.
- [ ] **`/apply`**: feature flag can switch between **generated file** (current) and **API**; snapshot tests or E2E prove parity on address, rent label, apply URL, HAR detail link.
- [ ] **HAR blocking sync:** creating/updating a property with `har_listing_id` persists normalized `metadata` or returns explicit error (no silent empty success).

## Phase 2 — Requests + messaging + uploads + mail

**Exit:**

- [ ] Tenant submit flow with validation (limits: photo count, video, MIME, size) enforced **server-side**.
- [ ] SAS upload intent + metadata persistence; read URLs only for authorized users.
- [ ] Thread messages; tenants cannot read `is_internal`; audit on mutations.
- [ ] Notifications for configured events with idempotency + retry logging.

## Phase 3 — AI + exports + hardening

**Exit:**

- [ ] `POST /api/landlord/requests/:id/suggest-reply` — landlord/admin only; stores observability metadata, not secrets.
- [ ] CSV export authorized for landlord/admin.
- [ ] Scheduled job: lease end + non-month-to-month revokes access; data retained 5 years.
- [ ] Vendor assignment and policy tests (when flag on).

## Global invariants

- No secrets in browser bundles.
- Every mutating API path audited.
- Access control tests must exist for tenant isolation and admin override.
