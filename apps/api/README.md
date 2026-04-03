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
| GET, OPTIONS | `/api/public/apply-properties` | Anonymous (CORS via `CORS_ALLOWED_ORIGINS`) |

`public/apply-properties` returns `{ "properties": [] }` until listings are loaded from PostgreSQL.

## Deploy

- **CI:** GitHub Actions [`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml) (same `AZURE_*` secrets + `AZURE_FUNCTION_APP_NAME` variable as infra).
- **Manual:** `func azure functionapp publish <name>` after `npm run build` and `npm prune --omit=dev` (see [`infra/azure/README.md`](../../infra/azure/README.md) Part G).

Resource group: **`carwoods.com`**.
