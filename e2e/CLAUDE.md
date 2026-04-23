# E2E tests — Claude scope

Applies to files under `e2e/` and `playwright.config.*`. Read `../CLAUDE.md` for the root rules first.

## Module format

- ESM only: `playwright.config.mjs` and `e2e/*.spec.mjs`. The repo's `package.json` has `"type": "module"` — `.js` files would be interpreted as ESM too, but the established convention is `.mjs` for clarity.

## Browsers

- Chromium only. Install via `npm run test:e2e:install`.

## Running

- Marketing + non-visual portal: `npm run test:e2e`
- Visual regression: `npm run test:visual` (script sets `PORTAL_E2E`; if you invoke `playwright` directly with mixed projects set `PORTAL_E2E=true` yourself)
- Visual UI mode: `npm run test:visual:ui`
- Update visual baselines: `npm run test:visual:update` — only after confirming the diff is intentional

## Dev server

- The dev server must be running (`npm run dev`) or configured via `webServer` in `playwright.config.mjs`.

## Authoring

- Prefer role-based selectors (`getByRole`, `getByLabel`) over CSS or test-ids
- Assert observable behavior, not implementation details
- Avoid arbitrary `waitForTimeout` — wait for specific selectors, URLs, or network responses
- Keep specs deterministic: seed data, disable animations where needed, avoid reliance on real-time clocks

## Portal-specific

- Authenticated portal specs must set up a stub/mock auth state — do not hit production Firebase
- Mirror the `isPortalRoute()` split from `App.jsx`: portal specs live under the portal project config
