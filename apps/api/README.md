# @carwoods/api

Azure Functions (Node.js, TypeScript) for the tenant portal and admin API.

## Prerequisites

- Node 20+
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
| GET, POST, OPTIONS | `/api/admin/properties` | Admin Bearer JWT + `ENTRA_ADMIN_OBJECT_IDS` |
| GET, PATCH, DELETE, OPTIONS | `/api/admin/properties/{id}` | Admin |
| GET, POST, OPTIONS | `/api/admin/leases` | Admin (`GET ?property_id=` filters) |
| GET, PATCH, DELETE, OPTIONS | `/api/admin/leases/{id}` | Admin |
| POST, OPTIONS | `/api/admin/leases/{leaseId}/tenants` | Admin; body `{ "userId": "<uuid>" }` links an existing `users` row |

**HAR:** `POST`/`PATCH` on properties with non-empty `har_listing_id` runs a **blocking** HAR fetch (same parsing as `scripts/fetchHarRentalApplyTiles.mjs`). Failure → **422** `har_sync_failed` (no row created/updated).

See [`docs/portal/ENV_CONTRACT.md`](../../docs/portal/ENV_CONTRACT.md) and [`docs/portal/APPLY_METADATA.md`](../../docs/portal/APPLY_METADATA.md).

## Deploy

- **CI:** GitHub Actions [`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml) (same `AZURE_*` secrets + `AZURE_FUNCTION_APP_NAME` variable as infra).
- **Manual:** `func azure functionapp publish <name>` after `npm run build` and `npm prune --omit=dev` (see [`infra/azure/README.md`](../../infra/azure/README.md) Part G).

Resource group: **`carwoods.com`**.
