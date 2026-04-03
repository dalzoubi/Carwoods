# Carwoods

Property management and rentals in Houston and beyond. Tenant selection criteria, application documents, and contact information.

## Tech Stack

- **React** 18 with React Router
- **Vite** for fast dev and production builds
- **MUI** (Material-UI) + Emotion + styled-components for styling
- **Vitest** for unit tests
- **Playwright** for E2E tests

## Tenant portal (Azure)

Monorepo workspaces: `apps/api` (Azure Functions, TypeScript), `packages/domain`, `packages/config`. Documentation: **`docs/portal/`**. Database migrations: **`infra/db/migrations/`**. Azure Bicep: **`infra/azure/`** (deploy into resource group **`carwoods.com`**). CI: **`.github/workflows/azure-infrastructure.yml`** (Bicep) and **`.github/workflows/azure-functions-deploy.yml`** (API code) — see **`infra/azure/README.md`** for OIDC, secrets, variables, and post-deploy steps.

```bash
npm install
npm run build:api
```

## Available Scripts

In the project directory, you can run:

### `npm start` or `npm run dev`

Runs the app in development mode with Vite.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches Vitest in watch mode.

### `npm run test:coverage`

Runs tests once with coverage report.

### `npm run build`

Builds the app for production to the `build` folder (optimized for deployment).

### `npm run deploy`

Builds and deploys to [carwoods.com](https://carwoods.com) via `gh-pages`.

### `npm run test:e2e:install`

Installs the Chromium browser required by Playwright.

### `npm run test:e2e`

Runs Playwright E2E tests against the built app.

## Deployment

The app is deployed to [carwoods.com](https://carwoods.com). Vite builds to the `build` output directory and `gh-pages` publishes it. Run `npm run deploy` to build and publish.

## AI-Assisted Development

This repo is configured for AI coding agents (Cursor, Copilot, Codex, etc.). Before starting a task, paste the relevant prompt below into your chat.

### General prompt (use for most tasks)

> Follow AGENTS.md and the project's Cursor rules. Read the relevant AGENTS.md section before making changes. Use `useTranslation()` for all user-visible strings — add keys to all four locale files (en, es, fr, ar). Use MUI theme or CSS variables for colors — no hardcoded hex. Use logical CSS properties for RTL. Run `npx vitest run` after logic changes and `npm run build` if touching Vite or env config.

### Theming / dark mode

> Follow AGENTS.md "Theming & styling". Use MUI theme + `applyThemeCssVariables` / CSS variables; no light-only hex in dialogs or wizards. Respect `/dark` preview and `withDarkPath` for links. Verify light + dark + `/dark/…` preview + print for affected pages.

### New page or route

> Follow AGENTS.md. Add routes in `App.jsx` (and under `/dark` via the existing pattern). Prefix internal links with `withDarkPath`. Add all user-visible strings to all four locale files. Run `npx vitest run` and `npm run build`.

### i18n / translations

> Follow AGENTS.md "Internationalisation". Add keys to all four locale files simultaneously. Use prefix/linkText/suffix pattern for sentences with inline links. Do not translate proper nouns (HAR.com, RentSpree, Section 8, etc.). Use logical CSS properties for RTL. Reset `i18n.changeLanguage('en')` in test `beforeEach`.

### Accessibility

> Follow AGENTS.md accessibility rules. Use `getContrastText` or dedicated tokens for text on colored bars. Verify ~4.5:1 contrast for normal text. Do not assume white or yellow text on arbitrary blues passes WCAG AA.

### Print

> Follow AGENTS.md "Print". Do not remove `PrintHeader` img invert or `color-scheme: light` without replacement. Use logical CSS properties in print rules. Hide interactive-only UI with `@media print { display: none }`.

## Learn More

- [Vite documentation](https://vite.dev/)
- [React documentation](https://react.dev/)
