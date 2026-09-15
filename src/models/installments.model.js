import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE"],
  },
  installmentName: String,
  invoiceId: String,
  amount: Number,
  dueDate: String,
  notes: String,
  paidAmount: Number,
  balanceAmount: Number,
});
schema.index({ invoiceId: 1 });
export const installmentsModel = mongoose.model(
  "installments",
  schema,
  "installments",
);
