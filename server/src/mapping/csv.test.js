const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('./csv');

const CUSTOMER_B_CLIENTS = path.join(__dirname, '..', '..', '..', 'sample-data', 'CustomerB_XYZFinancialServices', 'clients.csv');

describe('parseCsv', () => {
  it('should read headers and rows', () => {
    const { headers, rows, warnings } = parseCsv('a,b\n1,2');

    assert.deepStrictEqual(headers, ['a', 'b']);
    assert.deepStrictEqual(rows, [{ a: '1', b: '2' }]);
    assert.deepStrictEqual(warnings, []);
  });

  it('should merge extra fields into the last column and warn with the row number', () => {
    const text = fs.readFileSync(CUSTOMER_B_CLIENTS, 'utf8');
    const { headers, rows, warnings } = parseCsv(text);

    assert.strictEqual(rows[0].mainContact, 'Williams, Robert');
    assert.strictEqual(headers.length, 10);
    assert.strictEqual(warnings[0], 'Row 2: 11 fields for 10 columns; extras merged into mainContact');
  });

  it('should trim values and pad short rows with empty strings', () => {
    const { rows } = parseCsv('a,b,c\n 1 ,2');

    assert.deepStrictEqual(rows[0], { a: '1', b: '2', c: '' });
  });

  it('should skip blank lines', () => {
    const { rows } = parseCsv('a,b\n\n1,2\n\n3,4\n');

    assert.strictEqual(rows.length, 2);
  });

  it('should report the file line of each row, counting skipped blank lines', () => {
    const { lines } = parseCsv('a,b\n\n1,2\n\n3,4\n');

    assert.deepStrictEqual(lines, [3, 5]);
  });

  it('should keep a comma inside quotes in one field', () => {
    const { rows, warnings } = parseCsv('a,b\n"x, y",2');

    assert.strictEqual(rows[0].a, 'x, y');
    assert.deepStrictEqual(warnings, []);
  });
});
