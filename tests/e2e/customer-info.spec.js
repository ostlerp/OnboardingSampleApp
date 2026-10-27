// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Customer Info', () => {
  test('should add a customer to the queue with Customer Info complete', async ({ page }) => {
    // Unique name so repeated runs against the same server don't clash
    const name = `Globex ${Date.now()}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByLabel('Customer name').fill(name);
    await page.getByLabel('Contact email').fill('ops@globex.example.com');
    await page.getByLabel('Industry').selectOption('Technology');
    await page.getByRole('button', { name: 'Create customer' }).click();

    await expect(page.locator('.form-success')).toContainText(`${name} was added to the onboarding queue`);

    await page.getByRole('button', { name: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText('25%');
  });
});
