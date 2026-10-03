import mongoose from "mongoose";

import { configuration } from "./config/env.js";

import { connect } from "./config/database.js";

import { createApp, logger } from "./app.js";

import cron from "node-cron";

import { markAbsentEmployees } from "./services/attendance-auto.service.js";

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