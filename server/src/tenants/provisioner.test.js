const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createProvisioner, delayFromEnv } = require('./provisioner');

describe('createProvisioner', () => {
  it('should report success after the delay', async () => {
    const result = await new Promise(resolve => createProvisioner({ delayMs: 0 }).provision({}, resolve));

    assert.deepStrictEqual(result, { ok: true });
  });
});

describe('delayFromEnv', () => {
  it('should use a valid number and fall back to 2000 otherwise', () => {
    assert.strictEqual(delayFromEnv('0'), 0);
    assert.strictEqual(delayFromEnv('500'), 500);
    assert.strictEqual(delayFromEnv(undefined), 2000);
    assert.strictEqual(delayFromEnv(''), 2000);
    assert.strictEqual(delayFromEnv('-1'), 2000);
    assert.strictEqual(delayFromEnv('soon'), 2000);
  });
});
