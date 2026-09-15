import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["PRESENT", "ABSENT", "HALF_DAY", "REMOTE"] },
  employeeId: String,
  date: String,
  checkIn: String,
  checkOut: String,
  source: String,
  checkInAt: Date,
  checkOutAt: Date,
});
schema.index({ employeeId: 1 });
schema.index({ employeeId: 1, date: 1 }, { unique: true });
export const attendanceModel = mongoose.model(
  "attendance",
  schema,
  "attendance",
);
