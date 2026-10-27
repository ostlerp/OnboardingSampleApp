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

  test('should save the mapping, complete Data Mapping and restore it later', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: 'Acme Corporation' });
    await page.getByLabel('Clients file (CSV)').setInputFiles(CUSTOMER_B_CLIENTS);
    await page.getByLabel('Industry', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Save mapping' }).click();
    await expect(page.locator('.form-success')).toContainText('Data Mapping is complete');

    await page.getByRole('button', { name: 'Dashboard' }).click();
    const acme = page.locator('.customer-card', { hasText: 'Acme Corporation' });
    await expect(acme.locator('li', { hasText: 'Data Mapping' })).toContainText('completed');

    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: 'Acme Corporation' });
    await expect(page.getByLabel('External ID', { exact: true })).toHaveValue('clientCode');
    await expect(page.getByLabel('Industry', { exact: true })).toHaveValue('');
  });
});
