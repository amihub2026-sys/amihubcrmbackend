import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "NEW",
      "ASSIGNED",
      "CONTACTED",
      "FOLLOW_UP",
      "INTERESTED",
      "MEETING",
      "QUOTATION",
      "NEGOTIATION",
      "WON",
      "LOST",
    ],
  },
  businessName: String,
  contactPerson: String,
  phone: String,
  email: String,
  location: String,
  interestedServices: String,
  source: String,
  assignedTo: String,
  priority: String,
  nextFollowUpDate: String,
  notes: String,
  convertedCustomerId: String,
});
schema.index({ assignedTo: 1 });
export const leadsModel = mongoose.model("leads", schema, "leads");
