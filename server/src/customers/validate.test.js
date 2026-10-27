const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateCustomerInput } = require('./validate');

describe('validateCustomerInput', () => {
  const valid = {
    name: 'Globex Ltd',
    contactEmail: 'ops@globex.example.com',
    industry: '',
    region: ''
  };

  it('should accept a customer with only name and email', () => {
    assert.deepStrictEqual(validateCustomerInput(valid), {});
  });

  it('should require a name', () => {
    const errors = validateCustomerInput({ ...valid, name: '' });

    assert.strictEqual(errors.name, 'Customer name is required');
    assert.strictEqual(errors.contactEmail, undefined);
  });

  it('should require a contact email', () => {
    const errors = validateCustomerInput({ ...valid, contactEmail: '' });

    assert.strictEqual(errors.contactEmail, 'Contact email is required');
    assert.strictEqual(errors.name, undefined);
  });
});
