---
description: Run the full UI safety checklist after a visual or component change — lint, unit tests, build if Vite/env changed, plus the light/dark/RTL/print verification plan.
---

# /verify-ui

Run the full UI safety checklist for the current change set. Produce a concise report the user can act on.

## Steps

1. **Identify touched files**: run `git status --short` and `git diff --name-only` to scope the check.
2. **Lint**: `npx eslint src/` on affected paths. Ignore the two pre-existing `no-restricted-globals` errors in `src/styles.js` — those are documented non-regressions.
3. **Unit tests**: `npx vitest run`. If any touched file has a missing test for an observable behavior change, flag it.
4. **Build**: only if the change touches `vite.config.js`, env handling, or `featureFlags.js` — then `npm run build`.
5. **Theme audit**: invoke the `theme-audit` skill on the changed files. Report hardcoded hex, physical CSS directions, and any new `Paper` missing `backgroundImage: 'none'`.
6. **i18n check**: for any new user-visible string in JSX, confirm a translation key exists in all four locales. If not, propose the additions (or invoke the `add-translation` skill).
7. **Manual verification plan** (the user will run these — list them explicitly):
   - Light mode on affected pages
   - Dark mode on affected pages
   - `/dark/<path>` preview on affected routes
   - Print preview (Ctrl/Cmd-P) on affected pages
   - Arabic (`ar`) if layout/spacing changed — check Drawer anchor, icon placement, flex direction

## Output format

```markdown
## Checks run
- [x] Lint: 0 new issues
- [x] Unit tests: 214 passed
- [ ] Build: skipped (no Vite/env changes)

## Findings
- (hardcoded hex, physical CSS, missing translations, etc.)

## Manual verification needed
- [ ] Light mode: /apply, /contact
- [ ] Dark mode: /apply, /contact
- [ ] /dark/apply preview
- [ ] Print preview of /apply
- [ ] Arabic locale check on /apply
```

## Guardrails

- Do not claim "tested in the browser" unless you actually used a browser automation tool in this session — list manual checks for the user instead
- Do not mark the change complete until the user confirms the manual verifications
