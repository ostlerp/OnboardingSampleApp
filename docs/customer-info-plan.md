# Customer Info: collect, validate and normalize

## Specification

CS needs to enter a new customer being onboarded, get the data validated and cleaned up when they save it, and see the customer appear in the onboarding queue with its first step complete.

### Acceptance Criteria

1. Submitting valid details on the Customer Info tab saves the customer. It then appears in the Dashboard queue without a page reload, with "Customer Info" completed and progress at 25%.
2. `POST /api/customers` with a valid body returns 201 and the stored, cleaned-up customer, with `id` and `createdAt` filled in by the server.
3. A missing or invalid field returns 400 with `errors` listing each failing field, and nothing is stored. The form shows each message next to its field.
4. A name that matches an existing customer once spaces and case are ignored returns 409 with an error on `name`.
5. Saved values are cleaned up:
   - the name has surrounding spaces trimmed and repeated spaces collapsed
   - the email is trimmed and lowercased
   - industry and region are matched to their standard spelling, ignoring case and accepting aliases
   - an unknown industry or region returns 400 listing the allowed values
6. `PUT /api/customers/:id` applies the same rules, except the duplicate check ignores the customer's own current name. It returns 404 for an unknown id, and the edits show on the Dashboard.
7. `GET /api/customers/options` returns the industry and region lists the form uses.
8. Seeded Acme, all existing endpoints and the existing unit and e2e tests keep working unchanged.

## Technical Plan

### Decisions

- **Step 1 completes when the customer is saved.** Saving a valid customer marks "Customer Info" complete, so the dashboard shows 25%. Rejected: a separate "Mark complete" button, which adds a click and no extra safety, since saving already requires valid data.
- **No tenant is created with the customer.** Tenants belong to the Tenant Setup step (step 3). The seeded Acme tenant stays as it is.
- **The server owns validation and the dropdown lists.** The industry and region lists come from `GET /api/customers/options`. The form only uses built-in browser checks (`required`, `type=email`) and shows the server's error for each field. Rejected: copying the validation rules into the client, which would let the two drift apart.
- **Unknown industry or region values are rejected.** Matching ignores case and accepts a small set of alias spellings (e.g. `"na"` becomes `North America`). Anything not in the list gets a 400 that names the allowed values. Rejected: silently accepting free text, which would put inconsistent values in the store.
- **Duplicate names return 409.** Two names count as the same after trimming, collapsing spaces and ignoring case. An update doesn't count as a duplicate of the customer's own current name.
- **Lists:** Industries: Accounting, Financial Services, Manufacturing, Technology, Healthcare, Retail, Other. Regions: North America, EMEA, APAC, LATAM. Seeded Acme ("Manufacturing", "North America") fits these lists as is.

### Architecture overview

This keeps the existing setup: Express storing data in memory, and React with Vite calling `/api` through a proxy. A new module, `server/src/customers/`, holds `normalize.js` and `validate.js`. Both are pure functions with no dependencies, written in the same style as `server/src/models/index.js`, and they hold the industry and region lists and the alias map. The `POST`/`PUT` routes chain them together: normalize, then validate, then check for duplicates against the store, then save. On create, the route also adds an onboarding state using `createDefaultOnboardingSteps()`, sets step 1 to `completed`, and calculates progress with the existing `calculateProgress`. `server/src/index.js` exports `app` and only starts listening when run directly (`require.main === module`), so tests can start the app themselves.

The client gets a `CustomerInfoTab` component, which replaces the placeholder. It loads the dropdown lists, shows a create form plus a selector for picking an existing customer to edit, and shows field errors from 400 and 409 responses. `App` changes its one-off fetch on mount into a `reloadOnboarding()` function, so the Dashboard updates after a save.

### Implementation approach

The first slice that works on its own is AC2 + AC1: the create route plus the form, with only the required-field checks. That alone lets CS add customers. Later slices add email and list validation (AC3, AC5), duplicate detection (AC4), editing (AC6), and the lists endpoint (AC7, which the dropdowns need, so in practice it lands with the form).

The store already has `addCustomer`, `addOnboardingState` and `updateOnboardingState`. A new `updateCustomer(id, patch)` is the only addition to the store. The ID becomes `cust_${Date.now()}_${random}`, because two customers created in the same millisecond would otherwise get the same ID. This is changed in `createCustomer` itself, which keeps the existing `startsWith('cust_')` test passing. The plan is one branch, with the slices as checkpoints.

Gotcha: the server test script's glob `src/**/*.test.js` isn't quoted, so the shell expands it and only matches files exactly one folder below `src/`. New tests must live at `src/customers/*.test.js`.

### Parallelization Analysis

- **Shared code surface:** `server/src/index.js` (all the routes) and `client/src/App.jsx`.
- **Ordering constraints:** normalize/validate module → routes → form; options endpoint → dropdowns.
- **Shared state:** the in-memory store's shape (one new function, `updateCustomer`).

**Opinion:** The server's normalize/validate functions and the client form's layout can be built in parallel. The routes are the critical path. For one developer in 8-minute sprints, building it in order is the realistic way.

### Performance analysis

None identified. There's a handful of customers in memory. The duplicate check scans the whole list, which is fine at this size. There are no queries, indexes or batch jobs involved.

### Observability & Alerting

None: this is a local workshop app with no deployment.

### Testing strategy

- `node:test` unit tests for normalize and validate: aliases, case handling, spaces, email format, and the error shape.
- In-process HTTP tests in `server/src/customers/routes.test.js`. They start `app` on port 0 and use Node 20's built-in `fetch`, so no new dependencies are needed. They cover 201, 400, 409 and 404, the onboarding state being created, and the duplicate check ignoring the customer's own name.
- Playwright tests for AC1: an invalid submit shows the field errors, a valid submit puts the card in the queue at 25%, and an edit shows on the card.
- The existing tests keep running unchanged, which covers AC8.

### Validation suite

The tests live in the repo: `server/src/customers/*.test.js` and `tests/e2e/customer-info.spec.js`. No mocks are needed.

```http
POST /api/customers
Host: localhost:3001
Content-Type: application/json

{ "name": "  ABC   Accounting ", "contactEmail": "Ops@ABC.example.com ", "industry": "accounting", "region": "na" }
```

→ `201 { "id": "cust_…", "name": "ABC Accounting", "contactEmail": "ops@abc.example.com", "industry": "Accounting", "region": "North America", … }`

```http
PUT /api/customers/cust_001
Host: localhost:3001
Content-Type: application/json

{ "name": "acme corporation", "contactEmail": "nope", "industry": "Mining", "region": "EMEA" }
```

→ `400 { "errors": { "contactEmail": "…", "industry": "Must be one of: …" } }`. The name is accepted because the duplicate check ignores Acme's own name.

### Key patterns to follow

- `server/src/models/index.js`: pure functions, JSDoc typedefs, CommonJS exports.
- `server/src/models/models.test.js`: `node:test` with `describe`/`it` and `node:assert`.
- `server/src/index.js`: route style and `{ error }` 404 bodies.
- `tests/e2e/dashboard.spec.js`: selectors like `.customer-card` and `getByRole`.

## Validation Plan

### Services to deploy

None. This is local only (`just start`).

### Mocks

None.

### Collections to run

- `just test-unit`: all `node:test` suites pass, including the new `server/src/customers/*.test.js`.
- `just test-e2e`: `dashboard.spec.js` and the new `customer-info.spec.js` pass.
