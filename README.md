# Carwoods

Property management and rentals in Houston and beyond. Tenant selection criteria, application documents, and contact information.

## Tech Stack

- **React** 18 with React Router
- **Vite** for fast dev and production builds
- **MUI** (Material-UI) + Emotion + styled-components for styling
- **Vitest** for unit tests
- **Playwright** for E2E tests

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

## Deployment

The app is deployed to [carwoods.com](https://carwoods.com). Vite builds to the `build` output directory and `gh-pages` publishes it. Run `npm run deploy` to build and publish.

## Learn More

- [Vite documentation](https://vite.dev/)
- [React documentation](https://react.dev/)
