import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["OPEN", "PARTIALLY_FULFILLED", "FULFILLED", "BROKEN", "CANCELLED"],
  },
  title: String,
  customerId: String,
  invoiceId: String,
  amount: Number,
  promisedDate: String,
  assignedTo: String,
  visitId: String,
  notes: String,
  paidAmount: Number,
  balanceAmount: Number,
});
schema.index({ customerId: 1 });
schema.index({ invoiceId: 1 });
schema.index({ assignedTo: 1 });
schema.index({ visitId: 1 });
export const promisesModel = mongoose.model("promises", schema, "promises");
