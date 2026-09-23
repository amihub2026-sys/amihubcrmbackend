import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { logger } from "./config/logger.js";
export { logger };
import { createAuthMiddleware } from "./middleware/auth.middleware.js";
import { rateLimit } from "./middleware/rate-limit.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createRouter as healthRouter } from "./routes/health.routes.js";
import { createRouter as authRouter } from "./routes/auth.routes.js";
import { createRouter as attendanceRouter } from "./routes/attendance.routes.js";
import { createRouter as workspaceRouter } from "./routes/workspace.routes.js";
import { createRouter as notificationsRouter } from "./routes/notifications.routes.js";
import { createRouter as leadsRouter } from "./routes/leads.routes.js";
import { createRouter as billingRouter } from "./routes/billing.routes.js";
import { createRouter as plansResourceRouter } from "./modules/plans/plans.routes.js";
import { createRouter as contentResourceRouter } from "./modules/content/content.routes.js";
import { createRouter as campaignsResourceRouter } from "./modules/campaigns/campaigns.routes.js";
import { createRouter as campaignLeadsResourceRouter } from "./modules/campaignLeads/campaignLeads.routes.js";
import { createRouter as projectsResourceRouter } from "./modules/projects/projects.routes.js";
import { createRouter as tasksResourceRouter } from "./modules/tasks/tasks.routes.js";
import { createRouter as filesResourceRouter } from "./modules/files/files.routes.js";
import { createRouter as leadsResourceRouter } from "./modules/leads/leads.routes.js";
import { createRouter as callsResourceRouter } from "./modules/calls/calls.routes.js";
import { createRouter as followupsResourceRouter } from "./modules/followups/followups.routes.js";
import { createRouter as meetingsResourceRouter } from "./modules/meetings/meetings.routes.js";
import { createRouter as quotationsResourceRouter } from "./modules/quotations/quotations.routes.js";
import { createRouter as employeesResourceRouter } from "./modules/employees/employees.routes.js";
import { createRouter as attendanceResourceRouter } from "./modules/attendance/attendance.routes.js";
import { createRouter as leaveResourceRouter } from "./modules/leave/leave.routes.js";
import { createRouter as usersResourceRouter } from "./modules/users/users.routes.js";
import { createRouter as servicesResourceRouter } from "./modules/services/services.routes.js";
import { createRouter as departmentsResourceRouter } from "./modules/departments/departments.routes.js";
import { createRouter as billingProfileResourceRouter } from "./modules/billingProfile/billingProfile.routes.js";
import { createRouter as ticketsResourceRouter } from "./modules/tickets/tickets.routes.js";
import { createRouter as renewalsResourceRouter } from "./modules/renewals/renewals.routes.js";
import { createRouter as invoicesResourceRouter } from "./modules/invoices/invoices.routes.js";
import { createRouter as installmentsResourceRouter } from "./modules/installments/installments.routes.js";
import { createRouter as paymentsResourceRouter } from "./modules/payments/payments.routes.js";
import { createRouter as expensesResourceRouter } from "./modules/expenses/expenses.routes.js";
import { createRouter as payrollResourceRouter } from "./modules/payroll/payroll.routes.js";
import { createRouter as promisesResourceRouter } from "./modules/promises/promises.routes.js";
import { createRouter as subscriptionsResourceRouter } from "./modules/subscriptions/subscriptions.routes.js";
import { createRouter as customersResourceRouter } from "./modules/customers/customers.routes.js";
import { createRouter as visitsResourceRouter } from "./modules/visits/visits.routes.js";
import { createRouter as attendanceSettingsResourceRouter } from "./modules/attendanceSettings/attendanceSettings.routes.js";
export function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-ID", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    const started = Date.now();
    res.on("finish", () =>
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - started,
        },
        "request",
      ),
    );
    next();
  });
  app.use(healthRouter(config));
  app.use("/api", rateLimit);
  // Login must be registered before authentication; all other auth routes are protected.
  const auth = authRouter(config);
  app.post("/api/auth/login", auth);
  app.use("/api", createAuthMiddleware(config));
  app.use(auth);
  app.use(attendanceRouter(config));
  app.use(workspaceRouter(config));
  app.use(notificationsRouter(config));
  app.use(billingRouter(config));
  app.use(leadsRouter(config));
  app.use("/api/plans", plansResourceRouter(config));
  app.use("/api/content", contentResourceRouter(config));
  app.use("/api/campaigns", campaignsResourceRouter(config));
  app.use("/api/campaignLeads", campaignLeadsResourceRouter(config));
  app.use("/api/projects", projectsResourceRouter(config));
  app.use("/api/tasks", tasksResourceRouter(config));
  app.use("/api/files", filesResourceRouter(config));
  app.use("/api/leads", leadsResourceRouter(config));
  app.use("/api/calls", callsResourceRouter(config));
  app.use("/api/followups", followupsResourceRouter(config));
  app.use("/api/meetings", meetingsResourceRouter(config));
  app.use("/api/quotations", quotationsResourceRouter(config));
  app.use("/api/employees", employeesResourceRouter(config));
  app.use("/api/attendance", attendanceResourceRouter(config));
  app.use("/api/leave", leaveResourceRouter(config));
  app.use("/api/users", usersResourceRouter(config));
  app.use("/api/services", servicesResourceRouter(config));
  app.use("/api/departments", departmentsResourceRouter(config));
  app.use("/api/billingProfile", billingProfileResourceRouter(config));
  app.use("/api/tickets", ticketsResourceRouter(config));
  app.use("/api/renewals", renewalsResourceRouter(config));
  app.use("/api/invoices", invoicesResourceRouter(config));
  app.use("/api/installments", installmentsResourceRouter(config));
  app.use("/api/payments", paymentsResourceRouter(config));
  app.use("/api/expenses", expensesResourceRouter(config));
  app.use("/api/payroll", payrollResourceRouter(config));
  app.use("/api/promises", promisesResourceRouter(config));
  app.use("/api/subscriptions", subscriptionsResourceRouter(config));
  app.use("/api/customers", customersResourceRouter(config));
  app.use("/api/visits", visitsResourceRouter(config));
  app.use(
  "/api/attendanceSettings",
  attendanceSettingsResourceRouter(config),
);
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  app.use(errorHandler);
  return app;
}
