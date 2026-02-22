# Carwoods LLC — Upgrade Plan

**Status:** Awaiting approval to implement  
**Created:** 2026-02-21  
**Scope:** React application upgrade (Node, toolchain, framework, React, design standards, quality gates)

---

## 1. Current Stack Snapshot

| Category | Current Version / Tool |
|----------|------------------------|
| **Node.js** | v24.13.1 (no `engines` or `.nvmrc` in repo) |
| **Package manager** | npm |
| **Framework** | Create React App (react-scripts ^5.0.1) |
| **React** | ^18.3.1 |
| **React DOM** | ^18.3.1 |
| **React Router** | react-router-dom ^7.1.1 |
| **UI / Styling** | MUI @6.3.0, Emotion ^11.14.0, styled-components ^6.1.13 |
| **TypeScript** | None (JavaScript only) |
| **Testing** | Jest (react-app/jest), @testing-library/react ^16.1.0, jest-axe ^9.0.0 |
| **E2E** | Playwright ^1.49.0 |
| **Linting** | ESLint via react-app + jsx-a11y (no `lint` script in package.json) |
| **Deploy** | gh-pages → `build/` folder |
| **Build output** | `build/` (static SPA) |

### Baseline Results (Phase 0)

| Check | Result | Notes |
|-------|--------|-------|
| `node -v` | v24.13.1 | Node already on LTS |
| `npm run test:coverage` | ❌ Fails | "No tests found" — possible Jest + Windows UNC path issue. Tests exist in `src/**/*.test.js`. |
| `npm run build` | ⏳ In progress | CRA build started; deprecation warning: `fs.F_OK`. |
| `npm run lint` | ❌ Missing | No `lint` script defined. |
| `npm run test:e2e` | Not run | Playwright configured for Chromium. |

### Known Deprecations & High-Risk Dependencies

- **react-scripts (CRA)** — Maintained in maintenance mode; no major updates planned. Migration to Vite or another build system recommended.
- **fs.F_OK** — Deprecation warning during build (from CRA/webpack internals).
- **npm `devdir`** — Warning: "Unknown env config 'devdir'. This will stop working in the next major version of npm."
- **No `engines` field** — Node version not pinned; CI/local can drift.

### Must Upgrade First (Toolchain Blockers)

1. Add `lint` script so lint can run in CI.
2. Resolve or document Jest "No tests found" on Windows/UNC paths (if applicable).
3. Pin Node version via `engines` and `.nvmrc`.

---

## 2. Target Versions

| Tool | Target | Rationale |
|------|--------|-----------|
| **Node.js** | 24.x LTS (or 22.x if 24 causes issues) | Already on 24.13.1; pin it. |
| **Framework** | Vite | CRA is maintenance-only; Vite is faster and modern. |
| **React** | 19.x (latest stable) | After build-system migration. |
| **TypeScript** | Optional (Phase 3+) | Can add incrementally if desired. |
| **ESLint** | 9.x + flat config | Modern config format. |
| **Prettier** | Latest | Add if not present. |

---

## 3. Dependency Upgrade Order and Rationale

1. **Phase 1 — Toolchain**
   - Add `engines` and `.nvmrc` (Node 24 or 22)
   - Add `lint` script (e.g. `eslint src/`)
   - Upgrade ESLint, Prettier, PostCSS (if needed)
   - Fix Jest path issue if blocking tests

2. **Phase 2 — Build System**
   - Migrate CRA → Vite (or stay on CRA if migration risk is too high)
   - Ensure env vars (`REACT_APP_*`) map to `VITE_*` if migrating
   - Ensure `homepage` in package.json works for gh-pages base path

3. **Phase 3 — React**
   - Upgrade React 18 → 19
   - Upgrade React Router if needed
   - Verify MUI 6 compatibility with React 19
   - Verify styled-components, Emotion compatibility

4. **Phase 4 — Design**
   - Formalize design tokens (theme.js)
   - Apply consistent component patterns
   - Accessibility audit and fixes

5. **Phase 5 — Quality Gates**
   - CI workflow (e.g. GitHub Actions)
   - Coverage thresholds enforced
   - E2E in CI

---

## 4. Risk Register (Top 10)

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | CRA → Vite migration breaks build | High | Medium | Staged migration; keep CRA branch until Vite build verified |
| 2 | React 19 breaks MUI or other deps | High | Low | Check MUI/styled-components compatibility before upgrade |
| 3 | gh-pages deploy breaks (base path) | High | Low | Test deploy to branch before merging |
| 4 | Jest tests fail on new stack | Medium | Medium | Fix path issue first; run tests after each phase |
| 5 | ESLint upgrade introduces new errors | Low | Medium | Run lint after upgrade; fix incrementally |
| 6 | Node 24 vs 22 compatibility | Medium | Low | Pin to 22 LTS if 24 causes issues |
| 7 | Playwright E2E flakiness in CI | Low | Medium | Retries, single worker in CI already configured |
| 8 | Design changes alter UX | Medium | Low | Limit to tokens/conventions; no visual redesign |
| 9 | Styled-components + Emotion conflict | Low | Low | Both used; ensure no duplicate style injection |
| 10 | npm `devdir` / config deprecation | Low | High | Update npm; remove or fix config |

---

## 5. Phase Breakdown

### Phase 0 — Discovery + Baseline ✅

- **Effort:** S  
- **Risk:** Low  
- **Status:** Complete  
- **Acceptance:** Versions recorded, baseline commands run.  
- **Rollback:** N/A (read-only).

---

### Phase 1 — Toolchain Upgrade (Node + Linters)

- **Effort:** S  
- **Risk:** Low  
- **Tasks:**
  - Add `engines: { "node": ">=22.0.0" }` (or `24.x`) to package.json
  - Add `.nvmrc` with `22` or `24`
  - Add `lint` script: `"lint": "eslint src/"`
  - Upgrade ESLint to 9.x with flat config (or keep react-app config)
  - Add Prettier if desired
- **Acceptance:** `npm install`, `lint`, `test`, `build` succeed.
- **Rollback:** Revert package.json and config changes; `npm install`.

---

### Phase 2 — Framework/Build System (CRA → Vite)

- **Effort:** M  
- **Risk:** Medium  
- **Recommendation:** Migrate to **Vite** — faster dev/build, actively maintained. Next.js only if SSR/SSG needed (not for current static SPA).  
- **Compatibility checklist:**
  - [ ] Env vars: None used (`REACT_APP_`); none to migrate
  - [ ] Absolute imports: CRA allows `src/`; Vite supports via `resolve.alias`
  - [ ] Asset pipeline: `public/` and `src/` assets work in Vite
  - [ ] Service worker: None detected
  - [ ] Testing: Jest can stay; or migrate to Vitest
- **Acceptance:** Dev server works, production build works, routing correct, gh-pages deploy works.
- **Rollback:** Restore CRA; revert to previous commit.

---

### Phase 3 — React Upgrade (18 → 19)

- **Effort:** M  
- **Risk:** Medium  
- **Pre-requisites:** Phase 2 complete; verify MUI 6, react-router-dom, styled-components support React 19.  
- **Tasks:**
  - Upgrade React, React-DOM to ^19
  - Upgrade React Router if required
  - Fix any deprecation warnings
  - Re-run tests and E2E
- **Acceptance:** App runs without console errors; tests pass; no critical UI regressions.
- **Rollback:** Downgrade React/React-DOM; `npm install`.

---

### Phase 4 — Design Standards Upgrade

- **Effort:** M  
- **Risk:** Low  
- **Tasks:**
  - Document design tokens (colors, typography, spacing) in theme or tokens file
  - Define button/form/alert variants
  - Apply WCAG 2.2 AA; keyboard nav; focus styles
  - Refactor in slices: nav, forms, tables, modals
- **Acceptance:** Consistent look; no contrast fails; keyboard-only core flows.
- **Rollback:** Revert theme and component changes.

---

### Phase 5 — Quality Gates

- **Effort:** S–M  
- **Risk:** Low  
- **Tasks:**
  - Add GitHub Actions (or equivalent CI): lint, test, build
  - Enforce coverage thresholds
  - Run Playwright E2E in CI
  - Document upgrade playbook
- **Acceptance:** CI blocks merges on broken build/tests; playbook exists.
- **Rollback:** Disable or adjust CI workflows.

---

## 6. Rollback Notes by Phase

| Phase | Rollback Action |
|-------|-----------------|
| 1 | Revert package.json, .nvmrc, ESLint config; `npm install` |
| 2 | Revert to CRA; restore react-scripts; delete Vite config |
| 3 | Downgrade React/React-DOM; `npm install` |
| 4 | Revert theme and component changes |
| 5 | Revert or disable CI; restore previous config |

---

## 7. Stop Point

**Awaiting approval to implement.**

Proceed with implementation only after explicit user approval. Start with Phase 1 (toolchain), then Phase 2 (Vite migration), and so on.
