const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');

describe('Customer routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => new Promise(resolve => server.close(resolve)));

  const postCustomer = body => fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const countCustomers = async () => (await (await fetch(`${baseUrl}/api/customers`)).json()).length;

  it('should create a customer with 201 and the cleaned-up record', async () => {
    const res = await postCustomer({
      name: '  ABC   Accounting ',
      contactEmail: 'Ops@ABC.example.com ',
      industry: 'Accounting',
      region: 'EMEA'
    });
    const customer = await res.json();

    assert.strictEqual(res.status, 201);
    assert.ok(customer.id.startsWith('cust_'));
    assert.ok(customer.createdAt);
    assert.strictEqual(customer.name, 'ABC Accounting');
    assert.strictEqual(customer.contactEmail, 'ops@abc.example.com');
    assert.strictEqual(customer.industry, 'Accounting');
    assert.strictEqual(customer.region, 'EMEA');
  });

  it('should mark Customer Info complete, giving 25% progress', async () => {
    const customer = await (await postCustomer({ name: 'Globex Ltd', contactEmail: 'ops@globex.example.com' })).json();
    const state = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();

    assert.strictEqual(state.steps[0].status, 'completed');
    assert.strictEqual(state.steps[1].status, 'pending');
    assert.strictEqual(state.progressPercent, 25);
  });

  it('should return 400 with an error per missing field and store nothing', async () => {
    const countBefore = await countCustomers();
    const res = await postCustomer({ name: '   ', contactEmail: '' });
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.errors.name, 'Customer name is required');
    assert.strictEqual(body.errors.contactEmail, 'Contact email is required');
    assert.strictEqual(await countCustomers(), countBefore);
  });

  it('should return the industry and region lists', async () => {
    const res = await fetch(`${baseUrl}/api/customers/options`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.ok(body.industries.includes('Manufacturing'));
    assert.ok(body.regions.includes('North America'));
  });
});
