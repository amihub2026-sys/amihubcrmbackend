import mongoose from "mongoose";
import { baseSchema, lineItems } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  },
  quotationNumber: String,
  leadId: String,
  description: String,
  subtotal: Number,
  discount: Number,
  tax: Number,
  paymentTerms: String,
  validUntil: String,
  items: lineItems,
  totalAmount: Number,
  paidAmount: Number,
  balanceAmount: Number,
});
schema.index({ leadId: 1 });
schema.index({ quotationNumber: 1 }, { unique: true });
export const quotationsModel = mongoose.model(
  "quotations",
  schema,
  "quotations",
);
