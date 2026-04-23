# Cost tracking (spec)

## Scope

End-to-end **usage cost** visibility for the portal: record billable events (email, SMS, AI tokens, shared Azure infra), roll up to daily aggregates, optionally merge **vendor-reported** costs (Azure Cost Management, Telnyx, Google Cloud Billing), and expose an **admin-only** API and **Cost report** UI with configurable unit rates.

## Acceptance criteria

1. **Event logging** — Billable operations write rows to `cost_events` with service, units, estimated USD (from `pricing_config` at time of use), and optional `metadata` JSON (whitelisted to product dimensions in `sanitizeCostEventMetadata` — no request or user IDs). Failures to insert must not break the primary use case; failed inserts are logged as `cost_event.insert_failed` for operations. Read failures for `pricing_config` log `pricing_config.load_failed`.
2. **Daily rollup** — A scheduled job aggregates `cost_events` into `cost_daily_rollup` for a given UTC date. Idempotent re-run for the same date is acceptable (implementation deletes/rebuilds for that date as defined in code).
3. **Vendor sync (optional credentials)** — A scheduled job fetches third-party billing where configured; results land in `vendor_sync_log` with status and optional `raw_data` (treat as sensitive; restrict access to DB/admin tooling).
4. **Admin API** — `GET` rollup and landlord drill-down, `GET`/`PATCH` pricing require `requireAdmin` (management JWT, `ADMIN` role). Responses must not be callable with a **landlord-only** token.
5. **Internal HTTP jobs (manual trigger)** — `POST /api/internal/jobs/aggregate-daily-costs` and `POST /api/internal/jobs/sync-vendor-costs` perform **global** work and may call external billing APIs. They require **`requireAdmin`**, not `requireLandlordOrAdmin`. Timers run without this gate (no user principal).
6. **Portal UI** — Route `/portal/admin/reports/costs` is behind `PortalRouteGuard` for `ADMIN`. All user-visible strings use i18n (including tier labels). Sidebar links use `withDarkPath` for `/dark/…` preview.
7. **Configuration** — Documented env keys for timers and vendor sync live in [ENV_CONTRACT.md](./ENV_CONTRACT.md) (`COST_ROLLUP_*`, `VENDOR_SYNC_*`, Azure/Google/Telnyx as applicable).

## Security & privacy

- **Spoofing** — Management endpoints use Firebase-verified JWT + DB user; admin routes check `ADMIN` role.
- **Elevation** — Landlords must not trigger global rollup or vendor sync over HTTP; validated in `internalJobs.ts` via `requireAdmin`.
- **Info disclosure** — `cost_events.metadata` is **whitelisted** in `sanitizeCostEventMetadata` to `model`, `prompt_version`, `source`, and `channel` only (short strings). No request, user, or contact IDs are stored. `vendor_sync_log.raw_data` may still contain sensitive billing export data — restrict to DB/admin tooling; do not expose on public or landlord APIs.

## Spec deltas

- **2026-04-23** — Internal job HTTP handlers explicitly require `requireAdmin` (aligns with Validate phase).

## Test plan (automation)

- **UI** — `PortalAdminCostReport` loads mocked rollup + pricing, shows heading and translated tier chip for `PRO` tier.
- **API** — Manual/curl verification of `403` for landlord JWT on internal job URLs; integration tests can be added under `apps/api` when a test harness exists.

## References

- Migrations: `infra/db/migrations/041_cost_tracking.sql`, `042_vendor_sync_log.sql`
- API: `apps/api/src/functions/adminCosts.ts`, `apps/api/src/functions/internalJobs.ts`
- UI: `src/components/PortalAdminCostReport.jsx`
