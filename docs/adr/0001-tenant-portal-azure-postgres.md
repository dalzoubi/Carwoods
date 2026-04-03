# ADR 0001: Tenant portal on Azure (PostgreSQL + Functions)

## Status

Superseded — database changed to **Azure SQL (Basic tier)** due to `LocationIsOfferRestricted` errors when provisioning PostgreSQL Flexible Server in `eastus2`. See current Bicep template and `infra/azure/README.md`.

## Context

The public site is a static React + Vite app. We need a production tenant maintenance portal with persistence, private files, email, and admin workflows.

## Decision

- **API:** Azure Functions (Node.js, TypeScript), clean architecture layers inside `apps/api`.
- **Database:** Azure SQL (Basic tier, 5 DTUs, ~$5/month). Originally PostgreSQL; changed due to region offer restriction.
- **Files:** Azure Blob Storage with private containers and short-lived SAS.
- **Email:** Azure Communication Services Email.
- **AI:** Google Gemini invoked only from the API for admin reply suggestions.
- **Identity:** Microsoft Entra External ID for tenants and staff.
- **Resource group:** All Azure resources in **`carwoods.com`**.
- **Repo layout:** `apps/api`, `packages/*`, `infra/*`, `docs/portal/*` (logical monorepo; per-package npm installs where workspace symlinks are unavailable).

## Consequences

- Frontend may remain on Vercel; configure CORS and Entra redirect URIs accordingly.
- Secrets stay server-side; Vite env must never include DB or AI keys.
- HAR listing enrichment remains HTML-parse based unless a credentialed IDX provider is added later.
