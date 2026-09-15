import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PENDING", "COMPLETED", "CANCELLED"] },
  leadId: String,
  assignedTo: String,
  followUpDate: String,
  followUpTime: String,
  type: String,
  notes: String,
});
schema.index({ leadId: 1 });
schema.index({ assignedTo: 1 });
export const followupsModel = mongoose.model("followups", schema, "followups");
