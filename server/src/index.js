const express = require('express');
const cors = require('cors');
const store = require('./data/store');
const { createCustomer, createTenant, createDefaultOnboardingSteps, calculateProgress } = require('./models');
const { normalizeCustomerInput } = require('./customers/normalize');
const { INDUSTRIES, REGIONS, validateCustomerInput } = require('./customers/validate');
const { parseCsv } = require('./mapping/csv');
const { suggestColumns } = require('./mapping/suggest');
const { CLIENT_FIELDS } = require('./mapping/targets');
const { validateColumns, pickColumns } = require('./mapping/validate');
const { PLANS } = require('./tenants/options');
const { suggestSubdomain, normalizeTenantConfig, validateTenantConfig } = require('./tenants/config');
const { createProvisioner, delayFromEnv } = require('./tenants/provisioner');
const { runImport } = require('./import/import');

const app = express();
const PORT = process.env.PORT || 3001;

// Tests replace this to control when and how provisioning finishes
app.locals.provisioner = createProvisioner({ delayMs: delayFromEnv(process.env.PROVISION_DELAY_MS) });

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all customers
app.get('/api/customers', (req, res) => {
  res.json(store.getCustomers());
});

// Lists the Customer Info form offers for industry and region
app.get('/api/customers/options', (req, res) => {
  res.json({ industries: INDUSTRIES, regions: REGIONS });
});

// Get customer by ID
app.get('/api/customers/:id', (req, res) => {
  const customer = store.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(customer);
});

// Get onboarding state for a customer
app.get('/api/customers/:id/onboarding', (req, res) => {
  const state = store.getOnboardingState(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Onboarding state not found' });
  }
  res.json(state);
});

// Get all onboarding states (dashboard view)
app.get('/api/onboarding', (req, res) => {
  const states = store.getAllOnboardingStates();
  const customers = store.getCustomers();
  
  // Join customer info with onboarding state
  const dashboard = states.map(state => {
    const customer = customers.find(c => c.id === state.customerId);
    return {
      ...state,
      customerName: customer?.name || 'Unknown',
      customerIndustry: customer?.industry || '',
      customerRegion: customer?.region || ''
    };
  });
  
  res.json(dashboard);
});

// Plans the Tenant Setup form offers; registered before /api/tenants/:customerId
app.get('/api/tenants/options', (req, res) => {
  res.json({ plans: PLANS });
});

// Get tenant by customer ID
app.get('/api/tenants/:customerId', (req, res) => {
  const tenant = store.getTenantByCustomerId(req.params.customerId);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  res.json(tenant);
});

// Onboard a new customer from the Customer Info form
app.post('/api/customers', (req, res) => {
  const input = normalizeCustomerInput(req.body);
  const errors = validateCustomerInput(input);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const customer = store.addCustomer(createCustomer(input));
  const steps = createDefaultOnboardingSteps().map(step =>
    step.id === 'step_1' ? { ...step, status: 'completed' } : step
  );
  store.addOnboardingState({
    customerId: customer.id,
    steps,
    progressPercent: calculateProgress(steps)
  });

  res.status(201).json(customer);
});

// Read an uploaded clients file and suggest which source column fills each field
app.post('/api/customers/:id/mapping/analyze', (req, res) => {
  if (!store.getCustomerById(req.params.id)) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  if (typeof req.body.csv !== 'string' || req.body.csv.trim() === '') {
    return res.status(400).json({ errors: { csv: 'Choose a clients CSV file' } });
  }

  const { headers, warnings } = parseCsv(req.body.csv);
  res.json({ headers, warnings, fields: CLIENT_FIELDS, columns: suggestColumns(headers) });
});

// Save a customer's mapping and the file it applies to, completing Data Mapping
app.put('/api/customers/:id/mapping', (req, res) => {
  if (!store.getCustomerById(req.params.id)) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  const { csv, columns, fileName } = req.body || {};
  if (typeof csv !== 'string' || csv.trim() === '') {
    return res.status(400).json({ errors: { csv: 'Choose a clients CSV file' } });
  }
  const { headers } = parseCsv(csv);
  const errors = validateColumns(columns, headers);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const mapping = store.saveMapping(req.params.id, {
    entity: 'clients',
    fileName: typeof fileName === 'string' ? fileName : '',
    csv,
    columns: pickColumns(columns),
    savedAt: new Date().toISOString()
  });
  store.setOnboardingStepStatus(req.params.id, 'step_2', 'completed');

  res.json(mapping);
});

// Get a customer's saved mapping, with the file details the Data Mapping tab shows
app.get('/api/customers/:id/mapping', (req, res) => {
  const mapping = store.getMapping(req.params.id);
  if (!mapping) {
    return res.status(404).json({ error: 'Mapping not found' });
  }
  const { headers, rows, warnings } = parseCsv(mapping.csv);
  res.json({ ...mapping, fields: CLIENT_FIELDS, headers, rowCount: rows.length, warnings });
});

// Suggested tenant configuration for a customer
app.get('/api/customers/:id/tenant-defaults', (req, res) => {
  const customer = store.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json({
    plan: 'starter',
    subdomain: suggestSubdomain(customer.name),
    adminEmail: customer.contactEmail,
    region: customer.region
  });
});

// Create or update a customer's tenant configuration while it is pending or failed
app.put('/api/tenants/:customerId', (req, res) => {
  const customer = store.getCustomerById(req.params.customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  const existing = store.getTenantByCustomerId(customer.id);
  if (existing && !['pending', 'failed'].includes(existing.status)) {
    return res.status(409).json({ error: `Tenant is ${existing.status} and can no longer be changed` });
  }

  const config = normalizeTenantConfig(req.body);
  const errors = validateTenantConfig(config);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  const taken = store.getTenants().some(t => t.subdomain === config.subdomain && t.customerId !== customer.id);
  if (taken) {
    return res.status(409).json({ errors: { subdomain: 'Subdomain is already taken' } });
  }

  if (existing) {
    return res.json(store.updateTenant(customer.id, { ...config, region: customer.region }));
  }
  const tenant = store.addTenant(createTenant({ customerId: customer.id, ...config, region: customer.region }));
  res.status(201).json(tenant);
});

// Start provisioning a configured tenant; it becomes active in the background
app.post('/api/tenants/:customerId/provision', (req, res) => {
  const tenant = store.getTenantByCustomerId(req.params.customerId);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  if (!['pending', 'failed'].includes(tenant.status)) {
    return res.status(409).json({ error: `Tenant is already ${tenant.status}` });
  }
  const errors = validateTenantConfig(tenant);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Tenant configuration is incomplete', errors });
  }

  const provisioning = store.updateTenant(tenant.customerId, { status: 'provisioning', error: '' });
  res.status(202).json(provisioning);

  app.locals.provisioner.provision({ ...provisioning }, () => {
    store.updateTenant(tenant.customerId, { status: 'active' });
    store.setOnboardingStepStatus(tenant.customerId, 'step_3', 'completed');
  });
});

// Import a customer's clients into its active tenant using the saved mapping
app.post('/api/customers/:id/import', (req, res) => {
  if (!store.getCustomerById(req.params.id)) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  const mapping = store.getMapping(req.params.id);
  const tenant = store.getTenantByCustomerId(req.params.id);
  const missing = [];
  if (!mapping) missing.push('mapping');
  if (tenant?.status !== 'active') missing.push('activeTenant');
  if (missing.length > 0) {
    return res.status(409).json({ error: 'Not ready to import', missing });
  }

  const { records, summary } = runImport(parseCsv(mapping.csv), mapping, store.getImportedClients(tenant.id));
  store.saveImportedClients(tenant.id, records);
  store.setOnboardingStepStatus(req.params.id, 'step_4', summary.failed === 0 ? 'completed' : 'in_progress');

  res.json(summary);
});

module.exports = app;

// Start server when run directly; tests import the app without listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Onboarding API server running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}
