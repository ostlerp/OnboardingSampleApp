/**
 * Cleans up customer input before it is validated and stored
 */

/**
 * Trims a free-text value and collapses repeated spaces
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Normalizes a raw request body into the customer fields
 * @param {Object} body - Raw request body
 * @returns {{name: string, contactEmail: string, industry: string, region: string}}
 */
function normalizeCustomerInput(body = {}) {
  return {
    name: cleanText(body.name),
    contactEmail: cleanText(body.contactEmail).toLowerCase(),
    industry: cleanText(body.industry),
    region: cleanText(body.region)
  };
}

module.exports = {
  normalizeCustomerInput
};
