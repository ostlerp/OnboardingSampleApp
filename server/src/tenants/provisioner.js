const DEFAULT_DELAY_MS = 2000;

/**
 * Simulated provisioner: reports success after a delay
 * @param {{delayMs?: number}} [options]
 * @returns {{provision: (tenant: Object, onDone: (result: {ok: boolean}) => void) => void}}
 */
function createProvisioner({ delayMs = DEFAULT_DELAY_MS } = {}) {
  return {
    provision(tenant, onDone) {
      setTimeout(() => onDone({ ok: true }), delayMs);
    }
  };
}

/**
 * @param {string|undefined} value - PROVISION_DELAY_MS
 * @returns {number}
 */
function delayFromEnv(value) {
  const delay = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(delay) && delay >= 0 ? delay : DEFAULT_DELAY_MS;
}

module.exports = {
  createProvisioner,
  delayFromEnv
};
