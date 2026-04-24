# Payment records: property, tenant, or lease scope

**Status:** Draft  
**Owner:** (team)  
**Last updated:** 2026-04-23

## Context & problem

The table today is **`lease_payment_entries`**; it is **lease-scoped** only: `lease_id` is `NOT NULL` and uniqueness is on `(lease_id, period_start, payment_type)` (see `infra/db/migrations/029_lease_payment_entries.sql`, `031_lease_payment_entry_type.sql`). This work **renames** the table to **`payment_entries`**. The portal payments UI (`src/components/PortalPayments.jsx`) already uses a **property → lease** flow for landlords, and `GET /api/landlord/payments?lease_id=` only lists by lease (`apps/api/src/functions/payments.ts`).

**Problem:** Some charges should be recorded at **property** level, or for a **property + tenant**, without a lease row, while the usual rent line remains **per lease**. The product hierarchy is always **property → tenant → lease**; a payment can attach at **property only**, **property + tenant**, or **property + tenant + lease**.

## Goals / non-goals

**Goals**

- Landlord/Admin: Create and list payment lines scoped to: (1) **property only**, (2) **property + tenant**, (3) **lease** (existing use case, with the hierarchy explicit in the UI).
- **Invariant in UX:** No tenant without property; no lease without traversing the hierarchy in the **picker** (lease implies property + tenant selection for navigation even if the DB can derive from `lease_id` alone for lease-scoped rows).
- A **landlord-controlled checkbox** (per payment line) to show that line in the **tenant** portal when the line is **tied to a property or lease the tenant is on** (eligibility rules below). Existing **lease** lines remain visible to tenants by default (migration default) unless the landlord turns visibility off.
- **Tenant portal:** Tenants who belong to **more than one property** first **select a property**; lists and copy respect that context (avoids mixed-address confusion).
- **Delete:** **Landlords** and **Admins** can **remove** a payment line (soft-delete). **Tenants** cannot delete payment history.
- **Rename:** The database table **`lease_payment_entries`** is renamed to **`payment_entries`**, with constraints and indexes renamed for consistency; application SQL and types updated accordingly (no lingering production references to the old table name).
- New strings in **en, es, fr, ar**; **RTL** and **print** match existing portal patterns.

**Non-goals (v1)**

- New `payment_type` values beyond the current **check constraint** allowed set (same enum as today; after DB rename the constraint may be named e.g. `CK_payment_entries_*`).
- Splitting one payment across multiple tenants or multiple leases.
- Invoicing, dunning, or new third-party payment processors.
- “Allocate property fee to units” or similar allocation UX.

## User stories & acceptance criteria

1. **Property-only (G1)**  
   *As a landlord, I can select a property and add a payment line with **no** tenant and **no** lease, and list lines for that property (including that scope).*

2. **Property + tenant (G2)**  
   *As a landlord, I can select a property and a tenant and add a line with **no** lease.*

3. **Lease (G3)**  
   *As a landlord, I can select **property → tenant → lease** and add a line as today (lease is the most specific scope).*

4. **Auth (G4)**  
   *As the system, I reject create/list for properties, tenants, or leases the actor does not have rights to* (analogous to `leaseAccessibleByLandlord` in `paymentEntriesRepo.ts`, extended to property- and tenant-level checks for the landlord’s portfolio; Admin rules unchanged in spirit).

5. **Portal tenant (G5) — visibility flag + eligibility**  
   *As a landlord, I can toggle **Show to tenants** (or equivalent label) on **any** payment line.* When **on**, the tenant portal includes that line **only if** the expense is tied to a **property** or **lease** the signed-in tenant is on:
   - **Property-only** scope: the tenant is on **some lease** (or in `lease_tenants`) for **that** property.  
   - **Property + tenant** scope: the line’s `tenant_user_id` matches the signed-in user **and** the line’s property (same as selected context).  
   - **Lease** scope: the tenant is on **that** `lease_id`.  
   *When the flag is **off**, the line is **landlord-only** in the portal (any scope).*  
   *As a tenant with multiple properties, I **select a property** first;* the payments view shows lines eligible for that property (and lease under it as applicable).

6. **Uniqueness (G6)**  
   *No duplicate business key per scope* — use partial unique indexes (e.g. lease: `(lease_id, period_start, payment_type)` where `lease_id` is set; property: `(property_id, period_start, payment_type)`; property+tenant: `(property_id, tenant_user_id, period_start, payment_type)`). Refine if product allows multiple “OTHER” lines in the same month by design.

7. **Delete (G7)**  
   *As a landlord or admin, I can **delete** a payment line* so it no longer appears in **landlord** or **tenant** lists. *The system **rejects** delete for actors without rights to that line’s property/lease scope* (same auth family as G4; **admin** can delete per existing admin rules for landlord resources). *Tenants do not get a delete action.*

8. **Table rename (G8)**  
   *As maintainers, we store payment lines in a table named **`payment_entries`*** (renamed from `lease_payment_entries`) *so the name matches property / tenant / lease scope. Historical migrations in `infra/db/migrations/` stay immutable; a **new** migration performs the rename in live databases.*

## UX notes

- **Management flow:** Stacked **Property (required) → Tenant (optional for property-only) → Lease (only when scope = lease or when drilling to lease lines)**. Clear **scope indicator** for create/edit so users know what the line applies to. **Show to tenants** (wording TBD) — `Checkbox` or `Switch` on create/edit, with **helper text** explaining: when checked, tenants who are on the relevant **property** or **lease** will see this line in the portal; when unchecked, the line is internal to the landlord view only. **Delete** — e.g. row action (icon) or menu item, opening a **confirmation dialog** (destructive) with i18n title/body/confirm; match existing portal delete / destructive patterns if present; focus management and `aria-` for dialog.
- **Tenant flow:** If the user has **more than one property**, a **property selector** (required before or above the list) **filters** the payments list to the chosen property. Single-property tenants can use the same control for consistency or **hide** the selector. Align with existing portal patterns (e.g. if another page already uses a “current property” pattern, **reuse** it).
- **Reuse:** Extend `PortalPayments.jsx`, `usePortalPayments.js`, `StatusAlertSlot`, MUI `Select` / `TextField` / `FormControlLabel`+`Checkbox` patterns, existing `portalPayments` copy structure; add keys under `portalPayments` (or a nested `scope` / `visibility` section) in all **four** locale files per project convention.
- **A11y:** Associating every control with a label, keyboard order matching property → tenant → lease, dialog focus trap unchanged from existing dialog; **checkbox** linked to label and helper.
- **RTL / dark / print:** Use MUI theme tokens and existing `withDarkPath` / print patterns; no hardcoded physical directions; review with `theme-audit` skill for touched files before ship.

## Privacy

- **PII:** Link to tenant (user id), property address context, and lease dates as in current flows. **No** new card/bank PII; payment “method” remains categorical.
- **Logs:** Avoid logging free-form notes; keep support logs to ids + error codes, consistent with `payments.ts` logging.
- **Retention / deletion:** The payment table (after rename, **`payment_entries`**) already has **`deleted_at`**, with lists filtering `WHERE deleted_at IS NULL` in `paymentEntriesRepo.ts` — **implement landlord/admin delete as a soft delete** (set `deleted_at`), not a hard `DELETE`, so audit/restore patterns remain an option. Follow `deleteUserCascade.ts` for any cascade. **Admin** and **landlord** delete actions must not log full notes in app insights beyond entity id and outcome.
- **Auth / consent:** No new third-party data sharing; same portal auth (Entra) and role gates.

## Architecture

- **DB — table rename (`G8`):** Add a **dedicated migration** (order relative to new columns: either **rename first** then add columns, or add columns to `lease_payment_entries` then rename in a later step — **prefer** one logical migration batch per deploy, document order). In SQL Server use **`sp_rename`** (or `ALTER SCHEMA` if applicable) for **`lease_payment_entries` → `payment_entries`**. Rebind/rename:
  - **Check** constraints (e.g. `CK_lease_payment_entries_*` → `CK_payment_entries_*` or `CK_payment_entry_*`).
  - **Default** on `payment_type` if name references old table.
  - **Unique** and **index** names (`idx_lease_payment_*`, `uq_lease_*` → `idx_payment_entries_*`, `uq_payment_entries_*` as needed).
  - **FK** from `lease_id` may auto-rename or need explicit `sp_rename` on constraint — verify in staging.  
  After rename, all **runtime** SQL in `apps/api` and tools must reference **`payment_entries`** only. Update: `paymentEntriesRepo.ts`, `deleteUserCascade.ts` (string table name + delete queries), `deleteLeaseAsMistake.ts` / any `SELECT COUNT` against this table, API tests (e.g. `leaseLifecycle.test.mjs` regexes), and comments (`PortalPayments.jsx` `CK_lease_payment_entries_*` → new constraint name in comment). **Optional** TS rename: `LeasePaymentEntryRow` → `PaymentEntryRow` in `paymentEntriesRepo.ts` for API clarity. **Historical** migration files **029/031** are not rewritten; the new migration is the source of truth for deployed schema name.

- **DB — scope columns:** New migration: add nullable `property_id` (→ `properties`), `tenant_user_id` (→ `users` or consistent with `lease_tenants.user_id`); make `lease_id` **nullable** with FK to `leases`. **CHECK** (or validated-only in app, preferably both) for exactly one of three shapes:
  - `property_id` set, `tenant_user_id` null, `lease_id` null  
  - `property_id` + `tenant_user_id` set, `lease_id` null  
  - `lease_id` set; validate `lease` belongs to `property_id` / tenant as selected (either store redundant `property_id`/`tenant_user_id` for lease rows for simpler queries, or derive in joins — pick one and document; denormalized columns require triggers or strict insert validation to stay consistent).  
- **Tenant visibility column:** e.g. `show_in_tenant_portal` `BIT NOT NULL` with a **data migration** default: existing rows (all current lease-scoped) **`1`** to preserve “tenant can see their lease payment history” behavior. New create defaults: **`1` for lease scope**, **`0` for property-only and property+tenant** unless the landlord checks the box (or align all defaults in app layer if the column defaults to `0` everywhere and backfill + create logic sets lease to `1`).
- **Uniqueness:** Drop or adjust the unique constraint on the table (post-rename, e.g. `uq_payment_entries_*`) for `lease_id` nulls; add **filtered unique** indexes for each shape (SQL Server). If rename migration runs after uniqueness changes, use **final** table name in all `ALTER` statements.
- **API (`apps/api`):** Extend `GET /api/landlord/payments` to filter by `property_id` and optional `tenant_id` / `lease_id` (or equivalent query design); extend `POST` / `PATCH` body with the visibility flag. Add **`DELETE /api/landlord/payments/{id}`** (or **`DELETE` method** on the same Azure Function that handles `PATCH` for `landlord/payments/{id}`) — soft-delete, **204** or **200** with minimal body; **403/404** when not allowed or already deleted. Reuse the same item-level auth as `PATCH` (load entry by id, then `leaseAccessibleByLandlord` / property+tenant access / admin as applicable to the new scopes). **Tenants** have no delete route. Run **`.claude/skills/azure-route-check`** when registering methods on `landlord/payments/{id}`. **`GET /api/portal/payments`:** support optional `property_id` query (required when the tenant has multiple properties and the client sends it; or return grouped payload — **prefer** query param to match the tenant **property** selector). Filter rows by **G5** rules: `show_in_tenant_portal = 1` and eligibility for that property/lease.
- **Use cases:** `listPaymentEntries`, `recordPayment`, `updatePayment` — new validation; add **`softDeletePayment`** (or `deletePayment`) use case; `paymentEntriesRepo` new list/insert patterns, **`updateEntry`/`softDelete` setting `deleted_at`**, and `getEntryById` unchanged semantics for active rows; `paymentEntriesApiJson` for the flag; **audit** `action: 'DELETE'` (or `SOFT_DELETE`) with `before` snapshot, `after` null or redacted.
- **SPA:** `lib/portalApiClient` and `usePortalPayments` to pass scope, refetch, **checkbox** in dialog, **landlord** list, **delete** with confirm; **tenant** `PortalPayments` with **property** selector when `properties.length > 1` and pass `property_id` to list.

## Risks & open questions

- **Migration risk:** Mistakes on `CHECK` / unique indexes can block deploy or allow duplicates — test on copy of data. **Table rename** risk: missing a reference (`deleteUserCascade`, lease-delete flows) causes runtime SQL errors; **staging validation** and a **grep** checklist before merge. SQL Server `sp_rename` does not update all dependent names automatically; verify **constraint** and **index** names in Object Explorer or metadata queries.
- **Visibility semantics:** Hiding a previously visible lease line (`show_in_tenant_portal` **0**) changes tenant UX — **document** in release notes. Landlord education via helper text.
- **Multi-property API:** `GET /api/portal/payments?property_id=` (or body) when the tenant has multiple properties — if omitted, return **400** with a message to select a property, or return **all** properties’ rows with a **property** key on each row; **recommend** explicit `property_id` for a single consistent list and simpler queries.
- **Idempotent delete:** Second `DELETE` on same id — return **204** (or **404** if “not found” is preferred; pick one and document for clients).

## Rollout & rollback

- **Order:** Migrations (rename + columns + flags as designed) → API → SPA (or feature-flag SPA if you need staggered).  
- **Rollback:** Revert app deploy; migration down only if not yet in shared environments; if rename shipped, a **down** migration must map **`payment_entries` → `lease_payment_entries`** only if rolling back the rename without dropping new columns (coordinate with column nullability; prefer forward-only in prod if rename + schema expand are atomic).

## Test plan

- **Migrations / DB:** Staging run of rename migration; verify constraints and indexes; smoke query against **`payment_entries`**.
- **Unit (Vitest):** Validation for three POST shapes; forbidden when ids don’t match landlord/lease/property; uniqueness; **portal list** filters: flag off = excluded; flag on + not on property/lease = excluded.
- **Integration (API):** List filters; create per scope with/without **show to tenants**; **PATCH** toggles flag; **`DELETE`** success, 403/404, **idempotent** behavior; list excludes `deleted_at` rows; **portal** `GET` with `property_id` and mixed-scope fixtures; 403/404 cases.
- **E2E (Playwright):** If payments are covered, landlord create with checkbox; **landlord** delete with confirm; **tenant** has no delete control; **tenant** view with multi-property **property** pick when relevant.
- **i18n:** All four files updated; no English-only fallbacks in production code for new user-visible strings.
- **RTL / a11y:** Spot-check with Arabic; axe or manual focus order for new fields.
- **Privacy / authz tests:** No cross-landlord leakage; no PII in log assertions.

## Out of scope / future work

- Per-unit allocation of property-level fees.  

## Spec deltas

- *2026-04-23 — Initial draft — Approved in chat; hierarchy property → tenant → lease; three scopes; portal visibility defaults as stated.*
- *2026-04-23 — Tenant visibility — Landlord **checkbox** to show any line in tenant portal when tied to a property/lease the tenant is on; DB/API flag; **property selector** for tenants on multiple properties (filter context).*
- *2026-04-23 — Delete — **Landlord** and **admin** may **soft-delete** payment lines via **`DELETE` landlord API**; confirm in UI; tenants have no delete.*
- *2026-04-23 — Table **rename** — In scope: `lease_payment_entries` → `payment_entries` with new migration, constraint/index renames, and all app references updated.*

---

**Handoff:** After implementation, use `@phase-validate` before PR; for implementation start from `@phase-implement` with this file path.
