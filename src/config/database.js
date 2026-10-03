import { metaModels } from "../modules/meta/meta.models.js";
import mongoose from "mongoose";
import { models } from "../models/index.js";
import {
  Session,
  Audit,
  Event,
  Rate,
  Counter,
  Idempotency,
} from "../models/system.model.js";
import resources from "./resources.json" with { type: "json" };

export {
  models,
  Session,
  Audit,
  Event,
  Rate,
  Counter,
  Idempotency,
  resources,
};

export async function connect(uri) {
  if (!uri) throw new Error("Set MONGODB_URI in .env");

  mongoose.set("bufferCommands", false);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
    maxPoolSize: 20,
  });

  const hello = await mongoose.connection.db.admin().command({
    hello: 1,
  });

  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "MongoDB must be a replica set (Atlas supports transactions). Standalone MongoDB is not supported.",
    );

  // Create collections/indexes before opening traffic or starting transactions.
  for (const model of [
    ...Object.values(models),
    ...metaModels,
    Session,
    Audit,
    Event,
    Rate,
    Counter,
    Idempotency,
  ])
    await model.createIndexes();

  await Counter.updateOne(
    { _id: "writes" },
    { $setOnInsert: { value: 0 } },
    { upsert: true },
  );
}

export async function transaction(fn) {
  return mongoose.connection.transaction(
    async (session) => {
      // Serialize CRM writes to protect cross-collection references and billing invariants.
      // Suitable for a small-company CRM. Replace with per-aggregate locks before high write scale.
      await Counter.updateOne(
        { _id: "writes" },
        { $inc: { value: 1 } },
        { session },
      );

      return fn(session);
    },
    {
      readPreference: "primary",
      writeConcern: { w: "majority" },
      readConcern: { level: "snapshot" },
    },
  );
}

export function plain(record) {
  if (!record) return null;

  const value = record.toObject
    ? record.toObject()
    : { ...record };

  value.id = value._id;

  delete value._id;
  delete value.passwordHash;
  delete value.authVersion;

  return value;
}