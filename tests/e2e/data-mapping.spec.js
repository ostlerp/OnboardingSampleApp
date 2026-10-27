// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');

const CUSTOMER_B_CLIENTS = path.join(__dirname, '..', '..', 'sample-data', 'CustomerB_XYZFinancialServices', 'clients.csv');

test.describe('Data Mapping', () => {
  test('should suggest column mappings for an uploaded clients file', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: 'Acme Corporation' });
    await page.getByLabel('Clients file (CSV)').setInputFiles(CUSTOMER_B_CLIENTS);

    await expect(page.getByLabel('External ID', { exact: true })).toHaveValue('clientCode');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('companyName');
    await expect(page.locator('.mapping-warning')).toContainText('extras merged into mainContact');
  });
});
