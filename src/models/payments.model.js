import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["RECEIVED"] },
  invoiceId: String,
  installmentId: String,
  amount: Number,
  paymentDate: String,
  paymentMethod: String,
  transactionReference: String,
  notes: String,
  visitId: String,
  promiseId: String,
});
schema.index({ invoiceId: 1 });
schema.index({ installmentId: 1 });
schema.index({ visitId: 1 });
schema.index({ promiseId: 1 });
export const paymentsModel = mongoose.model("payments", schema, "payments");
