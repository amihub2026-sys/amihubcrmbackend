import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PLANNED", "COMPLETED", "CANCELLED"] },
  title: String,
  customerId: String,
  visitDate: String,
  visitTime: String,
  assignedTo: String,
  location: String,
  outcome: String,
  nextAction: String,
  nextFollowUpDate: String,
  notes: String,
});
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });
export const visitsModel = mongoose.model("visits", schema, "visits");
