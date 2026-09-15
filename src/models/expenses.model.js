import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"] },
  description: String,
  category: String,
  amount: Number,
  expenseDate: String,
  paymentMethod: String,
  projectId: String,
  receiptUrl: String,
});
schema.index({ projectId: 1 });
export const expensesModel = mongoose.model("expenses", schema, "expenses");
