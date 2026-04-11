# Dark Theme Feature Flag (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document build-time control of dark theme via `VITE_FEATURE_DARK_THEME` and HTML boot behavior.
- **Why now:** Flag must stay consistent between `featureFlags.js` and Vite HTML transform (per `AGENTS.md`).
- **Related docs/issues/links:** `vite.config.js` `transformIndexHtml`.

## 2) Scope

- **In scope:** `FEATURE_DARK_THEME` export, env semantics (`!== 'false'`), early flash-prevention script injection when enabled.
- **Out of scope:** Runtime remote flagging without rebuild.

## 3) Users and stories

- As a **deployer**, I want to disable dark theme globally, so that only light mode ships (rare).
- As a **developer**, I want one source of truth for flag semantics, so that boot script and JS agree.

## 4) Constraints and assumptions

- **Technical:** Changing flag semantics requires updating **both** `src/featureFlags.js` and `vite.config.js` per project rules.
- **Assumptions:** Default is on when env unset.

## 5) Acceptance criteria

1. Given `VITE_FEATURE_DARK_THEME` is not set to `false`, when the app builds, then `FEATURE_DARK_THEME` is true in client bundle.
2. Given the flag is not `false`, when `index.html` is transformed at build, then the early dark script is injected as implemented.
3. Given `VITE_FEATURE_DARK_THEME=false`, when running dev/build, then dark feature paths are disabled per code branches.

## 6) Validation plan

- **Automated:** `npx vitest run src/featureFlags.test.js`, `npm run build` after flag changes
- **Manual:** Cold load in browser with throttling to observe flash behavior when flag on.

## 7) Implementation plan

- Baseline only. Coordinate `featureFlags.js`, `vite.config.js`, and any docs referencing the flag.

## 8) Risks and mitigations

- **Risk:** Drift between Vite `process.env` and `import.meta.env`. **Mitigation:** Test both dev and production build.

## 9) Rollback plan

- Revert flag-related commits; redeploy with prior env.

## 10) Traceability and completion

- **Primary implementation:** `src/featureFlags.js`, `vite.config.js`
- **Tests:** `src/featureFlags.test.js`
- **Acceptance criteria status:** Baseline.
