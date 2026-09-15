import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] },
  title: String,
  customerId: String,
  platform: String,
  objective: String,
  startDate: String,
  endDate: String,
  budget: Number,
  actualSpend: Number,
  leadCount: Number,
  conversions: Number,
  assignedTo: String,
  notes: String,
});
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });
export const campaignsModel = mongoose.model("campaigns", schema, "campaigns");
