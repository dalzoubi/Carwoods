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

Manual Azure setup quick checklist: **`docs/portal/AZURE_MANUAL_SETUP_CHECKLIST.md`**.

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

### `npm run dev:portal:local` (Windows)

Starts the **local tenant portal stack** from `scripts/start-local-portal.ps1`: copies example env files if missing (`.env.portal.local`, `apps/api/local.settings.json`), **runs API database migrations** (`npm run db:migrate:local` in `apps/api` using your configured `DATABASE_URL`), then launches two new terminals — Azure Functions in `apps/api` and the Vite SPA with `npm run dev:portal`. See **`docs/portal/`** for portal setup.

**Skip database migrations** when the schema is already up to date, you have no database URL, or you only need the SPA and API shells:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/start-local-portal.ps1" -SkipMigrations
```

From the repo root in an already-open PowerShell session (same effect):

```powershell
.\scripts\start-local-portal.ps1 -SkipMigrations
```

The script also accepts `-DryRun` to print steps without starting servers or running migrations.

## Deployment

The app is deployed to [carwoods.com](https://carwoods.com). Vite builds to the `build` output directory and `gh-pages` publishes it. Run `npm run deploy` to build and publish.

## AI-Assisted Development

This repo is configured for AI coding agents (Cursor, Copilot, Codex, etc.). Before starting a task, paste the relevant prompt below into your chat.

### Claude Code: spec-driven 4-agent workflow

For larger changes in Claude Code, use the four project-scoped subagents defined in [`.claude/agents/`](./.claude/agents) via their slash commands in [`.claude/commands/`](./.claude/commands). You are the router — agents do **not** auto-delegate to each other. Each agent has a narrower tool scope than the main session and built-in checkpoints.

| Command | Agent | Model | Purpose |
|---|---|---|---|
| `/define <feature>` | **Define** (Planning & Analysis) | opus | Runs a Q&A **one question at a time** to scope the feature, then proposes architecture with tradeoffs. On approval, writes a spec to `docs/portal/specs/<slug>.md` (portal/`apps/api`/`packages/`/`infra/`) or `docs/specs/<slug>.md` (everything else). Read-only except for that spec. |
| `/implement <spec-path-or-task>` | **Implement** (Implementation & Refactor) | inherit | Reads the spec, uses the `Plan` subagent to draft a plan, waits for approval, edits in small chunks, runs `npx vitest run` / `npm run build` / `npx eslint src/` after each chunk, and stops at checkpoints (after plan, after each chunk, before any "Ask first" or destructive action). Only agent that changes source files. |
| `/test <target-or-bug>` | **Test & Quality** | sonnet | Writes unit / integration / e2e / visual tests per the spec's Test plan. For bugs, writes the **failing test first** then stops — does not fix production code. Edits test files only (`**/*.test.*`, `**/*.spec.*`, `e2e/**`, `tests/**`). |
| `/validate` | **Validate** (Review & Risk) | inherit | Read-only audit of current branch vs `main`: static security review, STRIDE threat model, risky-diff patterns, carwoods-specific regressions (i18n/theme/RTL/providers/routes), WCAG 2.1 AA, performance, spec conformance, test-coverage gaps. Returns a severity-ranked markdown report with a SHIP / SHIP with fixes / DO NOT SHIP recommendation. |

**Typical flow for a new feature:**

1. `/define add-tenant-payment-history` → answer the Q&A, approve, spec lands in `docs/portal/specs/add-tenant-payment-history.md`.
2. `/implement docs/portal/specs/add-tenant-payment-history.md` → approve the plan, review each chunk as it lands.
3. `/test docs/portal/specs/add-tenant-payment-history.md` → fills any coverage gaps the implementation didn't write inline.
4. `/validate` → fix any Blocker/High findings, loop back to `/implement` or `/test` as needed.
5. Open PR.

**Bug flow:** `/test "<bug description>"` to reproduce with a failing test → `/implement "fix <bug>"` to fix → `/validate` before PR. Bugs skip `/define`. If a fix changes behavior in a shipped spec, Implement will update that spec's **Spec deltas** section.

**Guardrails (enforced by each agent):**

- Define is read-only on source — it cannot edit code.
- Implement honors the "Ask first" list in [CLAUDE.md](./CLAUDE.md) (new deps, route/path changes, payload changes, design tokens, analytics) and stops for approval.
- Test never edits production code.
- Validate never edits anything.
- None of the agents skip hooks, force-push, or commit secrets.

### Cursor: same workflow, two mechanisms

Cursor has no direct equivalent to Claude Code subagents, so the 4 phases are provided two ways — pick one or use both:

1. **Manually-invoked rules (committed to repo, zero setup)** — `@phase-define`, `@phase-implement`, `@phase-test`, `@phase-validate` in [`.cursor/.rules/`](./.cursor/.rules). An always-on router rule ([`workflow.mdc`](./.cursor/.rules/workflow.mdc)) handles routing language ("define this", "validate the branch", etc.) and reminds Cursor not to auto-advance between phases. Tool restrictions are advisory — the prompt tells Cursor to stay read-only, but nothing blocks it.
2. **Custom Modes (real tool enforcement, one-time per-machine setup)** — see [`.cursor/CUSTOM_MODES.md`](./.cursor/CUSTOM_MODES.md) for step-by-step setup of four Cursor Custom Modes (`Define`, `Implement`, `Test`, `Validate`) with per-mode system prompts, models, and tool toggles. These are user-scoped in Cursor's Settings and not committed to the repo, so each collaborator runs the guide once locally. Recommended for at least **Define** and **Validate**, where enforced read-only really matters.

Either way, the user routes between phases manually; Cursor does not auto-advance. Bug fixes skip Define.

### General prompt (use for most tasks)

> Follow AGENTS.md and the project's Cursor rules. Read the relevant AGENTS.md section before making changes. Use `useTranslation()` for all user-visible strings — add keys to all four locale files (en, es, fr, ar). Use MUI theme or CSS variables for colors — no hardcoded hex. Use logical CSS properties for RTL. Run `npx vitest run` after logic changes and `npm run build` if touching Vite or env config.

### Theming / dark mode

> Follow AGENTS.md "Theming & styling". Use MUI theme + `applyThemeCssVariables` / CSS variables; no light-only hex in dialogs or wizards. Respect `/dark` preview and `withDarkPath` for links. Verify light + dark + `/dark/…` preview + print for affected pages.

### New page or route

> Follow AGENTS.md. Add routes in `App.jsx` (and under `/dark` via the existing pattern). Prefix internal links with `withDarkPath`. Add all user-visible strings to all four locale files. Run `npx vitest run` and `npm run build`.

### i18n / translations

> Follow AGENTS.md "Internationalisation". Add keys to all four locale files simultaneously. Use prefix/linkText/suffix pattern for sentences with inline links. Do not translate proper nouns (HAR.com, Section 8, etc.). Use logical CSS properties for RTL. Reset `i18n.changeLanguage('en')` in test `beforeEach`.

### Accessibility

> Follow AGENTS.md accessibility rules. Use `getContrastText` or dedicated tokens for text on colored bars. Verify ~4.5:1 contrast for normal text. Do not assume white or yellow text on arbitrary blues passes WCAG AA.

### Print

> Follow AGENTS.md "Print". Do not remove `PrintHeader` img invert or `color-scheme: light` without replacement. Use logical CSS properties in print rules. Hide interactive-only UI with `@media print { display: none }`.

## Learn More

- [Vite documentation](https://vite.dev/)
- [React documentation](https://react.dev/)
