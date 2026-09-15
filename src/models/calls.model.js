import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "CONNECTED",
      "NO_ANSWER",
      "BUSY",
      "SWITCHED_OFF",
      "CALL_BACK",
      "INTERESTED",
      "NOT_INTERESTED",
      "WRONG_NUMBER",
      "MEETING_FIXED",
    ],
  },
  leadId: String,
  employeeId: String,
  callDate: String,
  notes: String,
  nextFollowUpDate: String,
});
schema.index({ leadId: 1 });
schema.index({ employeeId: 1 });
export const callsModel = mongoose.model("calls", schema, "calls");
