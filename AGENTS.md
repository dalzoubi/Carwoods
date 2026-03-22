# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Carwoods is a static React 18 website (no backend/database) for property management in Houston. Uses Vite 7, MUI v6, and npm as the package manager.

### Running the app

- `npm run dev` starts the Vite dev server on port 3000.
- `npm run build` outputs a production build to `build/`.

### Testing

- **Unit tests**: `npx vitest run` (229 tests across 12 files). All run in jsdom, no server needed.
- **Lint**: `npx eslint src/` — there are 2 pre-existing `no-restricted-globals` errors in `src/styles.js` (usage of `history`). These are not regressions.
- **E2E tests**: `npm run test:e2e` requires Playwright Chromium (`npm run test:e2e:install`). Note: `playwright.config.js` uses CommonJS syntax (`require`/`module.exports`) but `package.json` has `"type": "module"`, which causes a `ReferenceError: require is not defined` when running E2E tests. This is a pre-existing issue.

### Gotchas

- The Vite dev server uses `usePolling: true` for file watching (configured for container compatibility).
- No secrets or API keys are required; the `.env` file only contains `CHOKIDAR_USEPOLLING=true`.
- The `homepage` field in `package.json` is `https://carwoods.com` for GitHub Pages deployment; this does not affect the dev server.
