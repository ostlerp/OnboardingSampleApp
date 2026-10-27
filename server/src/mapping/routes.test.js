const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../index');

const CUSTOMER_B_CLIENTS = path.join(__dirname, '..', '..', '..', 'sample-data', 'CustomerB_XYZFinancialServices', 'clients.csv');

const CSV = [
  'clientCode,companyName,entityType,clientStatus,startDate,federalTaxId,yearlyRevenue,sectorCode,billingTerms,mainContact',
  'XYZ-001,Apex Digital Marketing,CORP,A,2023-02-10,11-2233445,1850000,TECH,NET30,Williams, Robert',
  'XYZ-002,Beacon Insurance Agency,LLC,A,2023-04-15,22-3344556,920000,FINS,NET15,Thompson, Karen'
].join('\n');

describe('Data mapping analyze route', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => new Promise(resolve => server.close(resolve)));

  const analyze = (customerId, body) => fetch(`${baseUrl}/api/customers/${customerId}/mapping/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  it('should return 404 for an unknown customer', async () => {
    const res = await analyze('cust_missing', { csv: 'a,b\n1,2' });

    assert.strictEqual(res.status, 404);
  });

  it('should return 400 when no file content is sent', async () => {
    const res = await analyze('cust_001', { csv: '   ' });
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.errors.csv, 'Choose a clients CSV file');
  });

  it('should suggest columns and report merged rows for a sample file', async () => {
    const csv = fs.readFileSync(CUSTOMER_B_CLIENTS, 'utf8');
    const res = await analyze('cust_001', { csv });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.fields.length, 10);
    assert.strictEqual(body.columns.externalId, 'clientCode');
    assert.strictEqual(body.columns.primaryContact, 'mainContact');
    assert.ok(body.warnings[0].includes('extras merged into mainContact'));
  });

  const post = (url, body) => fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const put = (url, body) => fetch(`${baseUrl}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const createCustomer = async name =>
    (await post('/api/customers', { name, contactEmail: 'ops@example.com' })).json();

  const SUGGESTED = {
    externalId: 'clientCode',
    name: 'companyName',
    entityType: 'entityType',
    status: 'clientStatus',
    startDate: 'startDate',
    taxId: 'federalTaxId',
    annualRevenue: 'yearlyRevenue',
    industry: 'sectorCode',
    paymentTerms: 'billingTerms',
    primaryContact: 'mainContact'
  };

  describe('PUT and GET /api/customers/:id/mapping', () => {
    it('should return 404 before a mapping is saved', async () => {
      const customer = await createCustomer('Unmapped Co');
      const res = await fetch(`${baseUrl}/api/customers/${customer.id}/mapping`);

      assert.strictEqual(res.status, 404);
    });

    it('should reject unmapped required fields and unknown columns without saving', async () => {
      const customer = await createCustomer('Rejected Co');
      const res = await put(`/api/customers/${customer.id}/mapping`, {
        csv: CSV,
        columns: { ...SUGGESTED, externalId: null, taxId: 'nope' }
      });
      const body = await res.json();
      const state = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.errors['columns.externalId'], 'Required field is unmapped');
      assert.strictEqual(body.errors['columns.taxId'], 'Column "nope" is not in the file');
      assert.strictEqual(state.steps[1].status, 'pending');
      assert.strictEqual((await fetch(`${baseUrl}/api/customers/${customer.id}/mapping`)).status, 404);
    });

    it('should save the mapping, complete Data Mapping and return it from GET', async () => {
      const customer = await createCustomer('Mapped Co');
      const res = await put(`/api/customers/${customer.id}/mapping`, {
        csv: CSV,
        fileName: 'clients.csv',
        columns: SUGGESTED
      });
      const state = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();
      const saved = await (await fetch(`${baseUrl}/api/customers/${customer.id}/mapping`)).json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(state.steps[1].status, 'completed');
      assert.strictEqual(state.progressPercent, 50);
      assert.deepStrictEqual(saved.columns, SUGGESTED);
      assert.strictEqual(saved.fileName, 'clients.csv');
      assert.strictEqual(saved.rowCount, 2);
      assert.strictEqual(saved.headers.length, 10);
    });

    it('should keep progress the same when saving again', async () => {
      const customer = await createCustomer('Resaved Co');
      const body = { csv: CSV, columns: SUGGESTED };
      await put(`/api/customers/${customer.id}/mapping`, body);
      await put(`/api/customers/${customer.id}/mapping`, body);
      const state = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();

      assert.strictEqual(state.progressPercent, 50);
    });
  });
});
