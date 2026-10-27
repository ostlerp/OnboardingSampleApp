const { describe, it } = require('node:test');
const assert = require('node:assert');
const { transformRow } = require('./transform');

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

describe('transformRow', () => {
  it('should map columns to fields and read revenue as a number', () => {
    const { mapped, errors } = transformRow(
      { 'Client ID': 'C001', 'Client Name': 'Riverside', Status: 'Active', 'Annual Revenue': '2,500,000.00' },
      COLUMNS
    );

    assert.deepStrictEqual(errors, []);
    assert.strictEqual(mapped.externalId, 'C001');
    assert.strictEqual(mapped.name, 'Riverside');
    assert.strictEqual(mapped.annualRevenue, 2500000);
    assert.strictEqual(mapped.taxId, null);
  });

  it('should report empty required fields and unreadable amounts', () => {
    const { mapped, errors } = transformRow(
      { 'Client ID': ' ', 'Client Name': 'Riverside', Status: '', 'Annual Revenue': 'lots' },
      COLUMNS
    );

    assert.deepStrictEqual(errors, ['External ID is required', 'Status is required', 'Annual revenue "lots" is not a number']);
    assert.strictEqual(mapped.annualRevenue, null);
  });
});
