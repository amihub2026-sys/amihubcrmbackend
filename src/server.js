import mongoose from "mongoose";
import { configuration } from "./config/env.js";
import { connect } from "./config/database.js";
import { createApp, logger } from "./app.js";
try {
  const config = configuration();
  await connect(config.mongoUri);
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
