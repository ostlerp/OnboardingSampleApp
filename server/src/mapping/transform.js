const { CLIENT_FIELDS } = require('./targets');

/**
 * @param {string} raw - e.g. "2,500,000.00" or "£285000"
 * @returns {number} NaN when the value is not a number
 */
function parseAmount(raw) {
  const cleaned = raw.replace(/[,\s£$€]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

/**
 * Turns one source row into a platform client record using a column mapping
 * @param {Object<string, string>} values - Source values keyed by header
 * @param {Object<string, string|null>} columns - Source column per field key
 * @returns {{mapped: Object<string, string|number|null>, errors: string[]}}
 */
function transformRow(values, columns) {
  const mapped = {};
  const errors = [];

  CLIENT_FIELDS.forEach(field => {
    const column = columns[field.key];
    const raw = column ? (values[column] ?? '').trim() : '';

    if (!raw) {
      mapped[field.key] = null;
      if (field.required) errors.push(`${field.label} is required`);
      return;
    }

    if (field.key === 'annualRevenue') {
      const amount = parseAmount(raw);
      if (Number.isNaN(amount)) {
        mapped[field.key] = null;
        errors.push(`${field.label} "${raw}" is not a number`);
      } else {
        mapped[field.key] = amount;
      }
      return;
    }

    mapped[field.key] = raw;
  });

  return { mapped, errors };
}

module.exports = {
  transformRow
};
