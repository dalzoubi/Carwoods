# Environment variable contract

Values are **names only**; store secrets in Azure Key Vault or Function App settings, not in the repo.

## Resource group (mandatory convention)


| Name                   | Description                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `AZURE_RESOURCE_GROUP` | Must be **`carwoods.com`** for this project. CI/deploy scripts should assert this. |


## Azure Functions (`apps/api`)


| Variable                                          | Required    | Description                                           |
| ------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `FUNCTIONS_WORKER_RUNTIME`                        | Yes         | `node`                                                |
| `AzureWebJobsStorage`                             | Yes (Azure) | Storage account connection for Functions runtime      |
| `DATABASE_URL`                                    | Yes         | PostgreSQL connection string (prefer SSL)             |
| `BLOB_CONNECTION_STRING` or managed identity vars | Yes         | Blob access for SAS generation                        |
| `BLOB_ACCOUNT_URL`                                | If using MI | `https://{account}.blob.core.windows.net`             |
| `ACS_CONNECTION_STRING` or ACS + MI               | Yes (email) | Azure Communication Services                          |
| `GEMINI_API_KEY`                                  | Yes (AI)    | Backend only; never in Vite env                       |
| `ENTRA_TENANT_ID`                                 | Yes         | External ID tenant ID                                 |
| `ENTRA_API_AUDIENCE`                              | Yes         | API app registration audience / scope                 |
| `ENTRA_ISSUER`                                    | Yes         | Token issuer URL for JWT validation                   |
| `CORS_ALLOWED_ORIGINS`                            | Recommended | Comma-separated origins allowed to call anonymous HTTP APIs from the browser (e.g. `https://carwoods.com,https://www.carwoods.com`). Used by `GET /api/public/apply-properties`. Defaults in code include localhost + carwoods.com if unset. |


## Feature flags (API or shared config)


| Variable                    | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `FEATURE_HAR_IDX_SYNC`      | Enable credentialed IDX provider when available                |
| `FEATURE_VENDOR_PORTAL`     | Vendor self-service UI + endpoints                             |
| `FEATURE_APPLY_API_DEFAULT` | Use `GET /api/public/apply-properties` as primary for `/apply` |


## Frontend (Vite — public only)


| Variable                 | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Base URL for portal/public API (no trailing slash). Production example: `https://carwoods-api-2026.azurewebsites.net` until a custom domain is used. |
| `VITE_ENTRA_CLIENT_ID`   | SPA app registration client ID                                   |
| `VITE_ENTRA_AUTHORITY`   | External ID authority URL                                        |
| `VITE_ENTRA_API_SCOPE`   | Scope(s) for API token                                           |
| `VITE_FEATURE_APPLY_API` | When **not** `false`, and `VITE_API_BASE_URL` is set, `/apply` uses `GET /api/public/apply-properties` first; falls back to the generated file on error or empty API response. |
| `VITE_FEATURE_APPLY_DUAL_SOURCE` | Dev only: set to `false` to disable console compare of API vs generated tiles. |


**Never** set `GEMINI_API_KEY`, `DATABASE_URL`, `BLOB_`* secrets, or ACS secrets in `VITE_*`.

## Local development

- Copy `.env.example` at repo root and `apps/api/local.settings.json.example` → `local.settings.json` (gitignored).
- Use a dev PostgreSQL instance and Azurite for storage if desired.

