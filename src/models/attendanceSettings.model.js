import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({
  status: {
    type: String,
    enum: ["ACTIVE"],
    default: "ACTIVE",
  },

  officeStartTime: {
    type: String,
    default: "09:00",
  },

  officeEndTime: {
    type: String,
    default: "18:30",
  },

  absenceBufferMinutes: {
    type: Number,
    default: 5,
  },

  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5, 6],
  },

  timezone: {
    type: String,
    default: "Asia/Kolkata",
  },

  isActive: {
    type: Boolean,
    default: true,
  },
});

export const attendanceSettingsModel = mongoose.model(
  "attendanceSettings",
  schema,
  "attendanceSettings"
);