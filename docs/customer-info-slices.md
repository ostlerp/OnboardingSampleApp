# Customer Info: slices

The full plan, acceptance criteria (AC1–AC8) and technical decisions are in [customer-info-plan.md](customer-info-plan.md). This file records how the work is cut into slices, and what each one covers.

Each slice ships on its own and leaves the app working. Later slices build on the earlier ones.

## Slice 1: create a customer from the form (AC2 + AC1, plus the lists for AC7)

**Status:** in this PR.

**What it does**

- `POST /api/customers` trims and collapses spaces in the name, and trims and lowercases the email. It returns `400` with `errors` when the name or email is missing, and stores nothing in that case. A valid body returns `201` with the stored customer.
- Saving a customer also creates its onboarding state, with "Customer Info" marked complete, so the queue shows 25%.
- `GET /api/customers/options` returns the industry and region lists.
- The Customer Info tab is a form. Industry and region are dropdowns fed by the options endpoint. Name and email carry the browser's `required` check. Server errors show next to their field.
- Saving refreshes the Dashboard queue, so the new customer shows without a page reload.
- Customer IDs are now unique within the same millisecond (`cust_<time>_<random>`).
- `server/src/index.js` exports the app and only listens when run directly, so the route tests can start it on a free port.

**Not in this slice**

- Email format checks, and rejecting industry or region values outside the lists (AC3, AC5).
- Aliases such as `"na"` for `North America` (AC5).
- Duplicate detection (AC4).
- Editing an existing customer (AC6).

**Tests**

- `server/src/customers/normalize.test.js`, `validate.test.js`: the cleaning and required-field rules.
- `server/src/customers/routes.test.js`: `201`, `400` with nothing stored, the onboarding state at 25%, and the options endpoint.
- `tests/e2e/customer-info.spec.js`: the happy path only, creating a customer from the form and seeing it in the queue at 25%. The field-error e2e test from the plan moves to slice 2, because the browser's `required` check stops empty submits before the server sees them.
- `tests/e2e/dashboard.spec.js`: the "switch between tabs" test now checks for the form heading, because the Customer Info placeholder is gone.

## Slice 2: validate email and list values (AC3 + AC5)

- Reject malformed emails with `400`.
- Match industry and region ignoring case, and accept the alias spellings from the plan (e.g. `"na"` for `North America`). Add the alias map alongside the lists in `server/src/customers/validate.js`. Unknown values return `400` and list the allowed values.
- The form shows each server message next to its field.
- Playwright: an invalid submit shows the server's message next to each field. This is the plan's field-error test, which slice 1 leaves out.
- The plan's example request, which sends `"accounting"` and `"na"`, is stored as typed in slice 1 and normalized from this slice on.

## Slice 3: duplicate names (AC4)

- Treat two names as the same when spaces, case and surrounding whitespace are ignored. Return `409` with an error on `name`.

## Slice 4: edit a customer (AC6)

- `PUT /api/customers/:id` applies the same rules. The duplicate check ignores the customer's own current name. Unknown IDs return `404`.
- Add `updateCustomer(id, patch)` to the store. It is the only store addition the plan calls for.
- The Customer Info tab gets a selector for choosing an existing customer to edit. Edits show on the Dashboard. The plan's edit test (an edit shows on the card) lands here.

## Slice 5: regression check (AC8)

- Confirm the seeded Acme customer, the existing endpoints, and the existing unit and e2e tests still behave as before. The only intended change to an existing test is the Customer Info tab check in slice 1.

## Verifying slice 1 by hand

```bash
just start
```

```bash
curl -s http://localhost:3001/api/customers/options
```

```bash
curl -s -X POST http://localhost:3001/api/customers -H "Content-Type: application/json" -d '{"name":"  ABC   Accounting ","contactEmail":"Ops@ABC.example.com ","industry":"Accounting","region":"EMEA"}'
```

Expected: `201` with `"name":"ABC Accounting"` and `"contactEmail":"ops@abc.example.com"`.

```bash
curl -s -X POST http://localhost:3001/api/customers -H "Content-Type: application/json" -d '{"name":"   ","contactEmail":""}'
```

Expected: `400` with an `errors` object naming both fields.
