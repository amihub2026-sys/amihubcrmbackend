import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE", "PAUSED", "CANCELLED"] },
  serviceName: String,
  customerId: String,
  serviceType: String,
  amount: Number,
  frequency: String,
  startDate: String,
  nextBillingDate: String,
  paymentDueDays: Number,
  assignedTo: String,
  notes: String,
});
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });
export const subscriptionsModel = mongoose.model(
  "subscriptions",
  schema,
  "subscriptions",
);
