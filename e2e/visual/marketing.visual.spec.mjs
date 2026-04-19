/**
 * Visual regression for public marketing routes.
 *
 * Runs without any special env — no auth needed. Each route is captured at
 * mobile / tablet / desktop, plus its dark-mode variant via the `/dark/*`
 * preview prefix supported in src/App.jsx.
 */
import { test, snap, forEachViewport, VIEWPORTS } from './fixtures.mjs';

const MARKETING_ROUTES = [
  { path: '/', slug: 'home' },
  { path: '/apply', slug: 'apply' },
  { path: '/features', slug: 'features' },
  { path: '/pricing', slug: 'pricing' },
  { path: '/contact-us', slug: 'contact-us' },
  { path: '/property-management', slug: 'property-management' },
  { path: '/for-property-managers', slug: 'for-property-managers' },
  { path: '/tenant-selection-criteria', slug: 'tenant-selection-criteria' },
  { path: '/application-required-documents', slug: 'application-required-documents' },
  { path: '/privacy', slug: 'privacy' },
  { path: '/terms-of-service', slug: 'terms-of-service' },
  { path: '/accessibility', slug: 'accessibility' },
];

test.describe('Visual: marketing (light mode)', () => {
  for (const { path, slug } of MARKETING_ROUTES) {
    test(`${slug}`, async ({ page }) => {
      await page.goto(path);
      await forEachViewport(page, async (p, vp) => {
        await snap(p, `marketing-${slug}-${vp.name}`);
      });
    });
  }
});

test.describe('Visual: marketing (dark mode)', () => {
  for (const { path, slug } of MARKETING_ROUTES) {
    test(`${slug} [dark]`, async ({ page }) => {
      // `/dark/<path>` is the in-app dark preview prefix wired up in src/App.jsx.
      const darkPath = path === '/' ? '/dark' : `/dark${path}`;
      await page.goto(darkPath);
      await forEachViewport(page, async (p, vp) => {
        await snap(p, `marketing-${slug}-dark-${vp.name}`);
      });
    });
  }
});

// Sanity check so at least one screenshot is produced even if all marketing
// routes are removed — prevents a completely empty suite slipping through CI.
test('sanity: home page loads at desktop viewport', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[2]);
  await page.goto('/');
  await snap(page, 'sanity-home-desktop');
});
