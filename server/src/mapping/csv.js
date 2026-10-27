/**
 * CSV parsing for customer files. Quotes group a comma into one field.
 * Quote characters are dropped, so embedded quotes are not supported.
 */

/**
 * Splits one CSV line into raw fields, keeping their spaces
 * @param {string} line
 * @returns {string[]}
 */
function splitLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parses CSV text into headers and rows. A row with more fields than headers
 * has its extra fields merged into the last column, and a warning is added.
 * @param {string} text
 * @returns {{headers: string[], rows: Object<string, string>[], lines: number[], warnings: string[]}} lines[i] is the file line of rows[i]
 */
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(entry => entry.line.trim() !== '');
  if (lines.length === 0) {
    return { headers: [], rows: [], lines: [], warnings: [] };
  }

  const headers = splitLine(lines[0].line).map(header => header.trim());
  const rows = [];
  const rowLines = [];
  const warnings = [];

  for (const { line, number } of lines.slice(1)) {
    let fields = splitLine(line);
    if (fields.length > headers.length) {
      const last = headers[headers.length - 1];
      warnings.push(`Row ${number}: ${fields.length} fields for ${headers.length} columns; extras merged into ${last}`);
      fields = [...fields.slice(0, headers.length - 1), fields.slice(headers.length - 1).join(',')];
    }
    rows.push(Object.fromEntries(headers.map((header, i) => [header, (fields[i] ?? '').trim()])));
    rowLines.push(number);
  }

  return { headers, rows, lines: rowLines, warnings };
}

module.exports = {
  parseCsv
};
