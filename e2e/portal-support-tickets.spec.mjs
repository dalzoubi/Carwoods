/**
 * E2E tests for the Support Tickets portal feature.
 *
 * Unauthenticated tests run against any build.
 * Authenticated tests require PORTAL_E2E=true (which sets VITE_PORTAL_DEV_AUTH=true
 * so the portal renders with a mock landlord session) and mock the ticket API
 * with `page.route()` so the spec exercises the full submit → list loop without
 * a backend.
 *
 * Run unauthenticated only: npm run test:e2e
 * Run authenticated:        PORTAL_E2E=true npm run test:e2e -- portal-support-tickets
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Group 1: unauthenticated
// ---------------------------------------------------------------------------

test.describe('Support Tickets: unauthenticated', () => {
  test('/portal/support redirects unauthenticated users to login landing', async ({ page }) => {
    await page.goto('/portal/support');
    await expect(page.getByRole('heading', { name: /sign in or register/i })).toBeVisible();
  });

  test('/portal/admin/support redirects unauthenticated users to login landing', async ({ page }) => {
    await page.goto('/portal/admin/support');
    await expect(page.getByRole('heading', { name: /sign in or register/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Group 2: authenticated (PORTAL_E2E=true dev-auth build + page.route mocks)
// ---------------------------------------------------------------------------

const isPortalE2E = process.env.PORTAL_E2E === 'true';

function mockPortalApis(page, { tickets = [], detail = null, lastSubmittedRef } = {}) {
  return page.route('**/api/portal/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    // Auth / shell endpoints the portal calls before anything else.
    if (path.endsWith('/api/portal/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'LANDLORD',
          user: {
            id: 'dev-user',
            first_name: 'Dev',
            last_name: 'Landlord',
            role: 'LANDLORD',
            status: 'ACTIVE',
            email: 'dev@carwoods.com',
            portal_tour_completed: true,
          },
        }),
      });
    }

    if (path.endsWith('/api/portal/sidebar-badges')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requests: 0,
          notifications: 0,
          notices: 0,
          contact: 0,
          support_tickets: 0,
          support_tickets_admin: 0,
        }),
      });
    }

    // Support ticket list
    if (path.endsWith('/api/portal/support-tickets') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tickets, total: tickets.length }),
      });
    }

    // Support ticket submit
    if (path.endsWith('/api/portal/support-tickets') && method === 'POST') {
      const payload = req.postDataJSON();
      const created = {
        id: 'ticket-new-1',
        user_id: 'dev-user',
        category: payload.category,
        area: payload.area ?? null,
        title: payload.title,
        description_markdown: payload.description_markdown,
        status: 'OPEN',
        priority: null,
        assignee_user_id: null,
        diagnostics_json: payload.diagnostics ? JSON.stringify(payload.diagnostics) : null,
        last_activity_at: new Date().toISOString(),
        resolved_at: null,
        closed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (lastSubmittedRef) lastSubmittedRef.value = payload;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ticket: created }),
      });
    }

    // Support ticket detail
    const detailMatch = /\/api\/portal\/support-tickets\/([^/]+)$/.exec(path);
    if (detailMatch && method === 'GET') {
      const id = detailMatch[1];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(detail ?? {
          ticket: {
            id,
            user_id: 'dev-user',
            category: 'QUESTION',
            area: null,
            title: 'Mocked ticket',
            description_markdown: 'Hello from the mock.',
            status: 'OPEN',
            priority: null,
            assignee_user_id: null,
            diagnostics_json: null,
            last_activity_at: new Date().toISOString(),
            resolved_at: null,
            closed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          messages: [],
          attachments: [],
        }),
      });
    }

    // Fallback: return empty JSON object
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

test.describe('Support Tickets: authenticated user flow', () => {
  test.skip(!isPortalE2E, 'Skipped — run with PORTAL_E2E=true to test the authenticated portal');

  test.beforeEach(async ({ page }) => {
    await mockPortalApis(page);
  });

  test('/portal/support renders the Support Tickets page for authenticated users', async ({ page }) => {
    await page.goto('/portal/support');
    await expect(page.getByRole('heading', { name: /support tickets/i })).toBeVisible();
  });

  test('sidebar shows a Support nav entry', async ({ page }) => {
    await page.goto('/portal');
    const supportLink = page.getByRole('link', { name: /^support$/i });
    await expect(supportLink.first()).toBeVisible();
  });

  test('empty state shows when the user has no tickets', async ({ page }) => {
    await page.goto('/portal/support');
    await expect(page.getByText(/haven't submitted any tickets/i)).toBeVisible();
  });

  test('submit form captures title, category, description and submits', async ({ page }) => {
    const submitted = { value: null };
    await page.unroute('**/api/portal/**');
    await mockPortalApis(page, { lastSubmittedRef: submitted });

    await page.goto('/portal/support?tab=submit');

    // Category = Bug report (default), fill title + description
    await page.getByLabel(/title/i).fill('Login fails on Safari');
    await page
      .getByLabel(/describe your issue or suggestion/i)
      .fill('After signing in on Safari 17 I get redirected back to login.');
    await page.getByRole('button', { name: /submit ticket/i }).click();

    await expect.poll(() => submitted.value?.title).toBe('Login fails on Safari');
    expect(submitted.value.category).toBe('BUG');
    expect(String(submitted.value.description_markdown)).toContain('Safari 17');
    // Diagnostics should be auto-attached
    expect(submitted.value.diagnostics).toBeTruthy();
    expect(typeof submitted.value.diagnostics.url).toBe('string');
  });

  test('floating help button is visible from unrelated pages and opens the submit dialog', async ({ page }) => {
    await page.goto('/portal');
    const fab = page.getByTestId('support-fab');
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(page.getByRole('heading', { name: /submit a support ticket/i })).toBeVisible();
  });

  test('floating help button is hidden on the support page itself', async ({ page }) => {
    await page.goto('/portal/support');
    await expect(page.getByTestId('support-fab')).toHaveCount(0);
  });
});
