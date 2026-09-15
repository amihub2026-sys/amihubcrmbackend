# AMI HUB CRM — Layered Node.js / Express / MongoDB backend

Backend implementation matched to the supplied Angular frontend (29 resources). JavaScript ESM, Node.js 24, Express 5, Mongoose 9. This is a single-company CRM, not a multi-tenant SaaS.

**Release state: implementation delivered; live database integration and deployment acceptance are still required. Do not treat this package as a certified “100% production-ready” deployment.** See `docs/VERIFICATION.md` for exactly what ran and what was blocked.

## Start locally (Windows PowerShell)

1. Install Node.js 24. Check `node -v` and `npm -v`.
2. Open this backend folder in VS Code and open its terminal.
3. Run:

```powershell
npm ci
Copy-Item .env.example .env
```

4. Open `.env`. Set `MONGODB_URI` to your Atlas connection URI with database name `amihub_crm`. Set the database user's password in the URI, URL-encoding special characters. Do not share or commit `.env`. Keep `APP_ORIGINS=http://localhost:4200` for development.
5. Use an Atlas database user restricted to this CRM database and allow your current development IP. A standalone local MongoDB server cannot run the required transactions; Atlas or a replica set is required. No live database or credentials are included.
6. Create your first Owner account:

```powershell
npm run setup:owner
```

Enter your own name, email and a password of 12–128 characters. The password is hidden. There is no default/demo production account, public registration or hard-coded credential. This command refuses to create another Owner once an Owner exists.

7. Start the API:

```powershell
npm run dev
```

Readiness: `http://localhost:5000/api/health/ready`.

8. In a second terminal open your existing, separate Angular frontend folder:

```powershell
npm ci
npm start
```

Open `http://localhost:4200` and sign in with your Owner account. Use normal `npm start`; `preview:ui` is explicitly a sample-data mode and does not authenticate with the backend. Your supplied Angular proxy forwards `/api` to port 5000. Keep the frontend API URL `/api`.

## First records

1. Settings → Billing profile: enter your legal business name/address and payment instructions.
2. HR → Employees: create real employees. Save each employee before creating a login.
3. Settings → User access: name, email, role, linked employee and initial password. Staff accounts require an employee link. Give each person their own account.
4. Create customers/leads, then projects and assigned tasks.
5. Accounts → Invoices: enter customer, number, dates and amounts/line items. Save Draft while editing; change to Sent when issued.
6. Accounts → Payments: select an issued invoice and enter the actual received amount. A payment promise is a separate record and never increases receipts.

## Implemented behavior

- Server-managed opaque sessions stored in MongoDB; only hashed session tokens in the database. HttpOnly session cookie, Secure in production, SameSite=Lax. Sessions expire after 12 hours. Current role/account status is checked on each request.
- Passwords hashed using Node scrypt with a random salt. User role, password and status changes revoke existing sessions. Owner protection prevents disabling/demoting the last active Owner; users cannot disable or change their own role.
- Trusted Origin check on writes; session-bound Angular XSRF token on authenticated writes. No cross-origin CORS setup is needed: serve Angular and `/api` at the same origin.
- Database-backed request/login limits shared between API instances, body-size limit, safe response errors, security headers, request IDs, logs without passwords, cookies, bodies or connection strings.
- Server-side grants match frontend roles. Assigned-work access uses employee/user IDs, never display names. Project budgets are redacted from delivery staff and HR responses.
- Schema-derived field/status allowlists, typed validation, date/URL checks, references and linked-customer consistency. Parent business links are immutable after creation to avoid inconsistent children; deactivate/recreate when appropriate.
- Revision checking for edits/deletes; referenced records cannot be deleted. Financial, user and HR records are retained instead of deleted. Audit history has no edit/delete API.
- Invoice and quotation totals are calculated by the server. Money is checked at two decimal places and calculated as integer paise; quantity supports three decimals. Tax is an explicit supplied amount, not a GST rules engine.
- Issued invoice financial fields are immutable. Receipts cannot be edited/deleted; overpayments are rejected. Receipt, invoice/installment/promise balances and in-app payment notifications commit together.
- Payments require `Idempotency-Key`. Same key + same body returns the original receipt; different data with that key is rejected. Store the key for retries. Idempotency records are retained.
- Won lead conversion is transactionally once per lead. Recurring billing is once per subscription/cycle; retries retain prior unpaid invoices and advance dates only once.
- Successful developer login checks in automatically once per India calendar day. Existing first check-in is preserved. A separate `/api/attendance/check-out` action records check-out; closing the browser or logging out does not invent a work end time. HR can review/correct attendance with audit history. Login attendance is a presence signal, not a payroll/time-tracking proof.
- Calls with a new next-follow-up date create a follow-up in the same transaction.
- File/receipt/creative URLs are validated and stored as metadata. Binary upload, antivirus, private object storage and signed downloads are **not** implemented.

## Background jobs

In a separate supervised process, run `npm run worker`. It persists overdue balances/statuses and in-app reminders. Reminder windows: renewals at 30/15/7 days, other configured due dates at 7 days, plus due/overdue. Events are deduplicated per record, deadline, recipient and calendar day. The worker checks every minute; failed passes retry on the next pass and restarting catches up on currently due work.

Leave `WORKER_USER_ID` empty for reminders and aging only. To enable automatic recurring invoices, set it to the ID of a dedicated active Accounts user. Audit entries identify that account. One due cycle per subscription is generated each pass; older cycles catch up over successive passes. Run this deliberately after reviewing subscription dates, amounts and billing policy.

Payment and reminder notifications are available at `/api/notifications`. The supplied frontend does not yet show this notification inbox or a check-out button. Its existing reminder views remain available. No WhatsApp, email, Meta or Google messages are sent by this backend; no external provider is configured.

## Verify

```powershell
npm run check
npm run test:unit
npm test
npm audit --omit=dev
```

`npm test` launches a disposable local MongoDB replica set using mongodb-memory-server; first run downloads a MongoDB binary. It does not connect to or clear your `.env` database. It needs an OS environment that allows MongoDB to run. Keep the integration tests mandatory before deployment.

The GitHub Actions file is for this backend as the repository root. If using a monorepo, set the backend working directory and lockfile cache path in that workflow.

## Deployment

Use HTTPS with Angular and `/api` under the same domain; example reverse-proxy locations are in `docs/nginx.conf.example`. Set `NODE_ENV=production`, exact HTTPS `APP_ORIGINS`, MongoDB URI and trusted proxy subnet/IP in the host's secrets/settings. Never set broad trust-proxy to bypass networking errors. Restrict direct access to Node's port. Dockerfile runs as a non-root user.

The API refuses to start without a reachable replica-set database. Index creation happens before accepting requests. Stop/start accepts SIGTERM gracefully. Liveness and database readiness are separate endpoints.

Transactions currently serialize CRM writes with one database counter. This deliberately protects cross-collection link and accounting consistency for a small company; benchmark with your workload. It is not a claim of high-volume billing throughput. Database writes in other applications/scripts must not bypass this service's rules.

Before going live: run full integration and browser role tests against staging, confirm TLS/cookies/proxy behavior, configure database backups and perform a restore drill, set database access restrictions, set monitoring/alerts and log retention, and verify expected workload. Review invoice numbering/legal/GST needs with your business requirements. This build does not implement refunds, credit notes, e-invoicing, payroll, MFA, self-service password recovery or multi-company tenancy.

References used: [Express production security](https://expressjs.com/en/advanced/best-practice-security/) and [Mongoose transactions](https://mongoosejs.com/docs/transactions.html).

## Layered structure

See `docs/ARCHITECTURE.md`. Each of the 29 resources has its own explicit Mongoose model and feature folder with a controller, service and router. Shared record validation, permissions and transactions are implemented once. Authentication, attendance, billing, lead conversion and notifications have dedicated business services.

## Existing frontend integration

This archive contains only the backend. Keep your Angular project separately. Before using payments and recurring billing, its CRM store must:

1. Send `Idempotency-Key` with a fresh UUID for each intended payment POST. Preserve and reuse that key for retries of the same payment.
2. Send `{cycleDate: subscription.nextBillingDate}` as the body of `POST /api/subscriptions/:id/invoice`.
3. Refresh `promises` alongside `invoices` and `installments` after saving a payment.

These frontend integration changes are required. This ZIP does not modify or bundle your frontend. The prior combined package contained those changes.

### Apply the frontend integration automatically

For the exact frontend ZIP you supplied, you can run from the backend folder:

```powershell
npm run connect:frontend -- "C:\path\to\your-angular-frontend"
```

This makes only the three integration changes described above and saves the original CRM store beside it as a backup. It refuses to change a differently structured version. No frontend source is included in this backend ZIP. Rebuild your Angular project after running it.
