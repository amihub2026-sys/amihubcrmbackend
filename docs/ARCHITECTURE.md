# Backend architecture

A layered, single-company modular application. Each resource has named model, controller, service and route files. Shared rules avoid inconsistent authorization or accounting implementations.

| Directory / file          | Responsibility                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/app.js`              | Express security middleware and router mounting                         |
| `src/server.js`           | Database startup, listener, shutdown                                    |
| `src/config/`             | Environment, database, cookies, logging, frontend field/status contract |
| `src/models/`             | 29 explicit Mongoose models, base metadata and infrastructure models    |
| `src/modules/<resource>/` | Named route, controller and service for each resource                   |
| `src/routes/`             | Authentication, health and business-action routing                      |
| `src/controllers/`        | HTTP adapters for authentication and business actions                   |
| `src/services/`           | Shared record operations and dedicated business services                |
| `src/validators/`         | Incoming field/type/date/status validation                              |
| `src/middleware/`         | Authentication, CSRF, permissions, limits, errors                       |
| `src/jobs/worker.js`      | Reminders, aging, optional recurring invoices                           |
| `src/utils/`              | Password hashing, money/date helpers, errors                            |
| `scripts/`                | Owner provisioning and syntax checks                                    |
| `test/`                   | Unit, HTTP routing and MongoDB integration tests                        |
| `docs/`                   | API, architecture, verification and proxy example                       |

## Example: leads

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `src/modules/leads/leads.routes.js`       | Maps list/create/update/delete endpoints         |
| `src/modules/leads/leads.controller.js`   | Reads requests and sends responses               |
| `src/modules/leads/leads.service.js`      | Leads entry point into guarded record operations |
| `src/models/leads.model.js`               | Persisted lead fields and indexes                |
| `src/controllers/leads.controller.js`     | Lead conversion HTTP action                      |
| `src/services/lead-conversion.service.js` | Transactional Won lead → customer conversion     |

The same resource structure exists for customers, projects, tasks, invoices, payments, employees and the other resources.

## Dedicated services

| Service                      | Rules owned                                               |
| ---------------------------- | --------------------------------------------------------- |
| `auth.service.js`            | Credentials, sessions, password changes, login attendance |
| `record.service.js`          | CRUD, validation, linkage, retention, revisions           |
| `query.service.js`           | Authorized record lookup                                  |
| `context.service.js`         | Account recheck within transactions and audit entries     |
| `billing.service.js`         | Balance calculation and recurring-cycle invoices          |
| `lead-conversion.service.js` | Once-per-lead customer conversion                         |
| `attendance.service.js`      | Developer check-out                                       |
| `workspace.service.js`       | Permission-filtered bootstrap                             |
| `notification.service.js`    | Current user's inbox and read state                       |
| `rate-limit.service.js`      | Database-backed request limits                            |

Controllers do not calculate totals. Feature services share the guarded record engine; business actions use dedicated services. Models define storage, validators define accepted input, and middleware establishes authentication. Routes connect paths and controllers.

## MongoDB setup

Set your MongoDB URI, database name and database-user credentials in `.env`. The backend creates collections and indexes at startup. Atlas or a replica set is required. You do not need to create each collection manually.

Run `npm run setup:owner` to create your login, then `npm run dev`. No default password is provided. The production host also needs its HTTPS origin configured.

## Readiness

Structure alone does not prove production readiness. See `VERIFICATION.md` for passed checks and the blocked MongoDB integration gate. Real database tests, HTTPS, backups and business acceptance remain necessary. Binary uploads, external messaging providers, credit notes/refunds, MFA and payroll are outside this implementation.
