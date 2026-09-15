# AMI HUB CRM backend

This ZIP is backend-only. Your Angular frontend stays separate.

## Setup

1. Install Node.js 24 and extract this folder.
2. Open it in VS Code. In the terminal run `npm ci`.
3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI` to your Atlas URI, including your database-user password and database name. Do not share this file. Collections and indexes are created automatically.
5. Run `npm run setup:owner` and enter your login name, email and password.
6. Run `npm run dev`.
7. For your original Angular frontend, run `npm run connect:frontend -- "C:\path\to\frontend"` once from this backend directory, then start your frontend separately with `npm start`.

Keep the local frontend at `http://localhost:4200`. Production needs its actual HTTPS origin in `APP_ORIGINS`, HTTPS hosting and deployment validation.

## Structure

- `src/modules/`: 29 resource folders, each with route, controller and service files.
- `src/models/`: explicit Mongoose models.
- `src/services/`: authentication, billing, attendance and shared business logic.
- `src/controllers/` and `src/routes/`: business-action HTTP endpoints.
- `src/validators/`, `src/middleware/`, `src/config/`, `src/jobs/`, `src/utils/`: supporting layers.

Full details: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`.

## Verification

12 tests passed: 7 unit tests and 5 HTTP tests using mocked storage. Syntax and application imports passed. The frontend connection script was checked against your supplied CRM store. Real MongoDB integration tests remain blocked in the build environment; run `npm test` on a supported machine before live deployment. See `docs/VERIFICATION.md`.
