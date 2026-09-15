import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PLANNED", "ACTIVE", "COMPLETED"] },
  title: String,
  customerId: String,
  month: String,
  platforms: String,
  posterTarget: Number,
  reelTarget: Number,
  storyTarget: Number,
  videoTarget: Number,
  assignedEmployees: [String],
  planDueDate: String,
  assetsDueDate: String,
  reportDueDate: String,
});
schema.index({ customerId: 1 });
schema.index({ assignedEmployees: 1 });
export const plansModel = mongoose.model("plans", schema, "plans");
