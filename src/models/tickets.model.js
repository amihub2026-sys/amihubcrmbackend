import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "WAITING_CLIENT",
      "RESOLVED",
      "CLOSED",
    ],
  },
  title: String,
  customerId: String,
  projectId: String,
  description: String,
  priority: String,
  assignedTo: String,
  resolution: String,
  dueDate: String,
});
schema.index({ customerId: 1 });
schema.index({ projectId: 1 });
schema.index({ assignedTo: 1 });
export const ticketsModel = mongoose.model("tickets", schema, "tickets");
