import mongoose from "mongoose";

import { configuration } from "./config/env.js";

import { connect } from "./config/database.js";

import { createApp, logger } from "./app.js";

import cron from "node-cron";

import { markAbsentEmployees } from "./services/attendance-auto.service.js";
import { runDomainRenewalReminders } from "./services/domain-renewal-reminder.service.js";
import { runOneSync } from "./modules/meta/meta.sync.js";

try {

  const config = configuration();

  await connect(config.mongoUri);

  const runMetaWorker = async () => {
  try {
    while (await runOneSync(config)) {
      // Process all queued Meta accounts
    }
  } catch (error) {
    logger.error(
      {
        errorType: error.name,
        message: error.message,
      },
      "Meta sync worker failed",
    );
  }
};

runMetaWorker();
/* =========================================================
   DOMAIN RENEWAL REMINDER WORKER
========================================================= */

let domainReminderRunning = false;

const runDomainReminderWorker = async () => {
  if (domainReminderRunning) {
    return;
  }

  domainReminderRunning = true;

  try {
    const result = await runDomainRenewalReminders(config);

    logger.info(
      {
        processed: result.processed,
        failed: result.failed,
      },
      "Domain renewal reminder check completed",
    );
  } catch (error) {
    logger.error(
      {
        errorType: error?.name,
        message: error?.message,
      },
      "Domain renewal reminder worker failed",
    );
  } finally {
    domainReminderRunning = false;
  }
};


/*
 * Run once whenever backend starts.
 *
 * This is important because if the server was offline
 * during the scheduled time, reminders are checked
 * immediately after restart.
 */
runDomainReminderWorker();


/*
 * Production daily check:
 * 08:05 AM India time.
 */
cron.schedule(
  "5 8 * * *",
  async () => {
    await runDomainReminderWorker();
  },
  {
    timezone: "Asia/Kolkata",
  },
);

cron.schedule("*/1 * * * *", async () => {
  await runMetaWorker();
});

  cron.schedule(
    "* * * * *",
    async () => {
      try {

        await markAbsentEmployees(config);

      } catch (error) {

        logger.error(
          {
            errorType: error.name,
            message: error.message,
          },
          "Automatic attendance check failed",
        );

      }
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  const server = createApp(config).listen(config.port, "0.0.0.0", () =>

    logger.info({ port: config.port }, "CRM API listening"),

  );

  server.requestTimeout = 30000;

  server.headersTimeout = 35000;

  let stopping = false;

  const shutdown = () => {

    if (stopping) return;

    stopping = true;

    const timer = setTimeout(() => process.exit(1), 15000);

    timer.unref();

    server.close(async () => {

      await mongoose.disconnect();

      clearTimeout(timer);

      process.exit(0);

    });

  };

  process.on("SIGINT", shutdown);

  process.on("SIGTERM", shutdown);

} catch (error) {

  logger.fatal(

    {

      errorType: error.name,

      message: error.message.replace(

        /mongodb(?:\+srv)?:\/\/\S+/g,

        "[redacted]",

      ),

    },

    "Startup failed",

  );

  await mongoose.disconnect();

  process.exitCode = 1;

}