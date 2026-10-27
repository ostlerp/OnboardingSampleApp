const { transformRow } = require('../mapping/transform');

/**
 * Maps every row and splits them into records to store and row errors
 * @param {{rows: Object<string, string>[], lines: number[]}} parsed - Output of parseCsv
 * @param {{columns: Object<string, string|null>}} mapping - Saved mapping
 * @param {Object<string, Object>} existing - Records already imported, keyed by externalId
 * @returns {{records: Object[], summary: {imported: number, updated: number, failed: number, errors: {row: number, messages: string[]}[]}}}
 */
function runImport({ rows, lines }, mapping, existing = {}) {
  const records = [];
  const errors = [];
  let imported = 0;
  let updated = 0;

  rows.forEach((row, index) => {
    const { mapped, errors: messages } = transformRow(row, mapping.columns);
    if (messages.length > 0) {
      errors.push({ row: lines[index], messages });
      return;
    }
    records.push(mapped);
    if (existing[mapped.externalId]) {
      updated++;
    } else {
      imported++;
    }
  });

  return { records, summary: { imported, updated, failed: errors.length, errors } };
}

module.exports = {
  runImport
};
