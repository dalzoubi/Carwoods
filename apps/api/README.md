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

**Storage / timer:** Set `AzureWebJobsStorage` to a **full storage account connection string** from the Azure portal (Storage account → Access keys → Connection string). The example uses the same placeholders as `AZURE_STORAGE_ACCOUNT_NAME` / `AZURE_STORAGE_ACCOUNT_KEY` when those point at one account. Alternatively, `UseDevelopmentStorage=true` works only if **[Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite)** is running (blob port **10000**). `local.settings.json.example` sets `NOTIFICATION_OUTBOX_TIMER_DISABLED` to `true` so the outbox timer is not registered; drain with `POST /api/internal/jobs/process-notifications` when testing, or set the flag to `false` once storage is available for timer leases.

**Document Center storage:** Document Center reuses `AZURE_STORAGE_ACCOUNT_NAME` and `AZURE_STORAGE_ACCOUNT_KEY`, but writes to a separate private container from maintenance attachments. If unset, the API defaults `DOCUMENT_STORAGE_CONTAINER_NAME` to `carwoods-documents-prod`. For local Functions, `local.settings.json` usually sets `AZURE_STORAGE_CONTAINER_NAME=carwoods-portal-dev` for request attachments and `DOCUMENT_STORAGE_CONTAINER_NAME=carwoods-documents-dev` for documents. Local development may set `DOCUMENT_CENTER_SCAN_BYPASS=true`; production must set `NODE_ENV=production` and `DOCUMENT_CENTER_SCAN_BYPASS=false`.

Endpoints (local default port **7071**):

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/health` | Anonymous |
| GET, OPTIONS | `/api/public/apply-properties` | Anonymous (CORS). Returns tiles for `apply_visible` rows with valid `metadata.apply` (empty list if `DATABASE_URL` unset or DB error). |
| GET, OPTIONS | `/api/portal/me` | Bearer JWT (`FIREBASE_PROJECT_ID` + Google JWKS). **401** without token. |
| GET, POST, OPTIONS | `/api/portal/requests` | Tenant request listing + creation (lease-linked only) |
| GET, OPTIONS | `/api/portal/requests/{id}` | Tenant/management request detail (tenant view strips internal notes) |
| GET, POST, OPTIONS | `/api/portal/requests/{id}/messages` | Thread messages (`is_internal` only for landlord/admin) |
| POST, OPTIONS | `/api/portal/requests/{id}/uploads/intent` | Server-side file validation + short-lived upload intent |
| GET, OPTIONS | `/api/portal/requests/{id}/attachments` | List request attachment metadata |
| POST, OPTIONS | `/api/portal/requests/{id}/attachments/finalize` | Persist request attachment metadata |
| GET, OPTIONS | `/api/portal/documents` | Document Center list + eligible tenant leases |
| POST, OPTIONS | `/api/portal/documents/uploads/intent` | Document Center direct-to-blob upload intent |
| POST, OPTIONS | `/api/portal/documents/finalize` | Persist uploaded Document Center file metadata |
| GET, PATCH, DELETE, OPTIONS | `/api/portal/documents/{documentId}` | Document detail, metadata update, soft delete |
| POST, OPTIONS | `/api/portal/documents/{documentId}/restore` | Restore a soft-deleted document during cleanup window |
| GET, OPTIONS | `/api/portal/documents/{documentId}/file-url` | Authorized short-lived preview/download URL; requires clean scan status |
| GET, POST, OPTIONS | `/api/portal/documents/{documentId}/share-links` | List/create expiring document share links |
| DELETE, OPTIONS | `/api/portal/document-share-links/{linkId}` | Revoke a document share link |
| POST, OPTIONS | `/api/public/document-shares/{token}` | Public shared-document URL resolver with optional passcode + notice acknowledgement |
| GET, POST, OPTIONS | `/api/landlord/properties` | Landlord or Admin Bearer JWT + onboarded `users` row (email match) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/properties/{id}` | Landlord or Admin (onboarded email role) |
| GET, POST, OPTIONS | `/api/landlord/leases` | Landlord or Admin (onboarded email role; `GET ?property_id=` filters) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/leases/{id}` | Landlord or Admin (onboarded email role) |
| POST, OPTIONS | `/api/landlord/leases/{leaseId}/tenants` | Landlord or Admin (onboarded email role); body `{ "userId": "<uuid>" }` links an existing `users` row |
| DELETE, OPTIONS | `/api/landlord/leases/{leaseId}/tenants/{tenantUserId}` | Landlord or Admin; removes that user from the lease (at least one leaseholder must remain) |
| GET, OPTIONS | `/api/landlord/requests` | Landlord/admin request listing |
| GET, PATCH, OPTIONS | `/api/landlord/requests/{id}` | Landlord/admin request detail + status/vendor/internal notes updates |
| GET, OPTIONS | `/api/landlord/exports/requests.csv` | Landlord/admin CSV export |
| GET, POST, OPTIONS | `/api/portal/admin/landlords` | Admin-only landlord onboarding + listing (active by default) |
| PATCH, OPTIONS | `/api/portal/admin/landlords/{id}` | Admin-only landlord deactivate/reactivate |
| POST, OPTIONS | `/api/internal/jobs/process-notifications` | Notification outbox processor with retries/idempotency status |
| POST, OPTIONS | `/api/internal/jobs/revoke-expired-leases` | Lease access revocation job (ended + non-month-to-month) |

**HAR:** `POST`/`PATCH` on properties with non-empty `har_listing_id` runs a **blocking** HAR fetch (`harListingFetch.ts`). Failure → **422** `har_sync_failed` (no row created/updated).

See [`docs/portal/ENV_CONTRACT.md`](../../docs/portal/ENV_CONTRACT.md) and [`docs/portal/APPLY_METADATA.md`](../../docs/portal/APPLY_METADATA.md).
Phase 2 API contract: [`docs/portal/PHASE2_API_CONTRACT.md`](../../docs/portal/PHASE2_API_CONTRACT.md).

## Deploy

- **CI:** GitHub Actions [`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml) (same `AZURE_*` secrets + `AZURE_FUNCTION_APP_NAME` variable as infra).
- **Manual:** `func azure functionapp publish <name>` after `npm run build` and `npm prune --omit=dev` (see [`infra/azure/README.md`](../../infra/azure/README.md) Part G).

Resource group: **`carwoods.com`**.
