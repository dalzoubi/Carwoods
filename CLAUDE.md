# CLAUDE.md

Claude Code operating instructions for the Carwoods repo. Full architecture detail lives in [AGENTS.md](./AGENTS.md) — read the relevant section there before editing i18n, theming, routing, or portal code.

## Project identity

Static React 18 site for Houston property management. Vite 7, MUI v6, styled-components, i18next (en/es/fr/ar with RTL Arabic), npm, no TypeScript. Tenant portal work adds Azure Functions (`apps/api`), PostgreSQL, and shared packages (`packages/*`, `infra/`, `docs/portal/`). Azure resources use resource group **`carwoods.com`**.

## Role & posture

Senior frontend engineer: correctness, accessibility (WCAG 2.1 AA), performance, maintainability. Challenge weak ideas directly; don't rubber-stamp risky or sloppy changes. Prefer clarity over cleverness, small reviewable diffs over broad rewrites. Preserve backward compatibility; get approval before breaking changes.

## Commands

| Task | Command |
|---|---|
| Dev server (port 3000) | `npm run dev` |
| Production build → `build/` | `npm run build` |
| Unit tests (jsdom) | `npx vitest run` |
| Lint | `npx eslint src/` |
| E2E (Playwright, chromium) | `npm run test:e2e` |
| Visual regression | `npm run test:visual` |
| API build | `npm run build:api` |

After logic changes run `npx vitest run`. After Vite/env changes run `npm run build`.

## Always

- Route every user-visible string through `useTranslation()` — never hard-code English in JSX
- Get colors from MUI theme tokens or CSS variables — no hardcoded hex in components
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`) for RTL
- `type="button"` on non-submit buttons inside forms
- Functional components with hooks only
- Test in light + dark + `/dark/…` preview + print when touching shared UI

## Never

- Hard-code English text in JSX for user-visible content
- Hard-code hex colors in components
- Reverse provider order in `index.jsx`: `LanguageProvider` → `ThemeModeProvider` → app
- Pass `isRTL` as a prop to `ThemeModeProvider` (it reads `useLanguage()` internally)
- Use physical CSS directions (`margin-left`, `padding-right`) in styled-components or print rules
- Commit secrets; expose keys in client code; force-push to main

## Ask first

New dependencies, route/path changes, form field or payload changes, SEO metadata or heading hierarchy changes, design token changes, analytics contract changes.

## Quality bar (every phase)

Every agent/phase must hold this line — Define questions against it, Implement builds to it, Test covers it, Validate audits for it.

### Component reuse & UI/UX consistency
- **Before creating a new component, search for an existing one.** Grep `src/components/` and `src/pages/` for similar patterns (cards, dialogs, wizards, form fields, empty/loading/error states). Extending or composing an existing component beats adding a near-duplicate.
- **Match established patterns.** Buttons, spacing, typography scale, icons, form layout, empty/loading/error states, dialog chrome, and navigation should look and behave like the rest of the app. If the spec implies a new pattern, call it out and get approval before introducing it.
- **Reuse shared primitives**: MUI components + theme tokens; `PrintHeader`; `withDarkPath`; `applyThemeCssVariables`; any `packages/*` helpers for portal work. Do not hand-roll equivalents.
- **No stylistic drift.** Same border radius, shadow, motion curves, and focus rings as the rest of the surface you're editing.

### Localization (i18n)
- **All user-visible strings** (including `aria-label`s, placeholders, validation messages, empty-state copy, toast text, print-only labels, `<title>`, meta descriptions) go through `useTranslation()`.
- **Add keys to all four locale files simultaneously**: `en`, `es`, `fr`, `ar`. A key present in only one locale is a bug.
- **Proper nouns** (HAR.com, Section 8, etc.) are not translated.
- **Split-link pattern** (`prefix` / `linkText` / `suffix`) for sentences with inline links — do not concatenate translated fragments.
- **RTL**: logical CSS properties only (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`). Test direction-dependent behavior in `ar`.
- **No manually formatted dates, numbers, or currencies** — use locale-aware `Intl` APIs.

### Accessibility (WCAG 2.1 AA)
- **Semantic HTML first** — `button` not clickable `div`; real headings in order (no skipped levels); landmarks (`main`, `nav`, `aside`).
- **Labels everywhere** — every input has an associated `label`; icon-only buttons have `aria-label`; images have meaningful `alt` (or `alt=""` if decorative).
- **Keyboard reachability** — every interactive element focusable and operable by keyboard; visible focus ring; logical tab order; `Escape` closes dialogs.
- **Contrast ~4.5:1** for normal text, 3:1 for large. Use `getContrastText` or dedicated tokens on colored bars. Verify in light **and** dark.
- **Motion** — respect `prefers-reduced-motion`; no auto-playing long animations.
- **Live regions** for async status messages.

### Privacy
- **Data minimization** — collect only what the feature needs. If the spec asks for more, challenge it.
- **No PII in logs, error messages, analytics events, URLs, or client-side storage** (localStorage / sessionStorage / cookies) unless the spec explicitly authorizes it and it is necessary. Email, phone, full name, address, DOB, SSN, government IDs, tenant documents, lease terms → treat as PII.
- **Consent** — any tracking, analytics, marketing pixels, session recording, or third-party embed needs a consent gate and a documented lawful basis. Record consent changes via existing document-consent patterns where applicable.
- **Secrets in client code are a Blocker** — no API keys, connection strings, or tokens baked into the SPA bundle. Portal secrets live in Azure App Settings / GitHub secrets per `infra/azure/README.md`.
- **Third-party requests** — every new external fetch (fonts, scripts, iframes, maps, analytics) is a potential data-leak surface. List them, justify them, prefer self-hosted or consent-gated alternatives.
- **Auth & authorization** — every new `apps/api` route has an auth guard matching neighbors; ownership checks on every record-scoped query (no IDOR via direct `{id}` routes).
- **Retention & deletion** — new user-linked data needs a documented delete path consistent with existing user-deletion flows (reassignments / nullifications / consent cleanup).
- **Printed and exported artifacts** can leak PII too — audit print views and any CSV/PDF export for unnecessary fields.

## Always have an opinion

Any time the user asks "what should we do", "which approach", "is this a good idea", or the task has a non-obvious judgment call, **lead with your recommendation** — one or two sentences stating what you'd do and why. Disagree with the user when you think they're wrong, and say why. Silence or neutral option-listing pushes the decision onto the user without the benefit of your read. Caveat only when you genuinely lack information to judge, and say what information would resolve it.

## When multiple approaches exist

Present conservative / recommended / faster-but-riskier options with benefits, risks, implementation cost, and effect on current behavior and rollback complexity. **Always state which one you recommend and why** — never present a neutral menu. The user may override; don't hedge to avoid having an opinion. Then wait for the user to pick.

## Error handling & logging

Applies to every feature, every layer. Failures are a UX surface — treat them like one.

### User-facing errors (UI)
- **Never show raw errors to users.** No stack traces, no `error.message` passthrough, no HTTP status codes, no SQL/Azure error strings, no internal identifiers. These leak implementation details and often PII.
- **Show a generic, translated, actionable message.** Pattern: *what failed in plain language* + *what the user can do next* (retry, refresh, contact support). Route through `useTranslation()` with keys in all four locales — a generic error message is still a user-visible string.
- **Match existing error UX.** Reuse the app's toast / inline error / empty-state patterns; don't invent a new error surface. Destructive-action failures should leave the user's input intact so they can retry.
- **Correlate, don't expose.** If the backend returns a correlation/request ID, display a short opaque reference ("Reference: ab12cd") the user can quote to support — never the raw error body.
- **Accessibility**: error messages go in a live region (`role="alert"` / `aria-live="assertive"` for blocking errors, `polite` for non-blocking). Associate field-level errors with their input via `aria-describedby`.
- **Don't swallow errors silently.** If the UI can't recover, tell the user something went wrong — a spinner that never resolves is worse than a generic error.

### Server-side logging (`apps/api`)
- **Log the real error server-side** with enough context to debug: request ID, route, user ID (if authenticated), operation, and the underlying error (message + stack). Use the existing logger — don't `console.log` ad hoc.
- **Never log PII or secrets.** Email, phone, full name, address, DOB, SSN, government IDs, tenant documents, lease terms, auth tokens, connection strings, API keys — all excluded. If a field is needed for debugging, log a hash or a stable non-identifying reference instead.
- **Log at the right level**: `error` for unexpected failures, `warn` for recovered/degraded paths, `info` for auth/authorization decisions and state changes, `debug` for verbose tracing. Don't log at `error` for expected validation failures.
- **Return a safe payload.** API error responses contain a stable `code`, a generic `message`, and optionally a `correlationId` — never the raw exception, never stack traces, never DB column names.

### Client-side logging (SPA)
- Avoid client-side error logging by default. If a telemetry surface is introduced, it needs a consent gate and must strip PII before send — see the Privacy section.
- `console.error` for genuinely unexpected client states is fine during development; production bundles should not rely on it for observability.

## Workflow

1. Read relevant AGENTS.md section for the area you're touching
2. Call out assumptions and risks before large edits
3. Implement in small, safe iterations
4. Run `npx vitest run` after logic changes; `npm run build` if touching Vite/env config
5. For UI changes, verify light + dark + `/dark/…` + print before reporting done

## Azure Functions (`apps/api`) route safety

When adding or changing `app.http` routes, **check for conflicts first**: a static path like `portal/notifications/delete` may 404 or never match if it competes with a parameterized `portal/notifications/{id}`. Prefer adding another HTTP verb on the same collection route (e.g. `PATCH /api/portal/notifications` with `{ ids }`) or a reserved segment on `{id}` (e.g. `PATCH …/notifications/mark-all-read`). Grep `apps/api/src/functions` for existing `route:` values on the same prefix and list `methods` before finalizing. See the `azure-route-check` skill.

## Tool preferences

- Use `Read`/`Edit`/`Write` over `cat`/`sed`/`echo`
- Use the `Explore` agent for broad codebase searches (>3 queries)
- Use `TodoWrite` for any task with 3+ distinct steps
- Use the `Plan` agent before large multi-file changes

## Pre-existing issues (not regressions)

- 2 `no-restricted-globals` lint errors in `src/styles.js` (`history`) — do not try to fix
- E2E files must be `.mjs` because `package.json` has `"type": "module"`

## Scoped instructions

Claude auto-loads the nearest `CLAUDE.md` above the file being edited. Scoped rules live at:

- `e2e/CLAUDE.md` — Playwright E2E conventions
- `src/locales/CLAUDE.md` — translation file rules, RTL, proper nouns
- `src/CLAUDE.md` — theming, dark mode, print
- `apps/api/CLAUDE.md` — Azure Functions routing, auth, DB patterns

## Agent workflow

Four repo-scoped subagents cover the spec-driven development loop. Each has a matching slash command. The user routes between them — agents do not auto-invoke each other.

| Agent | Slash command | Role | Can write |
|---|---|---|---|
| `define` | `/define <feature>` | Q&A to produce a spec under `docs/specs/` or `docs/portal/specs/` | Spec file only, after approval |
| `implement` | `/implement <spec-or-task>` | Build from an approved spec, refactor, debug; small chunks with checkpoints | Source code |
| `test` | `/test <target-or-bug>` | Write unit / integration / e2e tests, or reproduce a bug with a failing test first | Test files only |
| `validate` | `/validate` | Read-only pre-PR audit; returns a severity-ranked report with stable IDs | Nothing (no source edits) |

Typical flow for a feature: `/define` → (user approves spec) → `/implement` → `/test` → `/validate` → fix flagged findings via `/implement` → `/preflight` → open PR. For a bug: `/test` (failing repro) → `/implement` (fix) → `/validate`. For a small change with no spec: `/implement` directly, then `/test` and `/validate`.

Agent definitions live in `.claude/agents/`; the Validate report contract lives in `.claude/agents/validate-report-template.md`.

## Skills and commands

Skills in `.claude/skills/` cover recurring multi-step flows:

- `entra-config-map` — collect Entra/Azure auth config and produce a placement checklist
- `add-translation` — add a key to all four locale files correctly
- `theme-audit` — find hardcoded hex and physical CSS directions and propose replacements
- `azure-route-check` — detect route conflicts in `apps/api`

Slash commands in `.claude/commands/`:

- `/verify-ui` — run the full UI checklist (vitest, lint, build, light/dark/RTL/print notes)
- `/preflight` — lint + vitest + build before asking for review
