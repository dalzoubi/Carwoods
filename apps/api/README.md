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

Health check: `GET http://localhost:7071/api/health`

## Deploy

Build artifacts are deployed to the Function App created in resource group **`carwoods.com`** (see `infra/azure/`).
