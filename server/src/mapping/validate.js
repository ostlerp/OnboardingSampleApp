const { CLIENT_FIELDS } = require('./targets');

/**
 * Checks a column mapping against the file's headers
 * @param {Object<string, string|null>} columns - Source column per field key
 * @param {string[]} headers
 * @returns {Object<string, string>} Error message per `columns.<field>`, empty when valid
 */
function validateColumns(columns, headers) {
  const errors = {};
  const mapping = columns && typeof columns === 'object' ? columns : {};

  CLIENT_FIELDS.forEach(field => {
    const column = mapping[field.key] || null;
    if (column && !headers.includes(column)) {
      errors[`columns.${field.key}`] = `Column "${column}" is not in the file`;
    } else if (!column && field.required) {
      errors[`columns.${field.key}`] = 'Required field is unmapped';
    }
  });

  return errors;
}

/**
 * Keeps only known field keys, with unmapped fields as null
 * @param {Object<string, string|null>} columns
 * @returns {Object<string, string|null>}
 */
function pickColumns(columns = {}) {
  return Object.fromEntries(CLIENT_FIELDS.map(field => [field.key, columns[field.key] || null]));
}

module.exports = {
  validateColumns,
  pickColumns
};
