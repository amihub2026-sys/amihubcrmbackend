
import mongoose from "mongoose";
import { baseSchema, lineItems } from "./base-schema.js";

const schema = baseSchema({
  status: {
    type: String,
    enum: ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
  },

  invoiceNumber: String,

  // Existing CRM customer and project
  customerId: {
    type: String,
    default: null,
  },

  projectId: {
    type: String,
    default: null,
  },

  // Manual customer details - invoice only
  manualCustomerName: {
    type: String,
    trim: true,
    default: "",
  },

  manualCustomerPhone: {
    type: String,
    trim: true,
    default: "",
  },

  manualCustomerAddress: {
    type: String,
    trim: true,
    default: "",
  },

  manualCustomerGstin: {
    type: String,
    trim: true,
    default: "",
  },

  // Manual project - invoice only
  manualProjectName: {
    type: String,
    trim: true,
    default: "",
  },

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

// Existing indexes - unchanged
schema.index({ customerId: 1 });
schema.index({ projectId: 1 });
schema.index({ subscriptionId: 1 });
schema.index({ invoiceNumber: 1 }, { unique: true });

schema.index(
  { subscriptionId: 1, cycleDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      cycleDate: { $type: "string" },
    },
  },
);

export const invoicesModel = mongoose.model(
  "invoices",
  schema,
  "invoices",
);
