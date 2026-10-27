# Import: clients into the tenant

## Specification

CS imports a customer's clients into its tenant using the saved mapping, sees how many rows were imported, updated or failed, and why each failure happened. CS can fix the data and import again without creating duplicates. A clean import completes onboarding.

### Acceptance Criteria

1. On the Import tab, CS picks a customer and sees whether it's ready: a saved mapping and an active tenant. If either is missing, the Import button is disabled and the tab says which one.
2. `POST /api/customers/:id/import` returns 409 listing what's missing when there's no saved mapping or the tenant isn't active.
3. A successful import returns `{ imported, updated, failed, errors: [{ row, messages }] }`. Valid rows are stored on the tenant and invalid rows aren't.
4. Importing the same file again updates existing records by `externalId` and creates no duplicates. A repeated `externalId` within the file is a row error.
5. `{ "dryRun": true }` returns the same summary and stores nothing.
6. When every row imports, "Import" is marked complete on the Dashboard, so a customer that has finished all four steps shows 100%. When any row fails, the step shows as in progress.
7. `GET /api/customers/:id/import` returns the last result, and `GET /api/tenants/:customerId/clients` returns the imported records. The tab shows both.
8. Importing each of the three sample clients files with its suggested mapping imports every row with no errors.
9. Existing endpoints, the seed data and the existing tests keep working, with the same `dashboard.spec.js` scoping as in the other plans.

## Technical Plan

### Decisions

- **Import needs a saved mapping and an active tenant.** Otherwise it returns 409 listing what's missing. Rejected: importing without these, because a mapping is what defines the data and an active tenant is where it goes. The "steps can be done in any order" rule from the other plans covers steps 1–3; step 4 really does need steps 2 and 3 first.
- **"The platform" is simulated in memory.** Imported client records are stored per tenant, and `GET /api/tenants/:customerId/clients` lists them.
- **Valid rows are imported and invalid ones are reported.** Rejected: all-or-nothing, which makes CS wait on every bad row before the customer gets anything. Step 4 becomes `completed` only when every row imports; any failed row leaves it `in_progress` until CS fixes the data and imports again.
- **Re-importing updates records rather than duplicating them.** Records are matched by `externalId`, so importing again is safe and always uses the latest saved mapping. A repeated `externalId` within one file is a row error.
- **Import runs immediately.** Files have 10–40 rows, so it finishes within the request and returns a summary. Rejected: running it in the background like provisioning, which adds polling for no benefit at this size.
- **It reuses Data Mapping's `transform.js`.** If Data Mapping slice 4 isn't built yet, this plan's first slice adds it.
- **A dry run is offered.** `{ "dryRun": true }` checks every row and returns the same summary without saving anything. The mapping preview only checks the first 20 rows.
- **The last import result is kept per customer**, so CS can see it again after reopening the tab.

### Architecture overview

This uses the same setup: Express storing data in memory, plus React. A new module, `server/src/import/import.js`, holds one pure function, `runImport(rows, mapping, existingByExternalId)`. It runs each row through `transform.js`, finds repeated IDs within the file, and returns `{ records, summary }`. The store gains `importedClients` (keyed by tenant id, then `externalId`) and `imports` (the last result per customer).

The routes go in `server/src/index.js`:

- `POST /api/customers/:id/import` checks readiness, parses the saved CSV with Data Mapping's `csv.js`, calls `runImport`, and saves the result unless it's a dry run. It then sets step 4 to `completed` or `in_progress` and recalculates progress with `calculateProgress`.
- `GET /api/customers/:id/import` returns the last result.
- `GET /api/tenants/:customerId/clients` returns the imported records.

The client gets an `ImportTab` component with the shared `CustomerSelect`, a readiness checklist, "Check all rows" and "Import" buttons, a summary with a table of row errors, and a table of imported clients. It calls `reloadOnboarding()` after an import.

### Implementation approach

Slice 1 delivers the main value: import a clean file into an active tenant, and onboarding completes. Slice 2 adds re-importing and error reporting, which matter when a file is messy. Slice 3 adds the dry run and showing past results. Most of the logic is in `runImport`, a pure function, so the route tests only need to cover readiness and storage. It's one branch, with the slices as checkpoints.

**Depends on:** Data Mapping slices 1–2 (`csv.js` and the saved mapping) and Tenant Setup slice 2 (active tenants). Without those, nothing can be ready to import, so build this plan last. If Data Mapping slice 4 hasn't added `transform.js` yet, this plan's slice 1 adds it.

Gotcha: the server test script's glob `src/**/*.test.js` isn't quoted, so the shell expands it and only matches files exactly one folder below `src/`. New tests must live at `src/import/*.test.js`.

### Parallelization Analysis

- **Shared code surface:** `server/src/index.js`, `server/src/data/store.js`, `client/src/App.jsx`, and Data Mapping's `server/src/mapping/transform.js`.
- **Ordering constraints:** Data Mapping slices 1–2 and Tenant Setup slice 2 → this plan; `runImport` → import route → `ImportTab`.
- **Shared state:** the store's `onboardingStates` (step 4), `tenants` (read only), and the saved `mappings` (read only).

**Opinion:** This is the last step and depends on two other plans. Within it, `runImport` and the tab layout can be built in parallel; the rest is in order.

### Performance analysis

None identified. A file has 10–40 rows, so the import is one linear pass inside the request, and records are looked up by `externalId`.

### Observability & Alerting

None: this is a local workshop app with no deployment.

### Testing strategy

- `node:test` unit tests for `runImport`: all valid, mixed valid and invalid, a repeated ID within the file, and updating existing records.
- An AC8 test that runs each sample clients file through `suggest` and then `runImport`, and expects no errors.
- In-process HTTP tests that set up a mapping and an active tenant directly in the store. They cover 409 when not ready, the summary, dry run storing nothing, re-importing creating no duplicates, step 4 being `completed` vs `in_progress`, and both GET routes.
- One Playwright test for the full flow on its own customer, using the other plans' APIs: create the customer, save a mapping for `sample-data/CustomerA_ABCAccounting/clients.csv`, configure and provision the tenant, then import from the Import tab. It expects 10 rows imported and the card at 100%.

### Validation suite

The tests live in the repo: `server/src/import/*.test.js` and `tests/e2e/import.spec.js`. No mocks are needed.

```http
POST /api/customers/cust_123/import
Host: localhost:3001
Content-Type: application/json

{ "dryRun": false }
```

→ `200 { "imported": 10, "updated": 0, "failed": 0, "errors": [] }`. Running it again returns `{ "imported": 0, "updated": 10, … }`.

```http
POST /api/customers/cust_001/import
Host: localhost:3001
```

→ `409 { "error": "Not ready to import", "missing": ["mapping", "activeTenant"] }` (seeded Acme has no saved mapping and a `pending` tenant).

### Key patterns to follow

- `docs/data-mapping-plan.md`: `csv.js`, `transform.js` and the saved mapping's shape.
- `docs/tenant-provisioning-plan.md`: tenant statuses and `updateTenant`.
- `server/src/models/index.js`: `calculateProgress` and the step statuses `pending | in_progress | completed | failed`.
- `server/src/data/store.js`: the store's access functions.

## Slices

Each slice is under ~400 lines including tests and leaves the app working. Estimates are rough.

### Slice 1: import a clean file (~360 lines)

Covers AC1, AC2, AC3, AC6, AC8 and AC9. CS can import the customer's clients into the tenant, and onboarding completes.

- `server/src/mapping/transform.js` if Data Mapping slice 4 hasn't added it.
- `server/src/import/import.js`: `runImport` for new records.
- `server/src/data/store.js`: `importedClients` and `imports`.
- `POST /api/customers/:id/import`: readiness 409, import, step 4 update.
- Client: `ImportTab` with `CustomerSelect`, readiness checklist, Import button, summary, `reloadOnboarding()`.
- Tests: `import.test.js` (including AC8 on the sample files), route tests for 409, summary and step 4; `tests/e2e/import.spec.js` full flow.

### Slice 2: re-import and row errors (~250 lines)

Covers AC4, and the rest of AC3 and AC6. CS can fix bad rows and import again with no duplicates, with each failure explained.

- `runImport`: update existing records by `externalId`; repeated IDs within the file are row errors; failed rows reported with messages.
- Step 4 `in_progress` when any row fails.
- Client: table of row errors.
- Tests: unit tests for updates, repeated IDs and mixed files; route tests for re-import and `in_progress`.

### Slice 3: dry run and history (~220 lines)

Covers AC5 and AC7. CS can check all rows before importing, and see the last result and the imported clients.

- `POST …/import` with `dryRun`; `GET /api/customers/:id/import`; `GET /api/tenants/:customerId/clients`.
- Client: "Check all rows" button, last result shown when the tab opens, imported clients table.
- Tests: route tests for dry run storing nothing and both GET routes.

## Validation Plan

### Services to deploy

None. This is local only (`just start`).

### Mocks

None.

### Collections to run

- `just test-unit`: all `node:test` suites pass, including the new `server/src/import/*.test.js`.
- `just test-e2e`: the existing tests and the new `import.spec.js` pass.
