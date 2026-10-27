// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ABC_CLIENTS = path.join(__dirname, '../../sample-data/CustomerA_ABCAccounting/clients.csv');

test.describe('Import', () => {
  test('should import every client into the active tenant and finish onboarding', async ({ page, request }) => {
    const stamp = Date.now();
    const name = `Import Co ${stamp}`;
    const customer = await (await request.post('/api/customers', {
      data: { name, contactEmail: 'ops@importco.example.com' }
    })).json();

    await page.goto('/');
    await page.getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: name });
    await expect(page.locator('.readiness-list .not-ready')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Import clients' })).toBeDisabled();

    const csv = fs.readFileSync(ABC_CLIENTS, 'utf8');
    const analysis = await (await request.post(`/api/customers/${customer.id}/mapping/analyze`, {
      data: { entity: 'clients', csv }
    })).json();
    const saved = await request.put(`/api/customers/${customer.id}/mapping`, {
      data: { entity: 'clients', csv, fileName: 'clients.csv', columns: analysis.columns }
    });
    expect(saved.status()).toBe(200);

    const configured = await request.put(`/api/tenants/${customer.id}`, {
      data: { plan: 'starter', subdomain: `import-co-${stamp}`, adminEmail: 'it@importco.example.com' }
    });
    expect(configured.status()).toBe(201);
    await request.post(`/api/tenants/${customer.id}/provision`);
    await expect.poll(async () => (await (await request.get(`/api/tenants/${customer.id}`)).json()).status, {
      timeout: 10000
    }).toBe('active');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Import' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: name });
    await expect(page.locator('.readiness-list .ready')).toHaveCount(2);
    await page.getByRole('button', { name: 'Import clients' }).click();
    await expect(page.locator('.import-summary')).toContainText('10 imported, 0 updated, 0 failed');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page.locator('.customer-card', { hasText: name })).toContainText('100%');
  });
});
