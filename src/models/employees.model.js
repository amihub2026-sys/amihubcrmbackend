import mongoose from "mongoose";

import { baseSchema } from "./base-schema.js";

const schema = baseSchema({

  status: {
    type: String,
    enum: ["ACTIVE", "ON_LEAVE", "INACTIVE"]
  },

  name: String,

  email: String,

  phone: String,

  department: String,

  designation: String,

  joiningDate: String,

  reportingManager: String,

  employmentType: String,

  // =========================
  // PAYROLL
  // =========================

  monthlySalary: {
    type: Number,
    default: 0,
  },

  salaryWorkingDays: {
    type: Number,
    default: 26,
  },

  allowedCasualLeavePerMonth: {
    type: Number,
    default: 1,
  },

});

schema.index({ reportingManager: 1 });

export const employeesModel = mongoose.model(
  "employees",
  schema,
  "employees"
);