# @carwoods/api

Azure Functions (Node.js, TypeScript) for the tenant portal and landlord/admin API.

## Prerequisites

- Node 24+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)

## Local run

```bash
npm install
npm run build
cp local.settings.json.example local.settings.json
func start
```

Endpoints (local default port **7071**):

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | Anonymous |
| GET, OPTIONS | `/api/public/apply-properties` | Anonymous (CORS). Returns tiles for `apply_visible` rows with valid `metadata.apply` (empty list if `DATABASE_URL` unset or DB error). |
| GET, OPTIONS | `/api/portal/me` | Bearer JWT (`ENTRA_*` + JWKS). **401** without token. |
| GET, POST, OPTIONS | `/api/portal/requests` | Tenant request listing + creation (lease-linked only) |
| GET, OPTIONS | `/api/portal/requests/{id}` | Tenant/management request detail (tenant view strips internal notes) |
| GET, POST, OPTIONS | `/api/portal/requests/{id}/messages` | Thread messages (`is_internal` only for landlord/admin) |
| POST, OPTIONS | `/api/portal/requests/{id}/uploads/intent` | Server-side file validation + short-lived upload intent |
| GET, OPTIONS | `/api/portal/requests/{id}/attachments` | List request attachment metadata |
| POST, OPTIONS | `/api/portal/requests/{id}/attachments/finalize` | Persist request attachment metadata |
| GET, POST, OPTIONS | `/api/landlord/properties` | Landlord or Admin Bearer JWT + onboarded `users` row (email match) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/properties/{id}` | Landlord or Admin (onboarded email role) |
| GET, POST, OPTIONS | `/api/landlord/leases` | Landlord or Admin (onboarded email role; `GET ?property_id=` filters) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/leases/{id}` | Landlord or Admin (onboarded email role) |
| POST, OPTIONS | `/api/landlord/leases/{leaseId}/tenants` | Landlord or Admin (onboarded email role); body `{ "userId": "<uuid>" }` links an existing `users` row |
| GET, OPTIONS | `/api/landlord/requests` | Landlord/admin request listing |
| GET, PATCH, OPTIONS | `/api/landlord/requests/{id}` | Landlord/admin request detail + status/vendor/internal notes updates |
| GET, OPTIONS | `/api/landlord/exports/requests.csv` | Landlord/admin CSV export |
| GET, POST, OPTIONS | `/api/portal/admin/landlords` | Admin-only landlord onboarding + listing (active by default) |
| PATCH, OPTIONS | `/api/portal/admin/landlords/{id}` | Admin-only landlord deactivate/reactivate |
| POST, OPTIONS | `/api/internal/jobs/process-notifications` | Notification outbox processor with retries/idempotency status |
| POST, OPTIONS | `/api/internal/jobs/revoke-expired-leases` | Lease access revocation job (ended + non-month-to-month) |

**HAR:** `POST`/`PATCH` on properties with non-empty `har_listing_id` runs a **blocking** HAR fetch (same parsing as `scripts/fetchHarRentalApplyTiles.mjs`). Failure → **422** `har_sync_failed` (no row created/updated).

See [`docs/portal/ENV_CONTRACT.md`](../../docs/portal/ENV_CONTRACT.md) and [`docs/portal/APPLY_METADATA.md`](../../docs/portal/APPLY_METADATA.md).
Phase 2 API contract: [`docs/portal/PHASE2_API_CONTRACT.md`](../../docs/portal/PHASE2_API_CONTRACT.md).

## Deploy

- **CI:** GitHub Actions [`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml) (same `AZURE_*` secrets + `AZURE_FUNCTION_APP_NAME` variable as infra).
- **Manual:** `func azure functionapp publish <name>` after `npm run build` and `npm prune --omit=dev` (see [`infra/azure/README.md`](../../infra/azure/README.md) Part G).

Resource group: **`carwoods.com`**.
