import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["SCHEDULED", "COMPLETED", "CANCELLED"] },
  title: String,
  leadId: String,
  date: String,
  time: String,
  meetingType: String,
  location: String,
  assignedEmployees: [String],
  outcome: String,
  nextAction: String,
});
schema.index({ leadId: 1 });
schema.index({ assignedEmployees: 1 });
export const meetingsModel = mongoose.model("meetings", schema, "meetings");
