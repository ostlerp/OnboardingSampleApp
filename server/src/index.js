const express = require('express');
const cors = require('cors');
const store = require('./data/store');
const { createCustomer, createDefaultOnboardingSteps, calculateProgress } = require('./models');
const { normalizeCustomerInput } = require('./customers/normalize');
const { INDUSTRIES, REGIONS, validateCustomerInput } = require('./customers/validate');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

module.exports = app;

// Start server when run directly; tests import the app without listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Onboarding API server running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}
