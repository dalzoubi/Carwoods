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
| `DATABASE_URL`                                    | Yes         | Azure SQL ADO.NET connection string set by Bicep (Server=<host>,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=yes;TrustServerCertificate=no)             |
| `BLOB_CONNECTION_STRING` or managed identity vars | Yes         | Blob access for SAS generation                        |
| `BLOB_ACCOUNT_URL`                                | If using MI | `https://{account}.blob.core.windows.net`             |
| `ACS_CONNECTION_STRING` or ACS + MI               | Yes (email) | Azure Communication Services                          |
| `GEMINI_API_KEY`                                  | Yes (AI)    | Backend only; never in Vite env                       |
| `ENTRA_TENANT_ID`                                 | Yes         | External ID tenant ID (reference; not used directly by current JWT code) |
| `ENTRA_API_AUDIENCE`                              | Yes         | API app registration audience (`aud`) for JWT validation |
| `ENTRA_ISSUER`                                    | Yes         | Token issuer (`iss`) — must match access tokens exactly (including trailing slash) |
| `ENTRA_OPENID_METADATA_URL`                       | No          | Full OpenID metadata URL; if unset, `{ENTRA_ISSUER}/.well-known/openid-configuration` |
| `ENTRA_ADMIN_OBJECT_IDS`                          | No (legacy) | Legacy allowlist path. Current management authorization is driven by onboarded `users` rows matched by JWT email. |
| `ENTRA_LANDLORD_OBJECT_IDS`                       | No (legacy) | Legacy allowlist path. Current management authorization is driven by onboarded `users` rows matched by JWT email. |
| `CORS_ALLOWED_ORIGINS`                            | Recommended | Comma-separated origins for browser calls (public + portal + admin). Supports `*` patterns (e.g. Vercel previews). Defaults include localhost + carwoods.com if unset. |


## Feature flags (API or shared config)


| Variable                    | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `FEATURE_HAR_IDX_SYNC`      | Enable credentialed IDX provider when available                |
| `FEATURE_VENDOR_PORTAL`     | Vendor self-service UI + endpoints                             |
| `FEATURE_APPLY_API_DEFAULT` | Use `GET /api/public/apply-properties` as primary for `/apply` |


## Frontend (Vite — public only)


| Variable                 | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Base URL for portal/public API (no trailing slash). Production example: `https://carwoods-com-api.azurewebsites.net` until a custom domain is used. |
| `VITE_ENTRA_CLIENT_ID`   | SPA app registration client ID                                   |
| `VITE_ENTRA_AUTHORITY`   | External ID authority URL                                        |
| `VITE_ENTRA_API_SCOPE`   | Scope(s) for API token                                           |
| `VITE_FEATURE_APPLY_API` | When **not** `false`, and `VITE_API_BASE_URL` is set, `/apply` uses `GET /api/public/apply-properties` first; falls back to the generated file on error or empty API response. |
| `VITE_FEATURE_APPLY_DUAL_SOURCE` | Dev only: set to `false` to disable console compare of API vs generated tiles. |


**Never** set `GEMINI_API_KEY`, `DATABASE_URL`, `BLOB_`* secrets, or ACS secrets in `VITE_*`.

## Local development

- Copy `.env.example` at repo root and `apps/api/local.settings.json.example` → `local.settings.json` (gitignored).
- Use a local SQL Server instance (or `mcr.microsoft.com/mssql/server:2022-latest` via Docker) and Azurite for storage if desired.

