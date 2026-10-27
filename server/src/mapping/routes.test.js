const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../index');

const CUSTOMER_B_CLIENTS = path.join(__dirname, '..', '..', '..', 'sample-data', 'CustomerB_XYZFinancialServices', 'clients.csv');

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
});
