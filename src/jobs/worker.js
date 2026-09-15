import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { configuration } from "../config/env.js";
import { connect, models, Event, transaction } from "../config/database.js";
import { can, scope } from "../middleware/access.js";
import { digest, businessClock } from "../utils/index.js";
import { recalculate, cycleInvoice } from "../services/record.service.js";
import { logger } from "../app.js";
const dueFields = {
  followups: "followUpDate",
  meetings: "date",
  tasks: "dueDate",
  visits: "visitDate",
  content: "scheduledDate",
  plans: "reportDueDate",
  invoices: "dueDate",
  installments: "dueDate",
  promises: "promisedDate",
  subscriptions: "nextBillingDate",
  renewals: "expiryDate",
  tickets: "dueDate",
};
const closed = new Set([
  "COMPLETED",
  "CANCELLED",
  "PAID",
  "FULFILLED",
  "CLOSED",
  "RESOLVED",
  "PUBLISHED",
  "PAUSED",
  "INACTIVE",
]);
export async function runJobs(config, workerUserId) {
  const today = businessClock(config.timezone).date;
  // Financial aging is persisted. A restart catches up on the next run.
  for await (const invoice of models.invoices
    .find({ status: { $nin: ["PAID"] } })
    .select("_id")
    .lean()
    .cursor())
    await transaction((session) => recalculate(invoice._id, session, today));
  if (workerUserId) {
    const actor = await models.users
      .findOne({
        _id: workerUserId,
        status: "ACTIVE",
        role: { $in: ["owner", "admin", "accounts"] },
      })
      .lean();
    if (!actor)
      throw new Error(
        "WORKER_USER_ID must be an active billing-authorized account",
      );
    for await (const sub of models.subscriptions
      .find({ status: "ACTIVE", nextBillingDate: { $lte: today } })
      .lean()
      .cursor())
      await cycleInvoice(actor, sub._id, config, sub.nextBillingDate);
  }
  const users = await models.users.find({ status: "ACTIVE" }).lean();
  for (const [resource, dateField] of Object.entries(dueFields)) {
    const horizon = new Date(today + "T00:00:00Z");
    horizon.setUTCDate(
      horizon.getUTCDate() + (resource === "renewals" ? 30 : 7),
    );
    for await (const row of models[resource]
      .find({
        [dateField]: { $lte: horizon.toISOString().slice(0, 10), $gt: "" },
        status: { $nin: [...closed] },
      })
      .lean()
      .cursor()) {
      const days = Math.round(
        (Date.parse(row[dateField]) - Date.parse(today)) / 86400000,
      );
      if (
        days > 0 &&
        !(resource === "renewals" ? [30, 15, 7] : [7]).includes(days)
      )
        continue;
      for (const user of users) {
        if (!can(user, resource)) continue;
        if (
          !(await models[resource].exists({
            $and: [{ _id: row._id }, await scope(user, resource)],
          }))
        )
          continue;
        const key = digest(
          `reminder:${resource}:${row._id}:${row[dateField]}:${today}:${user._id}`,
        );
        await Event.updateOne(
          { _id: key },
          {
            $setOnInsert: {
              recipientId: user._id,
              type: "reminder",
              recordId: row._id,
              message: `${resource}: ${days < 0 ? "overdue" : days === 0 ? "due today" : `due in ${days} days`} (${row[dateField]})`,
            },
          },
          { upsert: true },
        );
      }
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = configuration();
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await connect(config.mongoUri);
    while (!stopping) {
      try {
        await runJobs(config, process.env.WORKER_USER_ID);
        logger.info("Scheduled jobs completed");
      } catch (error) {
        logger.error(
          { errorType: error.name },
          "Scheduled jobs failed; next pass retries",
        );
      }
      // Interruptible one-second ticks, no overlapping jobs in a process.
      for (let i = 0; i < 60 && !stopping; i++)
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logger.fatal({ errorType: error.name }, "Worker startup failed");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
