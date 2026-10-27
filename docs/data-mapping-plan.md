# Data Mapping: clients file

## Specification

CS uploads a customer's clients file, sees which columns and values were mapped automatically, fixes the rest, previews the result, and saves the mapping. The Import step will then use it.

### Acceptance Criteria

1. On the Data Mapping tab, CS picks a customer and uploads a clients CSV. Each target field then shows a suggested source column, or "unmapped". CS can change any of these.
2. A file with too many fields in some rows still loads. The extra fields are merged into the last column, and a warning names the rows affected.
3. Each distinct status and entity-type value in the file shows with a suggested standard value, or "unmapped". CS can change any of these.
4. A suggested date format is shown, and CS can change it. Dates are previewed in ISO format, and a date that doesn't match the chosen format shows as a row error.
5. The preview shows the first 20 mapped rows with an error per row: a required field is empty, a date or number can't be read, or a value is unmapped.
6. Save is rejected with field-level errors while a required field or any status/entity-type value is unmapped. A successful save marks "Data Mapping" complete, and the dashboard progress reflects it (each completed step is 25%). Saving again doesn't change progress.
7. `GET /api/customers/:id/mapping` returns the saved mapping, and reopening the tab restores it.
8. The suggested mappings cover all three sample clients files with no unmapped required fields and no unmapped status or entity-type values.
9. Existing endpoints and the seed data keep working unchanged, and the existing tests keep passing. As in the Customer Info plan, the only test change allowed is scoping `tests/e2e/dashboard.spec.js`'s Acme assertions to Acme's card.

## Technical Plan

### Decisions

- **Clients file only, for now.** The client entity is the only one the sample README documents field by field. Contacts, chart of accounts and transactions reuse the same pieces later, each with its own target fields.
- **CS uploads the CSV in the UI.** The browser reads the file and posts its text. Rejected: reading `sample-data/` from disk, because real files arrive from customers. The JSON body limit goes up from Express's default 100 KB to 1 MB.
- **Rows with too many fields get their extra fields merged into the last column, with a warning.** This fixes all 12 rows of `CustomerB_XYZFinancialServices/clients.csv`, whose last column holds names like `Williams, Robert` with an unquoted comma. Rejected: a strict CSV parser, which would refuse the file. This rule would mis-merge `CustomerA_ABCAccounting/chart_of_accounts.csv` line 33 (the extra comma is in a middle column), so it gets revisited when that file is in scope.
- **Target client fields:** `externalId`, `name`, `entityType`, `status`, `startDate` (stored as ISO), `taxId`, `annualRevenue` (a number), `industry`, `paymentTerms`, `primaryContact`. Required: `externalId`, `name` and `status`.
- **Suggestions come from a built-in alias list taken from `sample-data/README.md`.** CS can override every suggestion. Rejected: fuzzy matching, which can guess wrong without anyone noticing.
- **Value rules:**
  - Status and entity type have standard values, and every source value must be mapped to one. Customer C's `Limited Company` maps to Corporation.
  - The date format is chosen per file, with a suggestion based on the data, and CS confirms it.
  - Revenue is read as a number.
  - The clients' industry and payment terms stay as free text. Values like `Veterinary` or `TECH` don't fit the Customer Info plan's industry list, which describes the customer being onboarded, not its clients.
- **Saving stores the mapping and the uploaded CSV in memory for that customer**, so the Import step doesn't need a second upload. A save with every required field and every value mapped marks step 2 complete. Steps don't have to be done in order, so Acme can complete step 2 before step 1.

### Architecture overview

This uses the same setup as the rest of the app: Express storing data in memory, plus React. A new module, `server/src/mapping/`, holds pure functions:

- `csv.js`: parsing, including the overflow merge
- `targets.js`: the client target fields, the required ones, and the standard status and entity-type values
- `suggest.js`: column and value suggestions from the alias list
- `dates.js`: suggesting a date format and converting dates to ISO
- `transform.js`: turning one source row and a mapping into `{ mapped, errors }`

The routes go in `server/src/index.js`:

- `POST /api/customers/:id/mapping/analyze`, which returns the headers, warnings, suggested columns, distinct values with suggestions, and the suggested date format
- `POST /api/customers/:id/mapping/preview`
- `PUT /api/customers/:id/mapping`
- `GET /api/customers/:id/mapping`

The store gets `mappings` keyed by customer id. A successful save sets step 2 to `completed` with `updateOnboardingState` and recalculates progress with `calculateProgress`.

The client gets a `DataMappingTab` component, which replaces the placeholder. It has a customer selector (`CustomerSelect`, shared with the Customer Info tab), a file input read with `FileReader`, a column-mapping table, a value-mapping table, a date-format selector, a preview table and a Save button. After a successful save it calls the same `reloadOnboarding()` the Customer Info plan adds.

### Implementation approach

All the mapping logic is pure functions, and the routes just chain them. That keeps the logic easy to test and lets Contacts, chart of accounts and transactions reuse it by adding their own target fields. The first slice delivers the most useful part early: upload a file and see the suggested column mapping. The analyze response returns the distinct values, so the preview doesn't have to re-parse the whole file. The preview is capped at 20 rows. It's one branch, with the slices as checkpoints.

**Shared with the Customer Info plan** (`docs/customer-info-plan.md`): exporting `app` from `index.js` (so routes can be tested in-process), `reloadOnboarding()` in `App.jsx`, and the `CustomerSelect` component. Whichever plan is built first adds them.

Gotcha: the server test script's glob `src/**/*.test.js` isn't quoted, so the shell expands it and only matches files exactly one folder below `src/`. New tests must live at `src/mapping/*.test.js`.

### Parallelization Analysis

- **Shared code surface:** `server/src/index.js` (the routes), `server/src/data/store.js` and `client/src/App.jsx`. The Customer Info plan touches all three too.
- **Ordering constraints:** `csv.js` and `targets.js` → `suggest.js` → analyze route → column-mapping UI; `transform.js` → preview → save.
- **Shared state:** the store gains `mappings`, and both plans write `onboardingStates`.

**Opinion:** The pure modules (`csv.js`, `dates.js`, `suggest.js`) can be built in parallel. The routes and UI follow in order. Building this alongside Customer Info is possible but will cause merge conflicts in `index.js` and `App.jsx`. Building them one after the other is cleaner.

### Performance analysis

None identified. Files are 10 to 40 rows. Parsing is one linear pass, the preview is capped at 20 rows, and the 1 MB body limit caps how much can be uploaded.

### Observability & Alerting

None: this is a local workshop app with no deployment.

### Testing strategy

- `node:test` unit tests for each pure module. These include the overflow merge, using Customer B's actual first row, and an AC8 test that runs `suggest` on the three sample clients files read from `sample-data/`.
- In-process HTTP tests for analyze, preview, save (400 vs 200, and the step 2 transition) and GET.
- One Playwright test that picks Acme, uploads `sample-data/CustomerB_XYZFinancialServices/clients.csv`, saves, and checks that Acme's card shows "Data Mapping" completed. It doesn't assert a progress number, because other tests and earlier local runs share the same in-memory server. No other test asserts Acme's step 2, so this is safe to run in parallel.

### Validation suite

The tests live in the repo: `server/src/mapping/*.test.js` and `tests/e2e/data-mapping.spec.js`. No mocks are needed.

```http
POST /api/customers/cust_001/mapping/analyze
Host: localhost:3001
Content-Type: application/json

{ "entity": "clients", "csv": "clientCode,companyName,...\nXYZ-001,Apex Digital Marketing,CORP,A,2023-02-10,...,Williams, Robert" }
```

→ `200 { "headers": [...], "warnings": ["Row 2: 11 fields for 10 columns; extras merged into mainContact"], "columns": { "externalId": "clientCode", "name": "companyName", ... }, "values": { "status": { "A": "Active", ... }, "entityType": { "CORP": "Corporation", ... } }, "dateFormat": "YYYY-MM-DD" }`

```http
PUT /api/customers/cust_001/mapping
Host: localhost:3001
Content-Type: application/json

{ "entity": "clients", "csv": "...", "columns": { "externalId": null, ... }, "values": { ... }, "dateFormat": "YYYY-MM-DD" }
```

→ `400 { "errors": { "columns.externalId": "Required field is unmapped" } }`. With `externalId` mapped, it returns `200` and Acme's step 2 is `completed`.

### Key patterns to follow

- `server/src/models/index.js`: pure functions, JSDoc typedefs, CommonJS exports.
- `server/src/models/models.test.js`: `node:test` with `describe`/`it` and `node:assert`.
- `server/src/data/store.js`: the store's access functions.
- `sample-data/README.md`: the source for the alias list and value maps.

## Slices

Each slice is under ~400 lines including tests and leaves the app working. Estimates are rough.

### Slice 1: upload and suggested column mapping (~330 lines)

Covers AC1, AC2, and the column part of AC8. CS can upload a file and immediately see which columns map automatically, and which don't.

- `server/src/mapping/csv.js`: parse, with the overflow merge and warnings.
- `server/src/mapping/targets.js`: client target fields and the required ones.
- `server/src/mapping/suggest.js`: column suggestions from the alias list.
- `server/src/index.js`: export `app` if not already done; raise the JSON limit to 1 MB; add `POST /api/customers/:id/mapping/analyze` (columns and warnings only).
- `client/src/App.jsx`: `DataMappingTab` with `CustomerSelect` (add it if Customer Info hasn't), file input and a column-mapping table with override dropdowns.
- Tests: `csv.test.js` (including Customer B's first row), `suggest.test.js` (all three sample files' required columns), a route test for analyze, and an e2e test that uploads the Customer B file and sees the suggestions.

### Slice 2: save the mapping and complete the step (~220 lines)

Covers AC6 (column rules only), AC7 and AC9. The mapping is saved and step 2's progress moves.

- `server/src/data/store.js`: `mappings` keyed by customer id, with get and save functions.
- `PUT /api/customers/:id/mapping`: 400 while a required field is unmapped; on success, store the mapping and CSV, set step 2 `completed` and recalculate progress.
- `GET /api/customers/:id/mapping`.
- Client: Save button, field errors from a 400, restore a saved mapping when the tab opens, call `reloadOnboarding()` after saving.
- Tests: route tests for 400, 200, the step 2 transition and GET; extend the e2e test to save and check that Acme's card shows "Data Mapping" completed.

### Slice 3: map values, dates and numbers (~380 lines)

Covers AC3, AC4, and the rest of AC6 and AC8. Status and entity-type values and date formats are mapped and checked.

- `server/src/mapping/targets.js`: standard status and entity-type values.
- `server/src/mapping/suggest.js`: value suggestions from the alias list.
- `server/src/mapping/dates.js`: suggest a format from the data, convert to ISO.
- Analyze returns the distinct values with suggestions and the suggested date format; save rejects unmapped status or entity-type values.
- Client: value-mapping table per picklist column and a date-format selector.
- Tests: `dates.test.js`, value suggestions for all three sample files, route tests for unmapped values on save, and an e2e check that the value table is filled in.

### Slice 4: preview with row errors (~250 lines)

Covers AC5. CS sees the result and which rows have problems before saving.

- `server/src/mapping/transform.js`: one row plus a mapping → `{ mapped, errors }` (empty required field, unreadable date or number, unmapped value).
- `POST /api/customers/:id/mapping/preview`: the first 20 rows.
- Client: preview table with each row's errors, refreshed when the mapping changes.
- Tests: `transform.test.js`, a route test for preview, and an e2e test that a wrong date format shows row errors.

## Validation Plan

### Services to deploy

None. This is local only (`just start`).

### Mocks

None.

### Collections to run

- `just test-unit`: all `node:test` suites pass, including the new `server/src/mapping/*.test.js`.
- `just test-e2e`: the existing e2e tests and the new `data-mapping.spec.js` pass.
