import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
const { Schema } = mongoose;
const options = { timestamps: true, strict: "throw", versionKey: false };
const base = () => ({
  _id: { type: String, default: randomUUID },
  revision: { type: Number, default: 1 },
  createdBy: String,
});
export const Session = mongoose.model(
  "Session",
  new Schema(
    {
      _id: String,
      userId: String,
      authVersion: Number,
      csrf: String,
      expiresAt: Date,
    },
    options,
  ),
);
Session.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Audit = mongoose.model(
  "Audit",
  new Schema(
    {
      ...base(),
      resource: String,
      recordId: String,
      text: String,
      actor: String,
      actorId: String,
      date: Date,
    },
    options,
  ),
);
export const Event = mongoose.model(
  "Event",
  new Schema(
    {
      ...base(),
      recipientId: String,
      type: String,
      recordId: String,
      message: String,
      readAt: Date,
    },
    options,
  ),
);
Event.schema.index({ recipientId: 1, createdAt: -1 });
export const Rate = mongoose.model(
  "Rate",
  new Schema({ _id: String, count: Number, expiresAt: Date }, options),
);
Rate.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Counter = mongoose.model(
  "Counter",
  new Schema({ _id: String, value: Number }, options),
);
export const Idempotency = mongoose.model(
  "Idempotency",
  new Schema(
    { _id: String, fingerprint: String, response: Schema.Types.Mixed },
    options,
  ),
);
