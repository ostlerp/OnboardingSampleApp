const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('./csv');
const { suggestColumns } = require('./suggest');

const SAMPLE_DIR = path.join(__dirname, '..', '..', '..', 'sample-data');
const SAMPLE_FOLDERS = ['CustomerA_ABCAccounting', 'CustomerB_XYZFinancialServices', 'CustomerC_PremierBookkeeping'];

describe('suggestColumns', () => {
  for (const folder of SAMPLE_FOLDERS) {
    it(`maps every client field for ${folder}`, () => {
      const text = fs.readFileSync(path.join(SAMPLE_DIR, folder, 'clients.csv'), 'utf8');
      const columns = suggestColumns(parseCsv(text).headers);

      for (const [key, column] of Object.entries(columns)) {
        assert.ok(column, `${key} is unmapped`);
      }
    });
  }

  it('should leave a field unmapped when no column matches its aliases', () => {
    const columns = suggestColumns(['Client ID', 'Something Else']);

    assert.strictEqual(columns.externalId, 'Client ID');
    assert.strictEqual(columns.name, null);
  });
});
