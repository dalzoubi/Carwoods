# Monorepo layout

## Monorepo packages (npm)

Each package has its own `package.json`. **npm workspaces are not enabled at the repo root** because symlinked workspaces can fail on some Windows network drives (UNC / mapped `Z:`). Install and build per package, or clone on a local NTFS path and optionally re-enable `workspaces` in root `package.json` if your environment supports symlinks.

| Path | Package | Purpose |
|------|---------|---------|
| `apps/api` | `@carwoods/api` | Azure Functions (TypeScript), portal + admin HTTP API |
| `packages/domain` | `@carwoods/domain` | Shared domain types, enums, DTO shapes (no framework imports) |
| `packages/config` | `@carwoods/config` | Shared env key names + TypeScript types for configuration contracts |
| (deferred) | `@carwoods/ui` | See [UI_PACKAGE_PLACEHOLDER.md](./UI_PACKAGE_PLACEHOLDER.md) |

## Web application

The **Vite + React** marketing site and (later) portal client code currently live at the **repository root** (`src/`, `public/`, `vite.config.js`). This avoids a disruptive move in Phase 1.

**Optional later:** relocate to `apps/web` with name `@carwoods/web` and point root scripts at `npm run dev -w @carwoods/web`.

## Infrastructure

| Path | Purpose |
|------|---------|
| `infra/azure/` | Bicep (or future Terraform) — **resource group `carwoods.com`** |
| `infra/db/migrations/` | Azure SQL (T-SQL) migration SQL (source of truth, applied locally via `npm --prefix apps/api run db:migrate:local`) |

## Documentation

| Path | Purpose |
|------|---------|
| `docs/portal/` | Portal implementation prompts, env contract, phase gates |
| `docs/adr/` | Architecture decision records |

## Commands (from repository root)

```bash
npm install                 # Vite app (root)
npm install --prefix apps/api
npm install --prefix packages/domain
npm install --prefix packages/config
npm run dev                 # Vite dev server
npm run build:api           # builds Azure Functions package
npm run build:packages      # builds shared TS packages
```

Root `package.json` keeps existing `dev` / `build` / `test` scripts for the Vite app; workspace packages are additive.
