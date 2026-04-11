# Azure manual setup checklist

Use this when setting up Azure for the portal the first time. This is a concise operator checklist; full detail and troubleshooting remain in `infra/azure/README.md`.

## 1) Confirm target scope

- Subscription selected in Azure CLI/Portal is the intended production subscription.
- Resource group name is exactly `carwoods.com`.
- Resource group region is `eastus2` (East US 2).

## 2) Entra app registration (GitHub OIDC)

- Create app registration for CI/CD login (example name: `github-carwoods-infra`).
- Capture:
  - Application (client) ID -> `AZURE_CLIENT_ID`
  - Directory (tenant) ID -> `AZURE_TENANT_ID`
- Add a federated credential for GitHub Actions:
  - Issuer: `https://token.actions.githubusercontent.com`
  - Audience: `api://AzureADTokenExchange`
  - Subject must exactly match repo owner/name/branch casing (common `AADSTS700213` failure source).

## 3) RBAC assignment

- Assign the app/service principal **Contributor** on RG `carwoods.com` (recommended minimum scope).
- Wait 2-5 minutes for RBAC propagation before first workflow run.

## 4) GitHub Actions secrets/variables

Set repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_SQL_ADMIN_PASSWORD`

Set repository variables:

- `AZURE_FUNCTION_APP_NAME`
- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_SQL_SERVER_NAME`
- `AZURE_COMMUNICATION_SERVICE_NAME` (optional; enables ACS provisioning)
- `AZURE_ACS_USE_MANAGED_IDENTITY` (optional; set `true` to use MI auth mode for ACS)
- `AZURE_ACS_CHANNELS` (optional with MI mode: `email`, `sms`, or `both`; default `both`)
- `AZURE_LOCATION` = `eastus2` (recommended explicit)
- `AZURE_SQL_ADMIN_USER` (optional; defaults to `carwoodsadmin`)
- `AZURE_SQL_DATABASE_NAME` (optional; defaults to `carwoods_portal_prod`)

## 5) Run infrastructure workflow

- GitHub Actions -> run `azure-infrastructure.yml`.
- Optional first pass with `what-if` only.
- Verify resources were created/updated in `carwoods.com`.
- If `AZURE_COMMUNICATION_SERVICE_NAME` is set, verify ACS exists.
- If `AZURE_ACS_USE_MANAGED_IDENTITY=true`, verify Function App app settings contain:
  - `ACS_AUTH_MODE=managed_identity`
  - `ACS_ENDPOINT`
  and verify a role assignment exists for the Function App managed identity on the ACS resource scope.
- If `AZURE_ACS_USE_MANAGED_IDENTITY` is unset or `false`, verify Function App app settings contain:
  - `ACS_AUTH_MODE=connection_string`
  - `ACS_CONNECTION_STRING`
  - `ACS_ENDPOINT`

## 6) Deploy API code

- Run `azure-functions-deploy.yml` (or local `func azure functionapp publish`).
- Verify:
  - `GET /api/health` returns success
  - Function host URL matches expected app name

## 7) Configure Function App settings

- Set/verify required app settings from `docs/portal/ENV_CONTRACT.md`, especially:
  - `DATABASE_URL`
  - storage settings (`AzureWebJobsStorage`, blob config)
  - `ACS_CONNECTION_STRING` (or MI equivalent)
  - `FIREBASE_PROJECT_ID`
  - CORS via `CORS_ALLOWED_ORIGINS`
- Restart app if needed after setting updates.

## 8) Run SQL migrations

- Run `azure-sql-migrations.yml` (or local migration runner).
- Confirm `dbo.__migrations` has expected rows.

## 9) Point frontend to API

- Set `VITE_API_BASE_URL` for deployed frontend environment.
- Confirm portal authentication and API requests succeed from browser.

## 10) Final smoke test

- Sign in to portal with a valid role.
- Create/view a maintenance request.
- Confirm notification and request endpoints return expected results.

## 11) ACS follow-up (often manual)

- Email sending domain verification/DNS setup may require manual DNS records.
- SMS enablement may require number procurement and compliance/registration approval per country/region.

---

For detailed commands, naming rules, and troubleshooting (`AADSTS700213`, no subscription visibility, RBAC failures), use `infra/azure/README.md`.
