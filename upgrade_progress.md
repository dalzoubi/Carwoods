# Upgrade Progress — Carwoods LLC

**How to resume:** Start from the first `[ ]` item in the current phase. After each checkpoint, commit changes and run `npm run build` and `npm test` before proceeding.

---

## Checkpoints

| ID | Checkpoint | Status |
|----|------------|--------|
| **A** | Baseline captured | `[x]` |
| **B** | Node/tooling upgraded | `[ ]` |
| **C** | Framework/build upgraded | `[ ]` |
| **D** | React upgraded | `[ ]` |
| **E** | Design standards applied | `[ ]` |
| **F** | Quality gates enforced | `[ ]` |

---

## Phase 0 — Discovery + Baseline

- [x] Detect Node version
- [x] Detect package manager (npm)
- [x] Detect framework (CRA)
- [x] Detect React, router, state, styling
- [x] Detect test stack
- [x] Run baseline: test, build, lint
- [x] Record results in UPGRADE_PLAN.md

**Checkpoint A: Baseline captured** ✅

---

## Phase 1 — Toolchain Upgrade (Node + Linters)

- [ ] Add `engines` to package.json
- [ ] Add `.nvmrc` (Node 22 or 24)
- [ ] Add `lint` script to package.json
- [ ] Add/upgrade ESLint config
- [ ] Add Prettier (optional)
- [ ] Verify: `npm install` succeeds
- [ ] Verify: `npm run lint` succeeds
- [ ] Verify: `npm test` succeeds
- [ ] Verify: `npm run build` succeeds

**Checkpoint B: Node/tooling upgraded**

---

## Phase 2 — Framework/Build System (CRA → Vite)

- [x] Create Vite config (compatible with gh-pages homepage)
- [x] Migrate index.html and entry point
- [x] Configure env vars (if any)
- [x] Configure path aliases
- [x] Remove react-scripts
- [x] Update scripts in package.json
- [ ] Verify dev server: `npm run dev`
- [ ] Verify production build: `npm run build`
- [ ] Verify gh-pages deploy
- [x] Update testing setup (Jest → Vitest)

**Checkpoint C: Framework/build upgraded**

---

## Phase 3 — React Upgrade (18 → 19)

- [ ] Verify MUI 6 + React 19 compatibility
- [ ] Verify React Router + React 19 compatibility
- [ ] Upgrade React and React-DOM to ^19
- [ ] Upgrade React Router if needed
- [ ] Fix deprecation warnings
- [ ] Run tests
- [ ] Run E2E: `npm run test:e2e`
- [ ] Manual smoke test

**Checkpoint D: React upgraded**

---

## Phase 4 — Design Standards Upgrade

- [ ] Document design tokens (theme.js or tokens file)
- [ ] Define color contrast rules
- [ ] Define typography scale
- [ ] Define spacing scale
- [ ] Normalize button variants
- [ ] Normalize form fields
- [ ] Apply accessibility baseline (WCAG 2.2 AA)
- [ ] Verify keyboard navigation
- [ ] Verify focus styles

**Checkpoint E: Design standards applied**

---

## Phase 5 — Quality Gates

- [ ] Add CI workflow (e.g. `.github/workflows/ci.yml`)
- [ ] Lint in CI
- [ ] Test in CI
- [ ] Build in CI
- [ ] E2E in CI (optional)
- [ ] Enforce coverage thresholds
- [ ] Document upgrade playbook

**Checkpoint F: Quality gates enforced**

---

## Status Summary

| Phase | Status |
|-------|--------|
| Phase 0 | ✅ Complete |
| Phase 1 | ⏳ Pending |
| Phase 2 | ⏳ Pending |
| Phase 3 | ⏳ Pending |
| Phase 4 | ⏳ Pending |
| Phase 5 | ⏳ Pending |
