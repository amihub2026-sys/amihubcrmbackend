import mongoose from "mongoose";

import { baseSchema } from "./base-schema.js";

const schema = baseSchema({

  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING",
  },

  employeeId: String,

  leaveType: String,

  startDate: String,

  endDate: String,

  reason: String,

  // =========================
  // PAYROLL / LEAVE CALCULATION
  // =========================

  totalDays: {
    type: Number,
    default: 1,
  },

  paidDays: {
    type: Number,
    default: 0,
  },

  unpaidDays: {
    type: Number,
    default: 0,
  },

  payrollProcessed: {
    type: Boolean,
    default: false,
  },

});

schema.index({ employeeId: 1 });

schema.index({ status: 1 });

schema.index({ startDate: 1 });

schema.index({ payrollProcessed: 1 });

export const leaveModel = mongoose.model(
  "leave",
  schema,
  "leave"
);