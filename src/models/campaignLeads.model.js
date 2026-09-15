import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"],
  },
  name: String,
  campaignId: String,
  customerId: String,
  phone: String,
  email: String,
  receivedDate: String,
  assignedTo: String,
  notes: String,
});
schema.index({ campaignId: 1 });
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });
export const campaignLeadsModel = mongoose.model(
  "campaignLeads",
  schema,
  "campaignLeads",
);
