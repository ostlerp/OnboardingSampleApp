// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Tenant Setup', () => {
  test('should configure and provision a tenant until it is active', async ({ page, request }) => {
    const stamp = Date.now();
    const name = `Tenant Co ${stamp}`;
    const created = await request.post('/api/customers', {
      data: { name, contactEmail: 'ops@tenantco.example.com', region: 'EMEA' }
    });
    expect(created.status()).toBe(201);

    await page.goto('/');
    await page.getByRole('button', { name: 'Tenant Setup' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: name });

    await expect(page.getByLabel('Subdomain')).toHaveValue(`tenant-co-${stamp}`);
    await expect(page.getByLabel('Admin email')).toHaveValue('ops@tenantco.example.com');
    await expect(page.getByLabel('Region')).toHaveValue('EMEA');
    await expect(page.getByRole('button', { name: 'Provision tenant' })).toBeDisabled();

    await page.getByLabel('Plan').selectOption('enterprise');
    await page.getByRole('button', { name: 'Save configuration' }).click();
    await expect(page.locator('.status-badge')).toHaveText('pending');

    await page.getByRole('button', { name: 'Provision tenant' }).click();
    await expect(page.locator('.status-badge')).toHaveText('Provisioning…');
    await expect(page.locator('.status-badge')).toHaveText('active', { timeout: 10000 });
    await expect(page.getByLabel('Subdomain')).toBeDisabled();

    await page.getByRole('button', { name: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: name });
    await expect(card.locator('li', { hasText: 'Tenant Setup' })).toContainText('completed');
    await expect(card).toContainText('50%');
  });
});
