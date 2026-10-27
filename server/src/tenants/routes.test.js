const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const store = require('../data/store');

describe('Tenant routes', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(0, resolve);
    });
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => new Promise(resolve => server.close(resolve)));

  const send = (method, url, body) => fetch(`${baseUrl}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const createCustomer = async name =>
    (await send('POST', '/api/customers', { name, contactEmail: 'ops@example.com', region: 'EMEA' })).json();

  const config = subdomain => ({ plan: 'professional', subdomain, adminEmail: 'it@example.com' });

  it('should return the plans', async () => {
    const res = await fetch(`${baseUrl}/api/tenants/options`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((await res.json()).plans, ['starter', 'professional', 'enterprise']);
  });

  it('should suggest defaults from the customer', async () => {
    const customer = await createCustomer('Initech Systems');
    const defaults = await (await fetch(`${baseUrl}/api/customers/${customer.id}/tenant-defaults`)).json();

    assert.deepStrictEqual(defaults, {
      plan: 'starter',
      subdomain: 'initech-systems',
      adminEmail: 'ops@example.com',
      region: 'EMEA'
    });
  });

  it('should create a pending tenant with 201, then update it with 200', async () => {
    const customer = await createCustomer('Hooli');
    const created = await send('PUT', `/api/tenants/${customer.id}`, config('hooli'));
    const updated = await send('PUT', `/api/tenants/${customer.id}`, { ...config('hooli-xyz'), plan: 'enterprise' });
    const tenant = await (await fetch(`${baseUrl}/api/tenants/${customer.id}`)).json();

    assert.strictEqual(created.status, 201);
    assert.strictEqual(updated.status, 200);
    assert.strictEqual(tenant.status, 'pending');
    assert.strictEqual(tenant.plan, 'enterprise');
    assert.strictEqual(tenant.subdomain, 'hooli-xyz');
    assert.strictEqual(tenant.region, 'EMEA');
  });

  it('should configure the seeded Acme tenant without creating a second one', async () => {
    const before = store.getTenants().length;
    const res = await send('PUT', '/api/tenants/cust_001', config('acme-corporation'));

    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).id, 'tenant_001');
    assert.strictEqual(store.getTenants().length, before);
  });

  it('should return 400 with a message per invalid field', async () => {
    const customer = await createCustomer('Bad Config Co');
    const res = await send('PUT', `/api/tenants/${customer.id}`, { plan: 'gold', subdomain: 'Acme Corp!', adminEmail: 'nope' });
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(Object.keys(body.errors).sort(), ['adminEmail', 'plan', 'subdomain']);
    assert.strictEqual((await fetch(`${baseUrl}/api/tenants/${customer.id}`)).status, 404);
  });

  it('should return 409 when another tenant has the subdomain', async () => {
    const first = await createCustomer('Umbrella One');
    const second = await createCustomer('Umbrella Two');
    await send('PUT', `/api/tenants/${first.id}`, config('umbrella'));
    const res = await send('PUT', `/api/tenants/${second.id}`, config('umbrella'));

    assert.strictEqual(res.status, 409);
    assert.strictEqual((await res.json()).errors.subdomain, 'Subdomain is already taken');
  });

  it('should return 409 once the tenant is provisioning or active', async () => {
    const customer = await createCustomer('Locked Co');
    await send('PUT', `/api/tenants/${customer.id}`, config('locked-co'));
    store.updateTenant(customer.id, { status: 'active' });
    const res = await send('PUT', `/api/tenants/${customer.id}`, config('locked-co-2'));

    assert.strictEqual(res.status, 409);
  });

  it('should return 404 for an unknown customer', async () => {
    assert.strictEqual((await send('PUT', '/api/tenants/nope', config('nope-co'))).status, 404);
    assert.strictEqual((await fetch(`${baseUrl}/api/customers/nope/tenant-defaults`)).status, 404);
  });

  describe('POST /api/tenants/:customerId/provision', () => {
    let pending;

    before(() => {
      app.locals.provisioner = { provision: (tenant, onDone) => pending.push(onDone) };
    });

    const finishAll = () => pending.splice(0).forEach(onDone => onDone({ ok: true }));

    it('should return 202 provisioning, then become active and complete Tenant Setup', async () => {
      pending = [];
      const customer = await createCustomer('Provisioned Co');
      await send('PUT', `/api/tenants/${customer.id}`, config('provisioned-co'));
      const res = await send('POST', `/api/tenants/${customer.id}/provision`);
      const during = await (await fetch(`${baseUrl}/api/tenants/${customer.id}`)).json();
      const stateDuring = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();

      assert.strictEqual(res.status, 202);
      assert.strictEqual((await res.json()).status, 'provisioning');
      assert.strictEqual(during.status, 'provisioning');
      assert.strictEqual(stateDuring.steps[2].status, 'pending');

      finishAll();
      const after = await (await fetch(`${baseUrl}/api/tenants/${customer.id}`)).json();
      const stateAfter = await (await fetch(`${baseUrl}/api/customers/${customer.id}/onboarding`)).json();

      assert.strictEqual(after.status, 'active');
      assert.strictEqual(stateAfter.steps[2].status, 'completed');
      assert.strictEqual(stateAfter.progressPercent, 50);
    });

    it('should return 409 while provisioning and once active', async () => {
      pending = [];
      const customer = await createCustomer('Twice Co');
      await send('PUT', `/api/tenants/${customer.id}`, config('twice-co'));
      await send('POST', `/api/tenants/${customer.id}/provision`);
      const whileProvisioning = await send('POST', `/api/tenants/${customer.id}/provision`);
      finishAll();
      const onceActive = await send('POST', `/api/tenants/${customer.id}/provision`);

      assert.strictEqual(whileProvisioning.status, 409);
      assert.strictEqual(onceActive.status, 409);
      assert.strictEqual(pending.length, 0);
    });

    it('should return 400 when the configuration is incomplete', async () => {
      pending = [];
      const res = await send('POST', '/api/tenants/tenantless/provision');
      const acme = store.getTenantByCustomerId('cust_001');
      store.updateTenant('cust_001', { subdomain: '' });
      const incomplete = await send('POST', '/api/tenants/cust_001/provision');
      store.updateTenant('cust_001', { subdomain: acme.subdomain });

      assert.strictEqual(res.status, 404);
      assert.strictEqual(incomplete.status, 400);
      assert.strictEqual(store.getTenantByCustomerId('cust_001').status, 'pending');
      assert.strictEqual(pending.length, 0);
    });
  });
});
