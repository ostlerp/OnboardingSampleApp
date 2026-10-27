/**
 * Customer validation and the lists the Customer Info form offers
 */

const INDUSTRIES = ['Accounting', 'Financial Services', 'Manufacturing', 'Technology', 'Healthcare', 'Retail', 'Other'];
const REGIONS = ['North America', 'EMEA', 'APAC', 'LATAM'];

/**
 * Checks the required customer fields
 * @param {{name: string, contactEmail: string}} input - Normalized input
 * @returns {Object<string, string>} Error message per field, empty when valid
 */
function validateCustomerInput(input) {
  const errors = {};
  if (!input.name) {
    errors.name = 'Customer name is required';
  }
  if (!input.contactEmail) {
    errors.contactEmail = 'Contact email is required';
  }
  return errors;
}

module.exports = {
  INDUSTRIES,
  REGIONS,
  validateCustomerInput
};
