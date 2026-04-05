# Phase 2 API contract (requests, uploads, messaging, notifications)

This file locks backend-first contracts for the tenant maintenance flows.

## Auth + role policy

- All endpoints require a valid Entra bearer token and a mapped active `users` row.
- `TENANT` can create requests only for leases linked through `lease_tenants`.
- `TENANT` cannot read or post `is_internal` messages.
- `LANDLORD` / `ADMIN` can read and post `is_internal` messages and update request status/vendor assignment.
- Every mutating endpoint writes `audit_log`.

## Endpoints

### Tenant portal

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/portal/requests` | List tenant-visible requests |
| `POST` | `/api/portal/requests` | Create maintenance request |
| `GET` | `/api/portal/requests/{id}` | Read request details (internal notes hidden for tenant) |
| `GET` | `/api/portal/requests/{id}/messages` | Read request thread |
| `POST` | `/api/portal/requests/{id}/messages` | Add message (`is_internal` ignored for tenant) |
| `POST` | `/api/portal/requests/{id}/uploads/intent` | Validate file metadata and mint short-lived upload intent |
| `POST` | `/api/portal/requests/{id}/attachments` | Persist uploaded attachment metadata |
| `GET` | `/api/portal/requests/{id}/attachments` | List attachment metadata |

### Landlord/admin

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/landlord/requests` | List all requests in management scope |
| `GET` | `/api/landlord/requests/{id}` | Read single request |
| `PATCH` | `/api/landlord/requests/{id}` | Update status, vendor assignment, internal notes |
| `POST` | `/api/landlord/requests/{id}/suggest-reply` | Backend-only reply suggestion + observability log |
| `GET` | `/api/landlord/exports/requests.csv` | CSV export |

### Internal jobs

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/internal/jobs/process-notifications` | Process pending notification outbox rows with retry accounting |
| `POST` | `/api/internal/jobs/revoke-expired-leases` | Revoke lease access for ended non-month-to-month leases |

## Validation contract

- Upload MIME gate:
  - `PHOTO`: `image/*`
  - `VIDEO`: `video/*`
  - `FILE`: pdf, txt, doc, docx
- Upload size gate:
  - `PHOTO`: max 8 MB
  - `VIDEO`: max 100 MB
  - `FILE`: max 25 MB
- Per-request limits:
  - max 10 photos
  - max 2 videos

## Notification contract

Mutating request endpoints enqueue `notification_outbox` events with idempotency keys:

- `REQUEST_CREATED`
- `REQUEST_MESSAGE_CREATED`
- `REQUEST_INTERNAL_NOTE`
- `REQUEST_ATTACHMENT_ADDED`
- `REQUEST_UPDATED`

## Authz + audit test checklist

Use this matrix for API test implementation and CI gating:

- [ ] Tenant cannot access another tenant's request (`404`).
- [ ] Tenant cannot create request for a lease they are not linked to (`403`).
- [ ] Tenant cannot set `is_internal=true` on message (stored value remains `false`).
- [ ] Landlord/admin can set `is_internal=true`.
- [ ] Attachment intent rejects invalid MIME and oversize files.
- [ ] Photo/video count limits are enforced server-side.
- [ ] Each mutation inserts a corresponding `audit_log` row.

