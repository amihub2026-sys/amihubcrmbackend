# Verification record

Prepared on 12 September 2026, against the supplied Angular frontend ZIP.

## Passed

- Syntax checks across every backend source and setup script.
- Successful application import and registration of all resource routers.
- Five HTTP tests passed, including all 29 resource list routes, authentication enforcement and finance denial. These use mocked database methods, not real MongoDB.
- Seven backend unit tests: integer-paise invoice arithmetic, month-end/leap-year recurring dates, India attendance day boundary, input/operator/date validation, grants/budget redaction, salted password verification, and model/contract field parity.
- The prior combined delivery passed its Angular production build. This backend-only refactor contains no Angular source.
- The prior delivery passed 67 Angular tests; these were not rerun for the backend-only restructuring.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities at verification time. This is not a security certification.

## Blocked, not passed

The full backend integration suite tried to launch MongoDB 7.0.24 as a disposable replica set. The MongoDB binary downloaded, but the process exited with code 100 and `open: Operation not permitted` in this execution environment. No integration test body ran. This is a real test gate, not a successful run or skipped-test pass.

Included integration scenarios cover secure login/CSRF and automatic attendance, all 29 collection response contracts, assignment isolation, stale revisions, linked deletion, concurrent lead conversion, duplicate/overpayment rollback, retained receipts, payment notifications, recurring billing retry behavior and logout revocation. Run `npm test` on a machine or CI runner that can run MongoDB and resolve any failures before deploying.

## Still required before live use

- Real Atlas/staging startup, index creation, transaction/concurrency tests and frontend-to-API browser flows.
- All staff roles, account provisioning/deactivation and permission-denied browser paths.
- Production cookie/CSRF behavior behind the actual HTTPS reverse proxy.
- Worker/reminder/automatic billing acceptance tests, monitoring and crash recovery.
- Database backups plus a tested restore, host/network security, load testing and business acceptance.

No live MongoDB credentials were used. No production service was deployed. No external email/WhatsApp provider was called.
