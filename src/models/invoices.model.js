import mongoose from "mongoose";
import { baseSchema, lineItems } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
  },
  invoiceNumber: String,
  customerId: String,
  projectId: String,
  description: String,
  subtotal: Number,
  tax: Number,
  discount: Number,
  invoiceDate: String,
  dueDate: String,
  subscriptionId: String,
  billingPeriod: String,
  items: lineItems,
  totalAmount: Number,
  paidAmount: Number,
  balanceAmount: Number,
  cycleDate: String,
});
schema.index({ customerId: 1 });
schema.index({ projectId: 1 });
schema.index({ subscriptionId: 1 });
schema.index({ invoiceNumber: 1 }, { unique: true });
schema.index(
  { subscriptionId: 1, cycleDate: 1 },
  { unique: true, partialFilterExpression: { cycleDate: { $type: "string" } } },
);
export const invoicesModel = mongoose.model("invoices", schema, "invoices");
