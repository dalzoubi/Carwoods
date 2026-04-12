# Environment variable contract

Values are **names only**; store secrets in Azure Key Vault or Function App settings, not in the repo.

Manual Azure setup checklist: `docs/portal/AZURE_MANUAL_SETUP_CHECKLIST.md`.

## Resource group (mandatory convention)


| Name                   | Description                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `AZURE_RESOURCE_GROUP` | Must be **`carwoods.com`** for this project. CI/deploy scripts should assert this. |
| `AZURE_ACS_CHANNELS`   | Optional GitHub Actions variable used in ACS managed-identity mode to select RBAC channel scope: `email`, `sms`, or `both` (default). |


## Azure Functions (`apps/api`)


| Variable                                          | Required    | Description                                           |
| ------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `FUNCTIONS_WORKER_RUNTIME`                        | Yes         | `node`                                                |
| `AzureWebJobsStorage`                             | Yes (Azure) | Storage account connection string for the Functions host (timer leases, internal state). Local: same format as portal **Access keys** connection string, or `UseDevelopmentStorage=true` with Azurite.      |
| `DATABASE_URL`                                    | Yes         | Azure SQL ADO.NET connection string set by Bicep (Server=<host>,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=yes;TrustServerCertificate=no)             |
| `BLOB_CONNECTION_STRING` or managed identity vars | Yes         | Blob access for SAS generation                        |
| `BLOB_ACCOUNT_URL`                                | If using MI | `https://{account}.blob.core.windows.net`             |
| `ACS_CONNECTION_STRING` or ACS + MI               | Yes (email) | Azure Communication Services connection details       |
| `ACS_ENDPOINT`                                    | Recommended | ACS endpoint/host used by SDK clients; set automatically by infra workflow when ACS is provisioned |
| `ACS_AUTH_MODE`                                   | Recommended | `connection_string` (default workflow behavior) or `managed_identity` when `AZURE_ACS_USE_MANAGED_IDENTITY=true` |
| `GEMINI_API_KEY`                                  | Yes (AI)    | Backend only; never in Vite env                       |
| `LLM_TIMEOUT_MS`                                  | No          | Per-attempt HTTP timeout in ms. Default: `15000`      |
| `LLM_MAX_PRIMARY_ATTEMPTS`                        | No          | Max retries on primary model. Default: `3`            |
| `LLM_MAX_FALLBACK_ATTEMPTS`                       | No          | Max retries on fallback model. Default: `2`           |
| `LLM_RETRY_BASE_DELAY_MS`                         | No          | Exponential backoff base in ms. Default: `500`        |
| `LLM_RETRY_MAX_DELAY_MS`                          | No          | Backoff cap in ms. Default: `10000`                   |
| `LLM_RETRY_JITTER_FACTOR`                         | No          | Jitter fraction 0–1. Default: `0.3`                   |
| `LLM_CB_FAILURE_THRESHOLD`                        | No          | Consecutive failures to open circuit. Default: `5`    |
| `LLM_CB_OPEN_DURATION_MS`                         | No          | Circuit open window in ms. Default: `60000`           |
| `LLM_CB_HALF_OPEN_PROBES`                         | No          | Successes to close circuit from half-open. Default: `2` |
| `FIREBASE_PROJECT_ID`                             | Yes         | Firebase project ID used as JWT audience and issuer suffix |
| `FIREBASE_OPENID_METADATA_URL`                    | No          | Full OpenID metadata URL override; if unset, defaults to `https://securetoken.google.com/{FIREBASE_PROJECT_ID}/.well-known/openid-configuration` |
| `CORS_ALLOWED_ORIGINS`                            | Recommended | Comma-separated origins for browser calls (public + portal + admin). Supports `*` patterns (e.g. Vercel previews). Defaults include localhost + carwoods.com if unset. |
| `PORTAL_LINK_SIGNING_SECRET`                      | Recommended | HMAC secret for signed attachment deep links and reply-to tokens (≥16 chars). Falls back to `NOTIFICATION_LINK_SIGNING_SECRET`, then a dev-only default. |
| `INBOUND_EMAIL_INGEST_SECRET`                     | For inbound reply | Shared secret; HTTP handler requires header `x-carwoods-email-ingest-secret`. |
| `INBOUND_EMAIL_REPLY_LOCAL_PREFIX`                | No          | Plus-address local-part prefix before the signed token (default `cwreply`). Example recipient: `cwreply+<token>@yourdomain`. |
| `NOTIFICATION_OUTBOX_TIMER_DISABLED`              | No          | When `true`, the timer function is **not registered** (skips storage-backed timer listener — useful for local dev without Azurite). Drains `notification_outbox` via HTTP `POST /api/internal/jobs/process-notifications` instead. In Azure, leave unset or `false` so the timer runs. |
| `NOTIFICATION_OUTBOX_TIMER_CRON`                | No          | NCRONTAB schedule for the outbox timer. Default `0 */1 * * * *` (every minute at second 0). |
| `NOTIFICATION_OUTBOX_TIMER_BATCH_LIMIT`         | No          | Max outbox rows processed per timer tick. Default `25`. |


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
| `VITE_FIREBASE_API_KEY`     | Firebase web API key used to initialize the Firebase client SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain, usually `{project}.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID`  | Firebase project ID; should match API `FIREBASE_PROJECT_ID` |
| `VITE_FEATURE_APPLY_API` | When **not** `false`, and `VITE_API_BASE_URL` is set, `/apply` uses `GET /api/public/apply-properties` first; falls back to the generated file on error or empty API response. |
| `VITE_FEATURE_APPLY_DUAL_SOURCE` | Dev only: set to `false` to disable console compare of API vs generated tiles. |
| `VITE_NOTIFICATIONS_POLL_MS` | Optional notification poll cadence in ms for signed-in users (main site + portal headers). Default `60000`; clamped to min `10000`, max `300000`. When the notification tray is open, polling uses at most **8s** (still respects a shorter base interval if configured). |
| `VITE_MESSAGES_POLL_MS` | Optional cadence in ms for refreshing the open maintenance request thread (portal). Default `15000`; clamped to min `10000`, max `300000`. |


**Never** set `GEMINI_API_KEY`, `DATABASE_URL`, `BLOB_`* secrets, or ACS secrets in `VITE_*`.

## Local development

1. Root: start from `.env.example` if you need a tracked baseline; add `CHOKIDAR_USEPOLLING=true` as needed.
2. Portal + API: `.env.portal.local.example` → `.env.portal.local` (Vite `portal` mode) and `apps/api/local.settings.json.example` → `local.settings.json` (gitignored). See `scripts/start-local-portal.ps1` for Docker SQL + migration helper.
3. Use a local SQL Server instance (or `mcr.microsoft.com/mssql/server:2022-latest` via Docker). For `func start`, set `AzureWebJobsStorage` to a **real storage connection string** (see `local.settings.json.example`) or run **Azurite** with `UseDevelopmentStorage=true`. Enabling the notification outbox **timer** (`NOTIFICATION_OUTBOX_TIMER_DISABLED` not `true`) requires working storage either way; the example defaults the timer to disabled for simpler local startup.

