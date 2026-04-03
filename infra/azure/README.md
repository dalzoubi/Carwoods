# Azure infrastructure (`carwoods.com`)

All application Azure resources for the tenant portal **must** be deployed into resource group **`carwoods.com`**.

## GitHub Actions (automatic deploy)

Workflow: [`.github/workflows/azure-infrastructure.yml`](../../.github/workflows/azure-infrastructure.yml).

- **Triggers:** `workflow_dispatch` (manual; optional **What-if only**), or `push` to `main` when `infra/azure/main.bicep` or this workflow file changes.
- **Target:** Always resource group **`carwoods.com`** (enforced in the workflow).

### One-time Azure setup (OpenID Connect — no client secret in GitHub)

1. **Microsoft Entra ID → App registrations → New registration** (or use an existing CI app). Name e.g. `github-carwoods-infra`.
2. **Certificates & secrets → Federated credentials → Add**:
   - **Federated credential scenario:** GitHub Actions deploying Azure resources.
   - **Organization** / **Repository:** your GitHub org/user and `carwoods` repo.
   - **Entity type:** Branch, ref `refs/heads/main` (or **Environment** if you prefer `environment: production` in the workflow).
   - **Name:** e.g. `github-main-carwoods`.
3. **Subscription → Access control (IAM) → Add role assignment:** role **Contributor** (or a custom role scoped to RG `carwoods.com` only) to this app.
4. **Copy** Application (client) ID, Directory (tenant) ID, and your **Subscription ID**.

### GitHub repository configuration

**Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `AZURE_CLIENT_ID` | App registration *Application (client) ID* |
| `AZURE_TENANT_ID` | *Directory (tenant) ID* |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

**Variables** (same page → *Variables* tab):

| Variable | Example | Notes |
|----------|---------|--------|
| `AZURE_FUNCTION_APP_NAME` | `carwoods-api-xxxxx` | Globally unique; allowed characters per Azure Functions naming |
| `AZURE_STORAGE_ACCOUNT_NAME` | `carwoodssitexxxxx` | Lowercase letters and numbers only, **3–24** chars, globally unique |
| `AZURE_LOCATION` | `southcentralus` | Optional; used on `push` runs when not using `workflow_dispatch` |

Run **Actions → Azure infrastructure → Run workflow**; set **What-if only** to `true` first to preview changes.

To deploy only manually, delete or comment out the `push:` block in the workflow file.

---

## Deploy (resource group scoped, local CLI)

```bash
az group create -n carwoods.com -l southcentralus   # if it does not exist

az deployment group create \
  --resource-group carwoods.com \
  --template-file main.bicep \
  --parameters functionAppName=carwoods-api-<unique> storageAccountName=carwoodssite<unique>
```

## Parameters

See `main.bicep` for `functionAppName` and `storageAccountName` (globally unique). Add PostgreSQL, ACS, and Key Vault in a follow-up iteration or extend `main.bicep`.

## Guard script (PowerShell)

From repo root:

```powershell
./infra/azure/assert-resource-group.ps1 -ExpectedName 'carwoods.com'
```

Use this in CI before `az deployment group create` to avoid accidental wrong RG.
