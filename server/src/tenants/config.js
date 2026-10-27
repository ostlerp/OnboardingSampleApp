const { PLANS, RESERVED_SUBDOMAINS } = require('./options');

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Suggests a subdomain from a customer name, e.g. "Acme Corporation" -> "acme-corporation"
 * @param {string} name
 * @returns {string}
 */
function suggestSubdomain(name) {
  return clean(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '');
}

/**
 * @param {Object} body - Raw request body
 * @returns {{plan: string, subdomain: string, adminEmail: string}}
 */
function normalizeTenantConfig(body = {}) {
  return {
    plan: clean(body.plan),
    subdomain: clean(body.subdomain),
    adminEmail: clean(body.adminEmail)
  };
}

/**
 * @param {{plan: string, subdomain: string, adminEmail: string}} config - Normalized config
 * @returns {Object<string, string>} Error message per field, empty when valid
 */
function validateTenantConfig(config) {
  const errors = {};
  if (!PLANS.includes(config.plan)) {
    errors.plan = `Must be one of: ${PLANS.join(', ')}`;
  }
  if (!SUBDOMAIN_PATTERN.test(config.subdomain)) {
    errors.subdomain = 'Use 3–30 lowercase letters, numbers or hyphens, not starting or ending with a hyphen';
  } else if (RESERVED_SUBDOMAINS.includes(config.subdomain)) {
    errors.subdomain = `"${config.subdomain}" is reserved`;
  }
  if (!config.adminEmail) {
    errors.adminEmail = 'Admin email is required';
  } else if (!EMAIL_PATTERN.test(config.adminEmail)) {
    errors.adminEmail = 'Enter a valid email address';
  }
  return errors;
}

module.exports = {
  suggestSubdomain,
  normalizeTenantConfig,
  validateTenantConfig
};
