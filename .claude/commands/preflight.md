---
description: Pre-review checklist — lint, unit tests, build if relevant, and a short summary of what changed. Run before asking for code review or opening a PR.
---

# /preflight

Run the standard pre-review gates and summarize the branch's readiness.

## Steps

1. `git status --short` — confirm there are no untracked files that should be staged
2. `git diff --stat main...HEAD` — quick view of what changed
3. `npx eslint src/` — must be clean (ignore the two pre-existing `no-restricted-globals` errors in `src/styles.js`)
4. `npx vitest run` — must be clean. Do not mark green if any test is skipped on purpose for this change without explanation
5. If any of these paths changed, also run `npm run build`:
   - `vite.config.js`
   - `src/featureFlags.js`
   - `index.html`
   - `.env*` (env-shape changes)
6. If `apps/api/**` changed, run `npm run build:api`
7. If `e2e/**` or `playwright.config.mjs` changed and there's time, run `npm run test:e2e` (requires a running dev server or `webServer` config)

## Output format

```markdown
## Preflight summary

- Branch: `<branch>`
- Commits ahead of main: N
- Files changed: N

## Gates
- [x] Lint clean
- [x] Vitest passing (214/214)
- [ ] Build: skipped (no relevant changes) | passed
- [ ] API build: not applicable | passed

## Outstanding
- (any manual UI verifications from /verify-ui not yet done)
- (any untranslated strings, TODOs, or follow-up issues)

## Ready for review: yes | no
```

## Guardrails

- Do not push or create a PR from this command — just report readiness
- If a gate fails, stop and surface the failure. Do not attempt to fix silently
