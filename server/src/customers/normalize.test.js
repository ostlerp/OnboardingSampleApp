const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeCustomerInput } = require('./normalize');

describe('normalizeCustomerInput', () => {
  it('should trim and collapse spaces in the name', () => {
    assert.strictEqual(normalizeCustomerInput({ name: '  ABC   Accounting ' }).name, 'ABC Accounting');
  });

  it('should trim and lowercase the contact email', () => {
    assert.strictEqual(
      normalizeCustomerInput({ contactEmail: ' Ops@ABC.example.com ' }).contactEmail,
      'ops@abc.example.com'
    );
  });

  it('should treat non-string values as empty', () => {
    const input = normalizeCustomerInput({ name: 42, contactEmail: null, industry: ['Retail'] });

    assert.deepStrictEqual(input, { name: '', contactEmail: '', industry: '', region: '' });
  });

  it('should return empty fields when no body is sent', () => {
    assert.deepStrictEqual(normalizeCustomerInput(), { name: '', contactEmail: '', industry: '', region: '' });
  });
});
