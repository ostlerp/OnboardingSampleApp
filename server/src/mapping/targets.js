/**
 * Target fields of a client record. A mapping must fill every required one.
 */
const CLIENT_FIELDS = [
  { key: 'externalId', label: 'External ID', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'entityType', label: 'Entity type', required: false },
  { key: 'status', label: 'Status', required: true },
  { key: 'startDate', label: 'Start date', required: false },
  { key: 'taxId', label: 'Tax ID', required: false },
  { key: 'annualRevenue', label: 'Annual revenue', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'paymentTerms', label: 'Payment terms', required: false },
  { key: 'primaryContact', label: 'Primary contact', required: false }
];

module.exports = {
  CLIENT_FIELDS
};
