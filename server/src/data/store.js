/**
 * In-Memory Data Store
 * Simple storage for the training exercise - no database needed
 */

const { createCustomer, createTenant, createDefaultOnboardingSteps, calculateProgress } = require('../models');

// In-memory storage
const store = {
  customers: [],
  tenants: [],
  onboardingStates: [],
  mappings: {},
  importedClients: {}
};

// Seed with example data
function seedData() {
  // Example customer - Acme Corporation
  const exampleCustomer = createCustomer({
    id: 'cust_001',
    name: 'Acme Corporation',
    industry: 'Manufacturing',
    region: 'North America',
    contactEmail: 'onboarding@acme.example.com',
    createdAt: '2025-01-15T10:00:00Z'
  });

  // Example tenant for Acme
  const exampleTenant = createTenant({
    id: 'tenant_001',
    customerId: 'cust_001',
    status: 'pending',
    plan: 'professional',
    createdAt: '2025-01-15T10:00:00Z'
  });

  // Example onboarding state - just started, nothing completed
  const exampleOnboardingState = {
    customerId: 'cust_001',
    steps: createDefaultOnboardingSteps(),
    progressPercent: 0
  };

  store.customers.push(exampleCustomer);
  store.tenants.push(exampleTenant);
  store.onboardingStates.push(exampleOnboardingState);
}

// Initialize with seed data
seedData();

// Store access functions
function getCustomers() {
  return [...store.customers];
}

function getCustomerById(id) {
  return store.customers.find(c => c.id === id);
}

function addCustomer(customer) {
  store.customers.push(customer);
  return customer;
}

function getTenants() {
  return [...store.tenants];
}

function getTenantByCustomerId(customerId) {
  return store.tenants.find(t => t.customerId === customerId);
}

function addTenant(tenant) {
  store.tenants.push(tenant);
  return tenant;
}

function updateTenant(customerId, patch) {
  const index = store.tenants.findIndex(t => t.customerId === customerId);
  if (index === -1) return null;
  store.tenants[index] = { ...store.tenants[index], ...patch, updatedAt: new Date().toISOString() };
  return store.tenants[index];
}

function getOnboardingState(customerId) {
  return store.onboardingStates.find(s => s.customerId === customerId);
}

function getAllOnboardingStates() {
  return [...store.onboardingStates];
}

function addOnboardingState(state) {
  store.onboardingStates.push(state);
  return state;
}

function updateOnboardingState(customerId, updates) {
  const index = store.onboardingStates.findIndex(s => s.customerId === customerId);
  if (index !== -1) {
    store.onboardingStates[index] = { ...store.onboardingStates[index], ...updates };
    return store.onboardingStates[index];
  }
  return null;
}

function setOnboardingStepStatus(customerId, stepId, status) {
  const state = getOnboardingState(customerId);
  if (!state) return null;
  const steps = state.steps.map(step => (step.id === stepId ? { ...step, status } : step));
  return updateOnboardingState(customerId, { steps, progressPercent: calculateProgress(steps) });
}

function getMapping(customerId) {
  return store.mappings[customerId];
}

function saveMapping(customerId, mapping) {
  store.mappings[customerId] = mapping;
  return mapping;
}

function getImportedClients(tenantId) {
  return { ...(store.importedClients[tenantId] || {}) };
}

function saveImportedClients(tenantId, records) {
  const clients = store.importedClients[tenantId] || {};
  records.forEach(record => {
    clients[record.externalId] = record;
  });
  store.importedClients[tenantId] = clients;
  return { ...clients };
}

module.exports = {
  getCustomers,
  getCustomerById,
  addCustomer,
  getTenants,
  getTenantByCustomerId,
  addTenant,
  updateTenant,
  getOnboardingState,
  getAllOnboardingStates,
  addOnboardingState,
  updateOnboardingState,
  setOnboardingStepStatus,
  getMapping,
  saveMapping,
  getImportedClients,
  saveImportedClients
};
