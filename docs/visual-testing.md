# Visual Regression Tests

Every PR automatically captures screenshots of the marketing site, tenant/landlord portal, and admin panels at three viewports. If a PR changes how a page *looks*, CI attaches a pixel diff that a reviewer can download and eyeball — no need to pull the branch and run `npm run dev`.

## How it works

- Specs live in `e2e/visual/*.visual.spec.mjs`.
- Baselines live in `e2e/visual/<spec>.visual.spec.mjs-snapshots/` and are committed to the repo.
- On every PR, `.github/workflows/visual-regression.yml` runs `npm run test:visual`.
  - If every page matches its baseline, the job is green.
  - If a baseline is **missing** (new test, never run before), the job auto-runs `--update-snapshots`, commits the new baseline back to the PR branch (as `Bootstrap visual regression baselines [skip ci]`), and exits green. You'll see a follow-up commit appear on the PR — just `git pull` next time you push.
  - If a baseline **differs** from the live render, the job fails and uploads a `playwright-report` artifact with expected / actual / diff PNGs. The reviewer downloads it, decides whether the change is intentional, and (if it is) the developer regenerates baselines locally.
- Built on top of the existing Playwright setup (`playwright.config.mjs`). Functional critical-path tests still run under the `chromium` project; visual tests run under `visual-chromium`.

## Running locally

```bash
# Run the visual suite (expects baselines to exist)
npm run test:visual

# Regenerate baselines after an intentional UI change
npm run test:visual:update

# Interactive triage mode (Playwright UI)
npm run test:visual:ui
```

All three scripts pass `PORTAL_E2E=true` automatically so the dev-auth build is used for portal + admin pages.

## Updating baselines when you change UI

1. Make the UI change.
2. Run `npm run test:visual` — it fails with one or more diff images.
3. Open `playwright-report/index.html` and confirm the diff is what you meant to change (nothing unexpected).
4. Run `npm run test:visual:update` to regenerate baselines.
5. Commit the updated `*-snapshots/` folders alongside the code change.
6. Push. CI re-runs against the new baselines and passes.

The reviewer sees:
- The *code* change.
- The *baseline image* change (visible in the PR diff because PNGs are tracked).
- A clean CI run confirming the new render matches the new baseline.

## Reviewing a PR that changes UI

1. Open the PR, look at the updated PNG baselines in the diff — GitHub renders image diffs side-by-side.
2. If that's not enough detail (antialiasing or color shifts) open the CI run, download the `playwright-report` artifact, unzip, open `index.html` in a browser.
3. Each failing test has three images: expected (baseline), actual (this PR), diff (pixels that changed, highlighted).

## Determinism

`e2e/visual/fixtures.mjs` installs these defaults on every page so baselines don't drift between machines:

- `Date.now()` frozen to `2026-01-15T12:00:00Z`.
- All `/api/**` requests intercepted with canned JSON responses.
- Firebase, Google, Vercel analytics, and reCAPTCHA requests return 204 (offline CI).
- Animations and transitions disabled via `prefers-reduced-motion`.
- Timezone pinned to `America/Chicago`, locale pinned to `en-US`.

If your change includes a deliberately dynamic element (user avatar, live clock, server-assigned ID), mark it in the DOM with `data-visual-mask` — the screenshot helper masks those regions automatically.

## Scope

Currently captured:

- **Marketing** — all public routes from `src/App.jsx` MarketingRoutes, light + dark mode.
- **Portal (LANDLORD)** — dashboard, profile, requests, payments, documents, status, inbox, tenants, properties, notices.
- **Admin** — `/portal/admin/config` (LANDLORD-accessible). Strict-ADMIN routes (`/portal/admin/landlords`, `/portal/admin/health/notification-test`) currently render the route-guard screen because `VITE_PORTAL_DEV_AUTH=true` injects a LANDLORD session (see `src/PortalAuthContext.jsx:70-112`).

Each route is captured at three viewports: mobile (375×812), tablet (768×1024), desktop (1440×900).

## Future expansion

To also capture the strict-ADMIN admin pages, extend `src/PortalAuthContext.jsx` dev-auth to read a role from e.g. `VITE_PORTAL_DEV_AUTH_ROLE`, then add a second Playwright project that builds with `VITE_PORTAL_DEV_AUTH_ROLE=admin`. Kept out of the initial version to avoid scope creep.
