# Azure manual setup checklist

Use this when setting up Azure for the portal the first time. This is a concise operator checklist; full detail and troubleshooting remain in `infra/azure/README.md`.

## 1) Confirm target scope

1. Subscription selected in Azure CLI/Portal is the intended production subscription.
2. Resource group name is exactly `carwoods.com`.
3. Resource group region is `eastus2` (East US 2).

## 2) Entra app registration (GitHub OIDC)

1. Create app registration for CI/CD login (example name: `github-carwoods-infra`).
2. Capture:
   1. Application (client) ID -> `AZURE_CLIENT_ID`
   2. Directory (tenant) ID -> `AZURE_TENANT_ID`
3. Add a federated credential for GitHub Actions:
   1. Issuer: `https://token.actions.githubusercontent.com`
   2. Audience: `api://AzureADTokenExchange`
   3. Subject must exactly match repo owner/name/branch casing (common `AADSTS700213` failure source).

## 3) RBAC assignment

1. Assign the app/service principal **Contributor** on RG `carwoods.com` (recommended minimum scope).
2. Wait 2-5 minutes for RBAC propagation before first workflow run.

## 4) GitHub Actions secrets/variables

Set repository secrets:

1. `AZURE_CLIENT_ID`
2. `AZURE_TENANT_ID`
3. `AZURE_SUBSCRIPTION_ID`
4. `AZURE_SQL_ADMIN_PASSWORD`

Set repository variables:

1. `AZURE_FUNCTION_APP_NAME`
2. `AZURE_STORAGE_ACCOUNT_NAME`
3. `AZURE_SQL_SERVER_NAME`
4. `AZURE_COMMUNICATION_SERVICE_NAME` (optional; enables ACS provisioning)
5. `AZURE_ACS_USE_MANAGED_IDENTITY` (optional; set `true` to use MI auth mode for ACS)
6. `AZURE_ACS_CHANNELS` (optional with MI mode: `email`, `sms`, or `both`; default `both`)
7. `AZURE_LOCATION` = `eastus2` (recommended explicit)
8. `AZURE_SQL_ADMIN_USER` (optional; defaults to `carwoodsadmin`)
9. `AZURE_SQL_DATABASE_NAME` (optional; defaults to `carwoods_portal_prod`)
10. `AZURE_STORAGE_CONTAINER_NAME` (optional; defaults to `carwoods-portal-prod` in the infra workflow)
11. `DOCUMENT_STORAGE_CONTAINER_NAME` (optional; defaults to `carwoods-documents-prod` in the infra workflow)
12. `DOCUMENT_CENTER_ENABLED` (optional; defaults to `true`)
13. `DOCUMENT_CENTER_SCAN_BYPASS` (optional; production should be `false`)

## 5) Run infrastructure workflow

1. GitHub Actions -> run `azure-infrastructure.yml`.
2. Optional first pass with `what-if` only.
3. Verify resources were created/updated in `carwoods.com`.
4. If `AZURE_COMMUNICATION_SERVICE_NAME` is set, verify ACS exists.
5. If `AZURE_ACS_USE_MANAGED_IDENTITY=true`, verify Function App app settings contain:
   1. `ACS_AUTH_MODE=managed_identity`
   2. `ACS_ENDPOINT`
   and verify a role assignment exists for the Function App managed identity on the ACS resource scope.
6. If `AZURE_ACS_USE_MANAGED_IDENTITY` is unset or `false`, verify Function App app settings contain:
   1. `ACS_AUTH_MODE=connection_string`
   2. `ACS_CONNECTION_STRING`
   3. `ACS_ENDPOINT`

## 6) Deploy API code

1. Run `azure-functions-deploy.yml` (or local `func azure functionapp publish`).
2. Verify:
   1. `GET /api/health` returns success
   2. Function host URL matches expected app name

## 7) Configure Function App settings

1. Set/verify required app settings from `docs/portal/ENV_CONTRACT.md`, especially:
   1. `DATABASE_URL`
   2. storage settings (`AzureWebJobsStorage`, blob config)
   3. Document Center settings:
      1. `DOCUMENT_STORAGE_CONTAINER_NAME=carwoods-documents-prod`
      2. `DOCUMENT_CENTER_ENABLED=true`
      3. `DOCUMENT_CENTER_SCAN_BYPASS=false`
      4. `NODE_ENV=production`
   4. `ACS_CONNECTION_STRING` (or MI equivalent)
   5. `FIREBASE_PROJECT_ID`
   6. CORS via `CORS_ALLOWED_ORIGINS`
2. Restart app if needed after setting updates.

## 8) Run SQL migrations

1. Run `azure-sql-migrations.yml` (or local migration runner).
2. Confirm `dbo.__migrations` has expected rows.

## 9) Point frontend to API

1. Set `VITE_API_BASE_URL` for deployed frontend environment.
2. Confirm portal authentication and API requests succeed from browser.

## 10) Final smoke test

1. Sign in to portal with a valid role.
2. Create/view a maintenance request.
3. Confirm notification and request endpoints return expected results.
4. For Document Center, confirm the Function App has a private `carwoods-documents-prod` blob container (or the value you set in `DOCUMENT_STORAGE_CONTAINER_NAME`) and that uploads remain scan-gated in production (`DOCUMENT_CENTER_SCAN_BYPASS=false`) until Defender scan callbacks are wired.

## 11) ACS follow-up (often manual)

1. Email sending domain verification/DNS setup may require manual DNS records.
2. SMS enablement may require number procurement and compliance/registration approval per country/region.

---

For detailed commands, naming rules, and troubleshooting (`AADSTS700213`, no subscription visibility, RBAC failures), use `infra/azure/README.md`.
