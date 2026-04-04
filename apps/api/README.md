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
| GET, POST, OPTIONS | `/api/landlord/properties` | Landlord or Admin Bearer JWT + onboarded `users` row (email match) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/properties/{id}` | Landlord or Admin (onboarded email role) |
| GET, POST, OPTIONS | `/api/landlord/leases` | Landlord or Admin (onboarded email role; `GET ?property_id=` filters) |
| GET, PATCH, DELETE, OPTIONS | `/api/landlord/leases/{id}` | Landlord or Admin (onboarded email role) |
| POST, OPTIONS | `/api/landlord/leases/{leaseId}/tenants` | Landlord or Admin (onboarded email role); body `{ "userId": "<uuid>" }` links an existing `users` row |

**HAR:** `POST`/`PATCH` on properties with non-empty `har_listing_id` runs a **blocking** HAR fetch (same parsing as `scripts/fetchHarRentalApplyTiles.mjs`). Failure → **422** `har_sync_failed` (no row created/updated).

See [`docs/portal/ENV_CONTRACT.md`](../../docs/portal/ENV_CONTRACT.md) and [`docs/portal/APPLY_METADATA.md`](../../docs/portal/APPLY_METADATA.md).

## Deploy

- **CI:** GitHub Actions [`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml) (same `AZURE_*` secrets + `AZURE_FUNCTION_APP_NAME` variable as infra).
- **Manual:** `func azure functionapp publish <name>` after `npm run build` and `npm prune --omit=dev` (see [`infra/azure/README.md`](../../infra/azure/README.md) Part G).

Resource group: **`carwoods.com`**.
