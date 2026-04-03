# Azure infrastructure (`carwoods.com`)

All application Azure resources for the tenant portal **must** be deployed into resource group **`carwoods.com`**.

## Deploy (resource group scoped)

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
