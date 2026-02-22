const { test, expect } = require('@playwright/test');

test.describe('Critical path: Home → Tenant Criteria → Application Docs', () => {
  test('navigates from Home to Tenant Selection Criteria', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /where houston finds home/i })).toBeVisible();

    await page.getByRole('link', { name: /tenant selection criteria/i }).click();

    await expect(page).toHaveURL(/tenant-selection-criteria/);
    await expect(page.getByRole('heading', { name: /tenant selection criteria/i })).toBeVisible();
  });

  test('navigates from Tenant Criteria to Application Documents', async ({ page }) => {
    await page.goto('/tenant-selection-criteria');

    await page.getByRole('link', { name: /application required documents/i }).click();

    await expect(page).toHaveURL(/application-required-documents/);
    await expect(page.getByRole('heading', { name: /application required documents/i })).toBeVisible();
  });

  test('Application Documents links to Tenant Selection Criteria', async ({ page }) => {
    await page.goto('/application-required-documents');

    const criteriaLink = page.getByRole('link', { name: /tenant selection criteria/i }).first();
    await expect(criteriaLink).toBeVisible();
    await criteriaLink.click();

    await expect(page).toHaveURL(/tenant-selection-criteria/);
  });

  test('Contact Us page explains HAR and has contact link', async ({ page }) => {
    await page.goto('/contact-us');

    await expect(page.getByRole('heading', { name: /contact us/i })).toBeVisible();
    await expect(page.getByText(/har\.com/i)).toBeVisible();

    const harLink = page.getByRole('link', { name: /contact our agent on har\.com/i });
    await expect(harLink).toBeVisible();
    await expect(harLink).toHaveAttribute('href', /har\.com/);
  });
});
