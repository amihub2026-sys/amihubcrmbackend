import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({

  status: {
    type: String,
    enum: ["DRAFT", "CALCULATED", "APPROVED", "PAID"],
    default: "DRAFT",
  },

  employeeId: String,

  month: String,

  year: Number,

  grossSalary: {
    type: Number,
    default: 0,
  },

  workingDays: {
    type: Number,
    default: 0,
  },

  presentDays: {
    type: Number,
    default: 0,
  },
absentDays: {
  type: Number,
  default: 0,
},
  casualLeaveDays: {
    type: Number,
    default: 0,
  },

  allowedCasualLeaveDays: {
    type: Number,
    default: 1,
  },

  extraLeaveDays: {
    type: Number,
    default: 0,
  },

  unpaidLeaveDays: {
    type: Number,
    default: 0,
  },

  halfDays: {
    type: Number,
    default: 0,
  },

  perDaySalary: {
    type: Number,
    default: 0,
  },

  leaveDeduction: {
    type: Number,
    default: 0,
  },

  otherDeduction: {
    type: Number,
    default: 0,
  },

  bonus: {
    type: Number,
    default: 0,
  },

  allowance: {
    type: Number,
    default: 0,
  },

  netSalary: {
    type: Number,
    default: 0,
  },

  paymentDate: String,

  paymentMethod: String,

  transactionReference: String,

  notes: String,

  notificationSent: {
    type: Boolean,
    default: false,
  },

});

schema.index({ employeeId: 1 });

schema.index(
  { employeeId: 1, month: 1, year: 1 },
  { unique: true }
);

export const payrollModel = mongoose.model(
  "payroll",
  schema,
  "payroll"
);