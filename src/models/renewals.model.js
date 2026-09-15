import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["ACTIVE", "DUE_SOON", "CONTACTED", "RENEWED", "EXPIRED"],
  },
  serviceName: String,
  customerId: String,
  renewalType: String,
  startDate: String,
  expiryDate: String,
  amount: Number,
  assignedTo: String,
  notes: String,
});
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });
export const renewalsModel = mongoose.model("renewals", schema, "renewals");
