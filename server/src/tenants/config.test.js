const { describe, it } = require('node:test');
const assert = require('node:assert');
const { suggestSubdomain, normalizeTenantConfig, validateTenantConfig } = require('./config');

const VALID = { plan: 'professional', subdomain: 'acme-corporation', adminEmail: 'it@acme.example.com' };

describe('suggestSubdomain', () => {
  it('should lowercase and hyphenate the customer name', () => {
    assert.strictEqual(suggestSubdomain('Acme Corporation'), 'acme-corporation');
    assert.strictEqual(suggestSubdomain('  Artisan Bakery & Cafe '), 'artisan-bakery-cafe');
  });

  it('should keep the suggestion within 30 characters without a trailing hyphen', () => {
    const suggestion = suggestSubdomain('A Very Long Customer Name That Keeps Going On');

    assert.ok(suggestion.length <= 30);
    assert.ok(!suggestion.endsWith('-'));
  });
});

describe('normalizeTenantConfig', () => {
  it('should trim and lowercase every field', () => {
    assert.deepStrictEqual(
      normalizeTenantConfig({ plan: ' Enterprise ', subdomain: ' Acme ', adminEmail: ' IT@Acme.example.com ' }),
      { plan: 'enterprise', subdomain: 'acme', adminEmail: 'it@acme.example.com' }
    );
  });
});

describe('validateTenantConfig', () => {
  it('should accept a valid configuration', () => {
    assert.deepStrictEqual(validateTenantConfig(VALID), {});
  });

  it('should reject an unknown plan', () => {
    assert.ok(validateTenantConfig({ ...VALID, plan: 'gold' }).plan);
  });

  it('should reject subdomains that break the rules', () => {
    for (const subdomain of ['ab', 'acme corp!', '-acme', 'acme-', 'a'.repeat(31), '']) {
      assert.ok(validateTenantConfig({ ...VALID, subdomain }).subdomain, `${subdomain} should be rejected`);
    }
  });

  it('should reject reserved subdomains', () => {
    assert.strictEqual(validateTenantConfig({ ...VALID, subdomain: 'admin' }).subdomain, '"admin" is reserved');
  });

  it('should require a valid admin email', () => {
    assert.strictEqual(validateTenantConfig({ ...VALID, adminEmail: '' }).adminEmail, 'Admin email is required');
    assert.strictEqual(validateTenantConfig({ ...VALID, adminEmail: 'nope' }).adminEmail, 'Enter a valid email address');
  });
});
