const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../mapping/csv');
const { suggestColumns } = require('../mapping/suggest');
const { runImport } = require('./import');

const SAMPLE_DIR = path.join(__dirname, '../../../sample-data');
const SAMPLE_CLIENT_FILES = [
  'CustomerA_ABCAccounting/clients.csv',
  'CustomerB_XYZFinancialServices/clients.csv',
  'CustomerC_PremierBookkeeping/clients.csv'
];

const CSV = [
  'Client ID,Client Name,Status,Annual Revenue',
  'C001,Riverside,Active,1000',
  'C002,,Active,2000',
  'C003,Downtown,Active,lots'
].join('\n');

describe('runImport', () => {
  it('should store valid rows and report invalid ones by file row', () => {
    const parsed = parseCsv(CSV);
    const { records, summary } = runImport(parsed, { columns: suggestColumns(parsed.headers) });

    assert.deepStrictEqual(records.map(record => record.externalId), ['C001']);
    assert.deepStrictEqual(summary, {
      imported: 1,
      updated: 0,
      failed: 2,
      errors: [
        { row: 3, messages: ['Name is required'] },
        { row: 4, messages: ['Annual revenue "lots" is not a number'] }
      ]
    });
  });

  it('should count records that already exist as updated', () => {
    const parsed = parseCsv(CSV);
    const { summary } = runImport(parsed, { columns: suggestColumns(parsed.headers) }, { C001: { externalId: 'C001' } });

    assert.strictEqual(summary.imported, 0);
    assert.strictEqual(summary.updated, 1);
  });

  for (const file of SAMPLE_CLIENT_FILES) {
    it(`should import every row of ${file} with its suggested mapping`, () => {
      const parsed = parseCsv(fs.readFileSync(path.join(SAMPLE_DIR, file), 'utf8'));
      const { records, summary } = runImport(parsed, { columns: suggestColumns(parsed.headers) });

      assert.deepStrictEqual(summary.errors, []);
      assert.strictEqual(summary.imported, parsed.rows.length);
      assert.strictEqual(records.length, parsed.rows.length);
    });
  }
});
