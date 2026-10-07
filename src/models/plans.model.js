import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({
  status: {
    type: String,
    enum: ["PLANNED", "ACTIVE", "COMPLETED"],
  },

  title: String,

  // Customer
  customerId: String,

  // Selected master package
  digitalMarketingPlanId: String,

  // Price copied from the selected package
  monthlyPrice: {
    type: Number,
    default: 0,
  },

  // Monthly period
  month: String,

  // Exact date the customer starts this plan
  // Example: 2026-10-05
  planStartDate: String,

  platforms: String,

  // Content targets
  posterTarget: Number,
  reelTarget: Number,
  storyTarget: Number,
  videoTarget: Number,

  // Assigned team
  assignedEmployees: [String],

  // Workflow dates
  planDueDate: String,
  assetsDueDate: String,
  reportDueDate: String,

  // Recurring payment
  autoPayEnabled: {
    type: Boolean,
    default: false,
  },

  paymentStatus: {
    type: String,
    enum: [
      "NOT_ENABLED",
      "PENDING",
      "ACTIVE",
      "FAILED",
      "CANCELLED",
    ],
    default: "NOT_ENABLED",
  },

  // Filled after connecting Razorpay/payment gateway
  gatewaySubscriptionId: {
    type: String,
    default: "",
  },

  nextPaymentDate: {
    type: String,
    default: "",
  },
});

schema.index({ customerId: 1 });
schema.index({ digitalMarketingPlanId: 1 });
schema.index({ assignedEmployees: 1 });

export const plansModel = mongoose.model(
  "plans",
  schema,
  "plans",
);