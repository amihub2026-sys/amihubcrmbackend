import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"] },
  employeeId: String,
  leaveType: String,
  startDate: String,
  endDate: String,
  reason: String,
});
schema.index({ employeeId: 1 });
export const leaveModel = mongoose.model("leave", schema, "leave");
