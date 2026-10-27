# Tenant Setup: configure and provision

## Specification

CS sets up a customer's tenant (plan, subdomain and admin email), starts provisioning, and watches it until it's active. If provisioning fails, CS sees the reason and can retry. An active tenant completes onboarding step 3.

### Acceptance Criteria

1. On the Tenant Setup tab, CS picks a customer and sees its tenant's status and configuration. If the customer has no tenant yet, a new configuration is offered, with the subdomain suggested from the customer name, the admin email defaulting to the contact email, and the region copied from the customer.
2. `PUT /api/tenants/:customerId` creates or updates the configuration. The response is 400 with a message per field for an invalid plan, subdomain or email, 409 if the subdomain is taken, and 409 if the tenant is `provisioning` or `active`.
3. `POST /api/tenants/:customerId/provision` returns 202 with status `provisioning`. It returns 400 if the configuration is incomplete and 409 if the tenant is already `provisioning` or `active`.
4. While provisioning, the tab shows the status as "Provisioning…" and updates by itself, without a page reload, when the tenant becomes `active`.
5. When the tenant becomes active, "Tenant Setup" is marked complete on the Dashboard.
6. When provisioning fails, the tenant is `failed` with an error message. The tab shows the message and a Retry button, and the configuration can be edited again.
7. `GET /api/tenants/options` returns the list of plans.
8. Existing endpoints, the seed data (Acme's tenant stays `pending`) and the existing tests keep working. As in the other plans, the only test change allowed is scoping `tests/e2e/dashboard.spec.js`'s Acme assertions to Acme's card.

## Technical Plan

### Decisions

- **Provisioning is simulated, and it runs in the background.** `POST …/provision` sets the tenant to `provisioning`, returns 202, and a `provisioner.js` module moves it to `active` after `PROVISION_DELAY_MS` (default 2000). The provisioner can be swapped in tests, so they can force success or failure with no delay. Rejected: switching to `active` instantly, which wouldn't exercise the in-progress and failure states CS needs to handle.
- **What CS configures:** plan, subdomain and admin email. The subdomain is suggested from the customer name ("Acme Corporation" → `acme-corporation`), the admin email defaults to the customer's contact email, and the region is copied from the customer and isn't editable. Anything plan-specific beyond the plan name is out of scope.
- **Subdomain rules:** 3–30 characters of `a-z`, `0-9` and `-`, not starting or ending with `-`, unique across tenants (409 if taken), and not one of `admin`, `api`, `app`, `www`.
- **Allowed changes depend on status.** The configuration can be edited only while the tenant is `pending` or `failed`; otherwise 409. Provisioning can start only from `pending` or `failed`, and only with a complete configuration (400 if anything is missing); a tenant that is already `provisioning` or `active` returns 409. Retrying after a failure is just provisioning again.
- **Step 3 completes only when the tenant becomes `active`.** Steps don't have to be done in order, as in the Data Mapping plan.
- **The client polls `GET /api/tenants/:customerId` every second while the tenant is `provisioning`.** Rejected: SSE or WebSockets, which is more infrastructure than a status that changes once.
- **Failure can be simulated with `PROVISION_SIMULATE_FAILURE=true`**, so CS and the facilitator can demo the failure path. The failure UI is a manual check, because the e2e server is shared and reused between runs, so a test can't switch failure on just for itself.

### Architecture overview

This uses the same setup: Express storing data in memory, plus React. A new module, `server/src/tenants/`, contains:

- `options.js`: the plans and the reserved subdomains
- `config.js`: pure functions to suggest a subdomain, normalize the configuration and validate it
- `provisioner.js`: `provision(tenant, onDone)`, which uses `setTimeout(PROVISION_DELAY_MS)` and reads `PROVISION_SIMULATE_FAILURE`; routes receive it as a replaceable dependency

`createTenant` in `server/src/models/index.js` gains `subdomain`, `adminEmail`, `region`, `error` and `updatedAt`. All of them default to empty values, so Acme's seeded tenant stays valid.

The routes go in `server/src/index.js`. `GET /api/tenants/options` is registered before `GET /api/tenants/:customerId`, the same route-order trap as in the Customer Info plan. When provisioning finishes, a callback sets the tenant to `active` and step 3 to `completed` (using `updateOnboardingState` and `calculateProgress`), or sets it to `failed` with an error.

The client gets a `TenantSetupTab` component with the shared `CustomerSelect`, a configuration form, a status badge, a Provision/Retry button, and polling (a `setInterval` that stops when the status isn't `provisioning` and is cleaned up when the tab unmounts). It calls `reloadOnboarding()` when the tenant becomes active.

### Implementation approach

Slice 1 lets CS record tenant configurations, which is useful even before provisioning works. Slice 2 adds the main value: provisioning and the step completing. Slice 3 handles failure and retry. Because the provisioner can be swapped, route tests can check every status change without timers. The store already has `getTenantByCustomerId` and `addTenant`; it gains `updateTenant(customerId, patch)`. It's one branch, with the slices as checkpoints.

**Shared with the other plans** (`docs/customer-info-plan.md`, `docs/data-mapping-plan.md`): exporting `app`, `reloadOnboarding()` and `CustomerSelect`; whichever plan comes first adds them. The e2e test creates its own customer with `POST /api/customers`, so it needs Customer Info slice 1 to exist. Until then, its route tests still cover AC2–AC7.

Gotcha: the server test script's glob `src/**/*.test.js` isn't quoted, so the shell expands it and only matches files exactly one folder below `src/`. New tests must live at `src/tenants/*.test.js`.

### Parallelization Analysis

- **Shared code surface:** `server/src/index.js`, `server/src/data/store.js`, `server/src/models/index.js` and `client/src/App.jsx`, which the other plans also touch.
- **Ordering constraints:** `options.js` and `config.js` → PUT route → form; `provisioner.js` → provision route → polling UI. The e2e test needs Customer Info slice 1.
- **Shared state:** the store's `tenants` and `onboardingStates`; the env vars `PROVISION_DELAY_MS` and `PROVISION_SIMULATE_FAILURE`.

**Opinion:** `config.js` and `provisioner.js` can be built in parallel. Everything else follows in order. Build this after Customer Info slice 1 so the e2e test has a way to create customers.

### Performance analysis

None identified. There's one timer per provisioning run, and polling sends one request per second while one tab is provisioning. The uniqueness check scans a handful of tenants.

### Observability & Alerting

None: this is a local workshop app with no deployment.

### Testing strategy

- `node:test` unit tests for `config.js`: subdomain suggestions, the rules, reserved names and the error shape.
- In-process HTTP tests with a fake provisioner that finishes immediately with the outcome each test chooses. They cover every status change, every 400 and 409, step 3 completing only when the tenant becomes active, and retry after failure.
- One Playwright test for the happy path. It creates its own customer with a unique name via the API, configures and provisions the tenant, then waits up to 10 seconds for "Active" and checks that the card shows "Tenant Setup" completed. It never touches Acme.

### Validation suite

The tests live in the repo: `server/src/tenants/*.test.js` and `tests/e2e/tenant-setup.spec.js`. No mocks are needed.

```http
PUT /api/tenants/cust_001
Host: localhost:3001
Content-Type: application/json

{ "plan": "enterprise", "subdomain": "Acme Corp!", "adminEmail": "it@acme.example.com" }
```

→ `400 { "errors": { "subdomain": "Use 3–30 lowercase letters, numbers or hyphens" } }`

```http
POST /api/tenants/cust_123/provision
Host: localhost:3001
```

→ `202 { "status": "provisioning", … }`; then `GET /api/tenants/cust_123` → `{ "status": "active", … }`, and that customer's step 3 is `completed`.

### Key patterns to follow

- `server/src/models/index.js`: `createTenant`, and the status and plan values in the `Tenant` typedef.
- `server/src/data/store.js`: the tenant access functions.
- `server/src/index.js`: route style and the existing `GET /api/tenants/:customerId`.
- `docs/customer-info-plan.md`: the `options.js`, normalize and validate split, and the 400 error shape.

## Slices

Each slice is under ~400 lines including tests and leaves the app working. Estimates are rough.

### Slice 1: configure the tenant (~290 lines)

Covers AC1, AC2, AC7 and AC8. CS can record each customer's plan, subdomain and admin email, with the rules checked.

- `server/src/models/index.js`: new tenant fields with empty defaults.
- `server/src/tenants/options.js` and `config.js`: plans, reserved names, subdomain suggestion, normalize and validate.
- `server/src/data/store.js`: `updateTenant(customerId, patch)`.
- `server/src/index.js`: export `app` if not already done; `GET /api/tenants/options` (before `:customerId`); `PUT /api/tenants/:customerId` creating or updating the tenant, with 400 and 409.
- `client/src/App.jsx`: `TenantSetupTab` with `CustomerSelect` (add it if no other plan has), status badge, and the configuration form with suggested defaults.
- Tests: `config.test.js`; route tests for options, create, update, 400, duplicate subdomain 409 and status 409.

### Slice 2: provision and track (~300 lines)

Covers AC3, AC4 and AC5. CS can start provisioning, watch it become active, and step 3 completes.

- `server/src/tenants/provisioner.js`: timer-based provisioning with `PROVISION_DELAY_MS`, replaceable in tests.
- `POST /api/tenants/:customerId/provision`: 202, 400 for an incomplete configuration, 409 when already `provisioning` or `active`; on completion set `active`, step 3 `completed`, recalculate progress.
- Client: Provision button, polling while `provisioning`, `reloadOnboarding()` when active.
- Tests: route tests with a fake provisioner for each status change and step 3; `tests/e2e/tenant-setup.spec.js` happy path on its own customer (needs Customer Info slice 1).

### Slice 3: failure and retry (~200 lines)

Covers AC6. CS can see why provisioning failed and retry it.

- `provisioner.js`: `PROVISION_SIMULATE_FAILURE=true` fails with an error message.
- Store the error on the tenant; allow editing and provisioning again from `failed`; clear the error on retry.
- Client: show the error and a Retry button; re-enable the form when `failed`.
- Tests: route tests for failure, editing after failure and successful retry; the manual check below.

## Validation Plan

### Services to deploy

None. This is local only (`just start`).

### Mocks

None.

### Collections to run

- `just test-unit`: all `node:test` suites pass, including the new `server/src/tenants/*.test.js`.
- `just test-e2e`: the existing tests and the new `tenant-setup.spec.js` pass.

### Manual checks

#### Failure and retry in the UI

The route tests cover a successful retry; this check covers what CS sees when provisioning fails, which the shared e2e server can't trigger.

- **Given:** the server was started with `PROVISION_SIMULATE_FAILURE=true`, and a customer has a complete tenant configuration.
- **When:** CS clicks Provision and waits for it to finish, then clicks Retry.
- **Then:** the tab shows "Failed" with the error message and a Retry button, and the form can be edited. Retry goes back to "Provisioning…" and, with the flag still on, ends in "Failed" again.
