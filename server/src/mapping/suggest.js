const { CLIENT_FIELDS } = require('./targets');

/**
 * Source column names seen in the sample customer files, per target field.
 * Names are compared ignoring case and non-letters, so "Client ID",
 * "clientCode" and "customer_id" are all recognised.
 */
const ALIASES = {
  externalId: ['Client ID', 'clientCode', 'customer_id'],
  name: ['Client Name', 'companyName', 'business_name'],
  entityType: ['Business Type', 'entityType', 'legal_structure'],
  status: ['Status', 'clientStatus', 'account_status'],
  startDate: ['Date Onboarded', 'startDate', 'registration_date'],
  taxId: ['Tax ID', 'federalTaxId', 'tax_reference'],
  annualRevenue: ['Annual Revenue', 'yearlyRevenue', 'gross_revenue'],
  industry: ['Industry', 'sectorCode', 'industry_sector'],
  paymentTerms: ['Payment Terms', 'billingTerms', 'credit_terms'],
  primaryContact: ['Primary Contact', 'mainContact', 'key_contact_name']
};

/**
 * Lowercases a column name and drops everything except letters
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Suggests the source column for each client target field
 * @param {string[]} headers - Column names from the uploaded file
 * @returns {Object<string, string|null>} Source column per target field, null when unmapped
 */
function suggestColumns(headers) {
  const byName = new Map(headers.map(header => [normalizeName(header), header]));
  return Object.fromEntries(CLIENT_FIELDS.map(field => {
    const match = ALIASES[field.key].map(normalizeName).find(alias => byName.has(alias));
    return [field.key, match ? byName.get(match) : null];
  }));
}

module.exports = {
  suggestColumns
};
