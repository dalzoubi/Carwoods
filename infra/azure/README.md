# Azure infrastructure — `carwoods.com` (East US 2)

This folder defines **Infrastructure as Code** for the tenant portal backend. All resources for this project must live in resource group `carwoods.com` in region **East US 2** (`eastus2`).


| Item           | Value                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Resource group | `carwoods.com` (exact name; enforced in CI)                                                      |
| Region         | `eastus2` (East US 2)                                                                            |
| Template       | [`main.bicep`](./main.bicep)                                                                     |
| CI workflow    | [`.github/workflows/azure-infrastructure.yml`](../../.github/workflows/azure-infrastructure.yml) |


---

## What `main.bicep` creates today

The template is **scoped to an existing or new resource group** (`carwoods.com`). Each run creates or updates:


| Azure resource                             | Purpose                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Storage account** (`storageAccountName`) | Functions runtime storage (`AzureWebJobsStorage`), file share content for the Function App         |
| **App Service plan**                       | Name `{functionAppName}-plan`, **Linux Consumption** (SKU `Y1`, Dynamic)                           |
| **Function App** (`functionAppName`)       | **Linux**, Node **24**, Functions runtime **~4**, **system-assigned managed identity**, HTTPS only |
| **Azure SQL logical server** (`sqlServerName`) | SQL Server 2022, TLS 1.2, public access enabled, firewall open to Azure services. |
| **Azure SQL database** (`sqlDatabaseName`) | **Basic** tier, 5 DTUs, 2 GiB max. ~$5/month. Collation `SQL_Latin1_General_CP1_CI_AS`. Database `carwoods_portal` (override via Bicep param). |
| **Firewall rule** `AllowAzureServices`     | `0.0.0.0`–`0.0.0.0` so **Azure services** (including this Function App's outbound IPs) can connect. |


**Not in Bicep yet** (Portal or future Bicep): Blob containers for uploads, Azure Communication Services, Key Vault references, Application Insights wiring, custom domains, VNet integration for SQL.

**Important:** This workflow only provisions the **shell** (hosting + storage + database). Deploying **your compiled** `apps/api` code is a separate step (`func azure functionapp publish`, GitHub Actions deploy job, or VS Code — document that in portal docs when you add it).

---

## Prerequisites

1. **Azure subscription** where you are allowed to create resource groups and deploy resources.
2. **Owner**, **Contributor**, or **User Access Administrator + Contributor** on that subscription (or on RG `carwoods.com` if you use RG-scoped IAM only).
3. **Microsoft Entra ID** rights to create an **App registration** (Application Administrator, Cloud Application Administrator, or Global Administrator in many tenants).
4. **GitHub** admin access to the `carwoods` repository (to add secrets, variables, and workflows).

---

## Part A — Resource group `carwoods.com`

### If the group already exists (your case)

- Confirm in **Azure Portal → Resource groups → carwoods.com** that **Location** is **East US 2**.
- The workflow's `az group create` step is **idempotent**: it will not change an existing group's region. If the name `carwoods.com` is taken in another region in a different subscription, fix **subscription** or **name** in Azure — do not change the enforced name in this repo without a deliberate policy change.

### If you are creating it for the first time

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID_OR_NAME>"

az group create \
  --name carwoods.com \
  --location eastus2
```

---

## Part B — Entra app registration + federated credential (GitHub OIDC)

GitHub Actions will authenticate **without** storing an Azure client secret, using **OpenID Connect** and a **federated identity credential**.

### B1. Register an application

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name:** e.g. `github-carwoods-infra` (any label is fine).
3. **Supported account types:** *Accounts in this organizational directory only* (single tenant) is typical.
4. **Redirect URI:** leave empty (not used for this flow).
5. **Register** → copy **Application (client) ID** → GitHub secret `AZURE_CLIENT_ID`.
6. On the overview page, copy **Directory (tenant) ID** → `AZURE_TENANT_ID`.

### B2. Add a federated credential for GitHub Actions

1. Same app → **Certificates & secrets** → tab **Federated credentials** → **Add credential**.
2. **Federated credential scenario:** choose **GitHub Actions deploying Azure resources** (if available), or **Other issuer** and fill manually (see table below).
3. If using the GitHub scenario wizard:
   - **Organization:** your GitHub org or **username** (for a user repo) — spelling and casing must match GitHub exactly.
   - **Repository:** the repo **slug as GitHub shows it in the URL** (e.g. `Carwoods` if the URL is `github.com/dalzoubi/Carwoods`). **Not** necessarily all lowercase.
   - **Entity type:** **Branch** → **Branch name:** `main`  
     This matches workflows that run on `push` to `main` and `workflow_dispatch` from the default branch.  
     *Alternative:* **Pull request** if you add a PR validation job later (requires a **second** federated credential with entity type **Pull request**).
   - **Name:** e.g. `github-carwoods-main`.
4. **Save.**

**Critical — repository name casing:** GitHub's OIDC **subject** uses the **exact** owner and repository names from the repository URL. Example: if the repo is `https://github.com/dalzoubi/Carwoods`, the subject contains **`Carwoods`** (capital C). If you entered `carwoods` in the federated credential wizard, login fails with **`AADSTS700213`** (*No matching federated identity record*). **Fix:** edit the federated credential in Entra and set the subject to match the error message exactly (see [Troubleshooting: AADSTS700213](#troubleshooting-aadsts700213-no-matching-federated-identity) below).

**Manual fields (if your portal UI differs):**

| Field | Value |
| ----- | ----- |
| **Issuer** | `https://token.actions.githubusercontent.com` |
| **Subject identifier** | Must match GitHub's assertion **byte-for-byte**. Typical form: `repo:OWNER/RepoName:ref:refs/heads/BRANCH` — **OWNER** and **RepoName** casing must match `github.com/OWNER/RepoName`. |
| **Audience** | `api://AzureADTokenExchange` (default for Azure's GitHub federation) |

**Subject examples:**

| Trigger you need | Subject (`repo:...`) |
| ---------------- | -------------------- |
| Pushes to `main` on `github.com/dalzoubi/Carwoods` | `repo:dalzoubi/Carwoods:ref:refs/heads/main` |
| Pushes to `main` on `github.com/MyOrg/carwoods` | `repo:MyOrg/carwoods:ref:refs/heads/main` |
| Environment `production` | `repo:OWNER/RepoName:environment:production` (and add `environment: production` on the workflow job) |

If login fails with **subject** or **audience** errors, the subject string does not match (wrong owner, **wrong repo casing**, or branch).

### B3. API permissions (usually none for ARM)

For **ARM / Bicep deployments**, the app uses **Azure RBAC** on the subscription or resource group. You typically **do not** need to add Microsoft Graph **Application permissions** for this infra workflow.

---

## Part C — Azure RBAC (what the GitHub app is allowed to do)

The federated identity needs permission to **deploy into** `carwoods.com` (and create resources inside it).

### Option 1 — Contributor on the resource group (least scope, recommended)

1. Azure Portal → **Resource groups** → **carwoods.com** → **Access control (IAM)**.
2. **Add** → **Add role assignment**.
3. **Role:** **Contributor**.
4. **Members** → **User, group, or service principal** → **Select members** → search for your app name `github-carwoods-infra` → select → **Review + assign**.

### Option 2 — Contributor on the subscription (broader)

Same steps at **Subscriptions → your subscription → Access control (IAM)**. Easier for testing; use Option 1 for production hygiene.

### Option 3 — Custom role

If your organization forbids Contributor, define a custom role that allows `Microsoft.Resources/deployments/`* and resource write for the resource types in `main.bicep` — that is advanced; start with Contributor on the RG.

---

## Part D — GitHub repository configuration

Path: **GitHub repo → Settings → Secrets and variables → Actions**.

### D1. Repository secrets (Sensitive)

Open the **Secrets** tab → **New repository secret**. Create exactly these **names** (case-sensitive):


| Secret name                    | Where to get the value                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`              | App registration → **Application (client) ID**                             |
| `AZURE_TENANT_ID`              | Entra tenant → **Directory (tenant) ID** (same as on app overview)         |
| `AZURE_SUBSCRIPTION_ID`        | Azure Portal → **Subscriptions** → your subscription → **Subscription ID** |
| `AZURE_SQL_ADMIN_PASSWORD`     | Choose a strong password for the SQL admin user. Must be ≥ 8 chars and include at least one uppercase letter, one lowercase letter, one digit, and one special character. Do **not** use the password in a plain-text connection string outside of GitHub Secrets or Azure Key Vault. |


**CLI alternative for subscription ID:**

```bash
az account show --query id -o tsv
```

### D2. Repository variables (Non-secret, required for deploy)

Open the **Variables** tab → **New repository variable**.


| Variable name                | Rules                                                                                                                                                                                   | Example             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `AZURE_FUNCTION_APP_NAME`    | **Globally unique** in Azure. Letters, numbers, hyphens; see [naming rules](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules#microsoftwebsites). | `carwoods-api-a7b2` |
| `AZURE_STORAGE_ACCOUNT_NAME` | **Globally unique**, **3–24** chars, **lowercase letters and numbers only** (no hyphens).                                                                                               | `carwoodssitea7b2`  |
| `AZURE_SQL_SERVER_NAME`      | **Globally unique** DNS name for the Azure SQL logical server. **1–63** chars, **lowercase** letters, numbers, hyphens; cannot start or end with a hyphen.                              | `carwoods-api-sql`  |
| `AZURE_LOCATION`             | **Recommended.** Set to `eastus2` so push-triggered runs use the same region as your resource group. If unset, the workflow defaults to `eastus2`. | `eastus2`           |
| `AZURE_SQL_ADMIN_USER`       | **Optional.** Admin login for the SQL server used by the `db-migrate` job. If unset, defaults to `carwoodsadmin` (the Bicep param default). Only needed if you deployed with a custom `sqlAdminUser`. | `carwoodsadmin`     |


**Check name availability (CLI, after `az login`):**

```bash
# Storage account name must be available globally
az storage account check-name --name carwoodssitea7b2 --query nameAvailable -o tsv

# Azure SQL server names must be globally unique:
az sql server list --query "[].name" -o tsv
```

---

## Part E — Run the GitHub workflow

1. **Actions** → workflow **Azure infrastructure** → **Run workflow**.
2. **Branch:** `main` (or the branch your federated credential trusts).
3. **Location:** default `eastus2` (must stay consistent with RG **East US 2**).
4. **What-if only:** set to `true` for the **first** run to preview ARM changes without applying; then run again with `false` to deploy.

**Automatic runs:** On **push** to `main`, the workflow also runs when `infra/azure/main.bicep` or `.github/workflows/azure-infrastructure.yml` changes. To avoid accidental deploys, remove or comment out the `push:` block in the YAML.

**Success:** The workflow runs two jobs:

1. **Deploy Bicep to carwoods.com** — provisions/updates Azure resources and prints JSON outputs (`functionAppHost`, `sqlServerFqdn`, etc.).
2. **Apply DB migrations** — installs `go-sqlcmd`, creates a `__migrations` tracking table if absent, then applies each migration file in `infra/db/migrations/` in order. Already-applied migrations are skipped (idempotent). Skipped automatically on dry-run runs. Can be disabled via the `run_migrations` input.

**Failure — common causes:**

| Symptom | What to check |
| ------- | ------------- |
| `AADSTS700213` | See [below](#troubleshooting-aadsts700213-no-matching-federated-identity) — almost always **subject mismatch** (especially **repo name casing**). |
| **No subscriptions found** (often for `***`) | See [below](#troubleshooting-no-subscriptions-found) — wrong subscription/tenant secret, or app has **no RBAC** on that subscription. |
| `Authorization failed` / 403 | RBAC: app must be **Contributor** (or equivalent) on **carwoods.com** or subscription. |
| Storage name invalid / taken | `AZURE_STORAGE_ACCOUNT_NAME`: length, lowercase, global uniqueness. |
| SQL server name invalid / taken | `AZURE_SQL_SERVER_NAME`: 1–63 chars, lowercase, hyphens OK, globally unique. |
| Missing SQL password | Set secret `AZURE_SQL_ADMIN_PASSWORD` (≥ 8 chars, complexity required). |
| Wrong subscription | `AZURE_SUBSCRIPTION_ID` must be the subscription where `carwoods.com` lives. |

### Troubleshooting: AADSTS700213 (no matching federated identity)

**What happened:** GitHub sent a token whose **subject** is exactly what appears in the error, for example:

`repo:dalzoubi/Carwoods:ref:refs/heads/main`

Entra only accepts the token if **one** federated credential on that app registration has this **exact** subject (issuer + audience must also match).

**Fix (recommended):**

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → your CI app (the one whose **Application (client) ID** is `AZURE_CLIENT_ID`).
2. **Certificates & secrets** → **Federated credentials** → open the credential you created for GitHub (or **Add** a new one if you prefer not to edit).
3. Set **Subject identifier** to the string from the error message **verbatim**, including:
   - correct **GitHub username/org** (`dalzoubi`),
   - correct **repository name casing** (`Carwoods` vs `carwoods`),
   - branch ref `refs/heads/main` if the workflow runs on `main`.
4. **Issuer** must remain `https://token.actions.githubusercontent.com`.
5. **Audience** must be `api://AzureADTokenExchange` (default when using Azure's GitHub federation template).
6. Save, wait **1–2 minutes**, re-run the workflow.

**How to confirm the subject before it fails:** In GitHub, open the repo and copy the path from the browser URL — e.g. `github.com/dalzoubi/Carwoods` → subject contains `dalzoubi/Carwoods` with that exact casing.

**Optional:** Rename the repository on GitHub to an all-lowercase name if you want subjects like `repo:dalzoubi/carwoods:...` — then update the federated credential to match the new URL.

### Troubleshooting: No subscriptions found for `***`

This usually appears right after **`azure/login`** in GitHub Actions (the `***` is your subscription ID, masked in logs). Azure authenticated the app, but that identity **cannot see** the subscription you passed in `AZURE_SUBSCRIPTION_ID`.

**Checklist:**

1. **`AZURE_SUBSCRIPTION_ID` is correct**  
   - Azure Portal → **Subscriptions** → open the subscription that contains resource group **carwoods.com** → copy **Subscription ID** (GUID).  
   - In GitHub → **Settings → Secrets and variables → Actions**, edit the secret — no spaces, no quotes, full GUID.

2. **`AZURE_TENANT_ID` matches that subscription's directory**  
   - The subscription belongs to one Entra tenant. On the subscription overview, note the **Directory** (tenant name).  
   - **App registration** for GitHub OIDC must live in **that same tenant**, and `AZURE_TENANT_ID` must be **that** tenant's ID (Entra → **Overview** → **Tenant ID**).  
   - If the app is in tenant **A** but the subscription is in tenant **B**, login can succeed but **no subscriptions** appear for the app.

3. **The app registration has Azure RBAC on that subscription or RG**  
   - OIDC login does not grant access by itself. Assign **Contributor** (or narrower role) to the **enterprise application** (service principal) for your CI app:  
     **Subscriptions** → your subscription → **Access control (IAM)** → **Add role assignment** → **Contributor** → member = your app's **name** (search under enterprise applications / service principals).  
   - Or assign **Contributor** only on resource group **carwoods.com** (see Part C).

4. **Propagation delay**  
   - After a new role assignment, wait **2–5 minutes** and re-run the workflow.

**Verify as a human user (same tenant):**

```bash
az login
az account list -o table
# Note SubscriptionId for the row where carwoods.com lives
az account set --subscription "<that SubscriptionId>"
az group show -n carwoods.com
```

If `az account list` is **empty** for your user, the signed-in account has no Azure subscriptions in that tenant (wrong account, personal MSA with no sub, or guest without access). Fix in Portal or with your subscription admin — not fixable by changing GitHub secrets alone.

---

## Part F — Deploy from your machine (local CLI)

Run from the **repository root** (adjust path if you run from `infra/azure`):

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID>"

az group create --name carwoods.com --location eastus2   # skip if RG exists

az deployment group create \
  --resource-group carwoods.com \
  --template-file infra/azure/main.bicep \
  --parameters \
    functionAppName="<YOUR_FUNCTION_APP_NAME>" \
    storageAccountName="<YOUR_STORAGE_ACCOUNT_NAME>" \
    sqlServerName="<YOUR_SQL_SERVER_NAME>" \
    sqlAdminPassword="<YOUR_SQL_ADMIN_PASSWORD>"
```

PowerShell guard (optional):

```powershell
$env:AZURE_RESOURCE_GROUP = 'carwoods.com'
./infra/azure/assert-resource-group.ps1 -ExpectedName 'carwoods.com'
```

---

## Part G — After infrastructure: deploy API code and configure the app

**Carwoods production Function App (reference):** host **`https://carwoods-com-api.azurewebsites.net`**, app name **`carwoods-com-api`**. Set GitHub repository Variable **`AZURE_FUNCTION_APP_NAME`** to `carwoods-com-api` (must match Bicep). Vite / Vercel: **`VITE_API_BASE_URL=https://carwoods-com-api.azurewebsites.net`** (no trailing slash).

### G1. Deploy `apps/api` (GitHub Actions — recommended)

Workflow: **[`.github/workflows/azure-functions-deploy.yml`](../../.github/workflows/azure-functions-deploy.yml)**

- **Triggers:** manual **Run workflow**, or **push** to `main` when files under `apps/api/` change.
- **Uses the same OIDC secrets** as the infra workflow (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) and **`AZURE_FUNCTION_APP_NAME`** (repository Variable — must match the name from Bicep).
- After a successful run, test:
  - `GET https://<AZURE_FUNCTION_APP_NAME>.azurewebsites.net/api/health`
  - `GET https://<AZURE_FUNCTION_APP_NAME>.azurewebsites.net/api/public/apply-properties` → `{ "properties": [] }` until SQL-backed listings exist.

### G2. Deploy from your machine (optional)

```bash
cd apps/api
npm ci
npm run build
npm prune --omit=dev
func azure functionapp publish <AZURE_FUNCTION_APP_NAME>
```

Requires [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) and `az login`.

### G3. Application settings (Azure Portal)

**Function App** → **Configuration** → **Application settings** → **New application setting**

| Name | Purpose | Example / note |
|------|---------|------------------|
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call anonymous HTTP endpoints (comma-separated). | `https://carwoods.com,https://www.carwoods.com` — add Vercel preview URLs if needed. |
| `DATABASE_URL` | Set automatically by **Bicep** (`Server=<fqdn>,1433;Database=...`). | Optional hardening: move to **Key Vault reference** and rotate password without redeploying Bicep. |
| Others | Entra API validation, Blob, ACS, Gemini — see [`docs/portal/ENV_CONTRACT.md`](../../docs/portal/ENV_CONTRACT.md). | |

Save and allow the app to restart.

### G4. Frontend: point Vite at the API

In Vercel / `.env` for production builds:

- `VITE_API_BASE_URL=https://<AZURE_FUNCTION_APP_NAME>.azurewebsites.net`
- Keep `VITE_FEATURE_APPLY_API` unset or not `false` so `/apply` can use the API (it will show an empty list until the DB endpoint returns rows).

### G5. Database migrations

Migrations run **automatically** as part of the **Azure infrastructure** workflow (the `db-migrate` job that runs after Bicep deploy). They are idempotent — re-running the workflow will skip any already-applied migration.

Migration state is tracked in `dbo.__migrations` in `carwoods_portal`. To view:

```sql
SELECT name, applied_at FROM dbo.__migrations ORDER BY applied_at;
```

**Manual fallback** (Azure Cloud Shell or local `sqlcmd`):

```bash
for f in infra/db/migrations/[0-9][0-9][0-9]_*.sql; do
  echo "Applying $f"
  sqlcmd -S <sqlServerFqdn>,1433 -d carwoods_portal -U carwoodsadmin -P '<password>' -C -i "$f"
done
```

**Adding new migrations:** create `infra/db/migrations/003_….sql` and push to `main`. The workflow will pick it up automatically. Name must start with a unique numeric prefix that sorts after existing migrations.

### G6. Later: more Azure resources

- **Blob / ACS** — add in **carwoods.com**, **East US 2**, or extend Bicep.

---

## Quick reference — secret/variable names


| Type     | Name                                      |
| -------- | ----------------------------------------- |
| Secret   | `AZURE_CLIENT_ID`                         |
| Secret   | `AZURE_TENANT_ID`                         |
| Secret   | `AZURE_SUBSCRIPTION_ID`                   |
| Secret   | `AZURE_SQL_ADMIN_PASSWORD`                |
| Variable | `AZURE_FUNCTION_APP_NAME`                 |
| Variable | `AZURE_STORAGE_ACCOUNT_NAME`              |
| Variable | `AZURE_SQL_SERVER_NAME`                   |
| Variable | `AZURE_LOCATION` (recommended: `eastus2`) |
| Variable | `AZURE_SQL_ADMIN_USER` (optional: defaults to `carwoodsadmin`) |


---

## Further reading

- [Use GitHub Actions to connect to Azure](https://learn.microsoft.com/azure/developer/github/connect-from-azure)
- [Azure/login action](https://github.com/Azure/login)
- [Bicep overview](https://learn.microsoft.com/azure/azure-resource-manager/bicep/overview)
- [Azure SQL Database pricing](https://azure.microsoft.com/pricing/details/azure-sql-database/single/)
