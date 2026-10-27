const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const store = require('../data/store');
const { createTenant } = require('../models');

const CLEAN_CSV = [
  'Client ID,Client Name,Status,Annual Revenue',
  'C001,Riverside,Active,1000',
  'C002,Downtown,Active,2000'
].join('\n');

const COLUMNS = {
  externalId: 'Client ID',
  name: 'Client Name',
  entityType: null,
  status: 'Status',
  startDate: null,
  taxId: null,
  annualRevenue: 'Annual Revenue',
  industry: null,
  paymentTerms: null,
  primaryContact: null
};

describe('Import routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => new Promise(resolve => server.close(resolve)));

  const post = (url, body = {}) => fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  async function readyCustomer(name, csv = CLEAN_CSV) {
    const customer = await (await post('/api/customers', { name, contactEmail: 'ops@example.com' })).json();
    store.saveMapping(customer.id, { entity: 'clients', csv, columns: COLUMNS });
    store.setOnboardingStepStatus(customer.id, 'step_2', 'completed');
    const tenant = store.addTenant(createTenant({ customerId: customer.id, status: 'active' }));
    store.setOnboardingStepStatus(customer.id, 'step_3', 'completed');
    return { customer, tenant };
  }

  const onboarding = async id => (await fetch(`${baseUrl}/api/customers/${id}/onboarding`)).json();

  it('should return 409 listing what is missing', async () => {
    const res = await post('/api/customers/cust_001/import');

    assert.strictEqual(res.status, 409);
    assert.deepStrictEqual(await res.json(), { error: 'Not ready to import', missing: ['mapping', 'activeTenant'] });
  });

  it('should return 409 when the tenant is not active yet', async () => {
    const { customer } = await readyCustomer('Pending Tenant Co');
    store.updateTenant(customer.id, { status: 'provisioning' });
    const res = await post(`/api/customers/${customer.id}/import`);

    assert.strictEqual(res.status, 409);
    assert.deepStrictEqual((await res.json()).missing, ['activeTenant']);
  });

  it('should import every row, store it on the tenant and complete onboarding', async () => {
    const { customer, tenant } = await readyCustomer('Clean Import Co');
    const res = await post(`/api/customers/${customer.id}/import`);
    const state = await onboarding(customer.id);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { imported: 2, updated: 0, failed: 0, errors: [] });
    assert.deepStrictEqual(Object.keys(store.getImportedClients(tenant.id)).sort(), ['C001', 'C002']);
    assert.strictEqual(state.steps[3].status, 'completed');
    assert.strictEqual(state.progressPercent, 100);
  });

  it('should leave Import in progress and store only valid rows when some rows fail', async () => {
    const csv = `${CLEAN_CSV}\nC003,,Active,3000`;
    const { customer, tenant } = await readyCustomer('Messy Import Co', csv);
    const summary = await (await post(`/api/customers/${customer.id}/import`)).json();
    const state = await onboarding(customer.id);

    assert.strictEqual(summary.imported, 2);
    assert.strictEqual(summary.failed, 1);
    assert.deepStrictEqual(summary.errors, [{ row: 4, messages: ['Name is required'] }]);
    assert.deepStrictEqual(Object.keys(store.getImportedClients(tenant.id)).sort(), ['C001', 'C002']);
    assert.strictEqual(state.steps[3].status, 'in_progress');
    assert.strictEqual(state.progressPercent, 75);
  });

  it('should update existing records instead of duplicating them on re-import', async () => {
    const { customer, tenant } = await readyCustomer('Reimport Co');
    await post(`/api/customers/${customer.id}/import`);
    const summary = await (await post(`/api/customers/${customer.id}/import`)).json();

    assert.strictEqual(summary.imported, 0);
    assert.strictEqual(summary.updated, 2);
    assert.strictEqual(Object.keys(store.getImportedClients(tenant.id)).length, 2);
  });

  it('should return 404 for an unknown customer', async () => {
    assert.strictEqual((await post('/api/customers/nope/import')).status, 404);
  });
});
