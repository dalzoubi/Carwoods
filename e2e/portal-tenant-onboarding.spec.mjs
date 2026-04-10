/**
 * E2E tests for the Tenant Onboarding Portal.
 *
 * Tests are split into two groups:
 *  1. Unauthenticated portal behavior — runs against any build (no special env).
 *  2. Authenticated portal behavior — requires PORTAL_E2E=true build so that
 *     VITE_PORTAL_DEV_AUTH=true bypasses real auth and injects a mock landlord session.
 *
 * Run unauthenticated tests: npm run test:e2e
 * Run portal tests:          PORTAL_E2E=true npm run test:e2e
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Group 1: Unauthenticated portal behavior (works with any build)
// ---------------------------------------------------------------------------

test.describe('Portal: unauthenticated access', () => {
  test('navigating to /portal shows the login landing page', async ({ page }) => {
    await page.goto('/portal');

    // Should show the branded portal login landing, not the marketing site
    await expect(page.getByRole('heading', { name: /property portal/i })).toBeVisible();
  });

  test('/portal shows a sign-in button when unauthenticated', async ({ page }) => {
    await page.goto('/portal');

    // At least one sign-in button should be visible
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
    await expect(signInBtn).toBeVisible();
  });

  test('/portal does not render the marketing navbar', async ({ page }) => {
    await page.goto('/portal');

    // Portal shell should not include marketing footer
    await expect(page.locator('footer')).not.toBeVisible();
  });

  test('/portal has a back-to-site link', async ({ page }) => {
    await page.goto('/portal');

    const backLink = page.getByRole('link', { name: /back to/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', expect.stringContaining('carwoods'));
  });

  test('/portal/tenants redirects unauthenticated users to login landing', async ({ page }) => {
    await page.goto('/portal/tenants');

    // Should still show login landing (AuthGate intercepts)
    await expect(page.getByRole('heading', { name: /property portal/i })).toBeVisible();
  });

  test('marketing site Portal link navigates to /portal', async ({ page }) => {
    await page.goto('/');

    const portalLink = page.getByRole('link', { name: /portal/i }).first();
    await expect(portalLink).toBeVisible();
    await portalLink.click();

    await expect(page).toHaveURL(/\/portal/);
  });
});

// ---------------------------------------------------------------------------
// Group 2: Authenticated portal behavior (requires PORTAL_E2E=true build)
// These tests are skipped unless the PORTAL_E2E environment variable is set.
// ---------------------------------------------------------------------------

const isPortalE2E = process.env.PORTAL_E2E === 'true';

test.describe('Portal: authenticated tenant management (dev auth)', () => {
  test.skip(!isPortalE2E, 'Skipped — run with PORTAL_E2E=true to test authenticated portal');

  test('authenticated landlord sees the portal dashboard', async ({ page }) => {
    await page.goto('/portal');

    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('portal sidebar is visible on desktop', async ({ page }) => {
    await page.goto('/portal');

    // Sidebar should show the Carwoods logo or navigation
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('navigating to /portal/tenants shows the Tenants page', async ({ page }) => {
    await page.goto('/portal/tenants');

    await expect(page.getByRole('heading', { name: /^tenants$/i })).toBeVisible();
    await expect(page.getByText(/onboard tenants/i)).toBeVisible();
  });

  test('Tenants page shows Onboard Tenant button for landlord', async ({ page }) => {
    await page.goto('/portal/tenants');

    const btn = page.getByRole('button', { name: /onboard tenant/i });
    await expect(btn).toBeVisible();
  });

  test('Tenants page shows tenant list section', async ({ page }) => {
    await page.goto('/portal/tenants');

    await expect(page.getByRole('heading', { name: /tenant list/i })).toBeVisible();
  });

  test('Tenants page shows VITE_API_BASE_URL warning when no API configured', async ({ page }) => {
    await page.goto('/portal/tenants');

    // In dev-auth mode without a real API URL configured, the page shows an alert
    // telling the operator to set VITE_API_BASE_URL
    await expect(page.getByText(/VITE_API_BASE_URL/i)).toBeVisible();
  });

  test('Onboard Tenant button is visible on the tenants page', async ({ page }) => {
    await page.goto('/portal/tenants');

    // Button renders — may be disabled when API URL is not set
    const btn = page.getByRole('button', { name: /onboard tenant/i });
    await expect(btn).toBeVisible();
  });

  /**
   * The onboard dialog tests require the Onboard Tenant button to be enabled,
   * which only happens when VITE_API_BASE_URL is set and properties can be loaded.
   * In the dev-auth build without a real API, these tests verify page-level
   * structure; dialog interaction is covered by PortalTenants.test.jsx unit tests.
   */
  test('Tenants page shows tenant list heading', async ({ page }) => {
    await page.goto('/portal/tenants');
    await expect(page.getByRole('heading', { name: /tenant list/i })).toBeVisible();
  });

  test('Tenants page title is set correctly', async ({ page }) => {
    await page.goto('/portal/tenants');
    await expect(page).toHaveTitle(/tenant onboarding/i);
  });

  test('Tenants page refresh button is visible', async ({ page }) => {
    await page.goto('/portal/tenants');

    const refreshBtn = page.getByRole('button', { name: /refresh tenant list/i });
    await expect(refreshBtn).toBeVisible();
    // The button is disabled when API is not configured; just verify visibility
    await expect(page.getByRole('heading', { name: /tenant list/i })).toBeVisible();
  });

  test('portal sidebar contains a Tenants nav link', async ({ page }) => {
    await page.goto('/portal');

    const tenantsLink = page.getByRole('link', { name: /tenants/i });
    await expect(tenantsLink).toBeVisible();
    await tenantsLink.click();
    await expect(page).toHaveURL(/\/portal\/tenants/);
  });

  test('navigating to /portal/profile shows the Profile page', async ({ page }) => {
    await page.goto('/portal/profile');

    await expect(
      page.getByRole('heading', { name: /profile/i }).first()
    ).toBeVisible();
  });

  test('navigating to /portal/requests shows the Requests page', async ({ page }) => {
    await page.goto('/portal/requests');

    await expect(
      page.getByRole('heading', { name: /requests/i }).first()
    ).toBeVisible();
  });
});
