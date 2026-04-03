# Database schema notes (approved baseline)

Source of truth: [`infra/db/migrations/001_initial_portal.sql`](../../infra/db/migrations/001_initial_portal.sql).

## Extensions to original domain sketch

| Addition | Purpose |
|----------|---------|
| `properties.har_sync_status`, `har_sync_error`, `har_last_synced_at` | Surface blocking HAR sync outcomes in admin UI |
| `properties.deleted_at`, `created_by`, `updated_by` | Soft delete + audit attribution |
| `leases.deleted_at`, `created_by`, `updated_by` | Same |
| `request_status_history` | Timeline fidelity for status changes (separate from free-text messages) |
| `notification_outbox` | Reliable dispatch + idempotency key |
| `notification_deliveries` | Per-recipient send log / failures |
| `ai_suggestion_log` | Gemini usage observability (no secrets) |

## Indexes (summary)

- Users: `email` (plain index; case-insensitive collation `SQL_Latin1_General_CP1_CI_AS` handles case-insensitive search)
- Properties: `har_listing_id`, partial on `apply_visible`
- Leases: by `property_id`, partial active
- `lease_tenants`: `user_id`
- Requests: by property + status + created, by submitter, by `updated_at`
- Messages/attachments: by `request_id`
- Audit: by entity type + id + time

## Retention

Application policy: **5-year retention**; use soft delete and avoid hard deletes of tenant/request history except where legally required.
