import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE", "INACTIVE"] },
  name: String,
  email: String,
  role: String,
  employeeId: String,
  passwordHash: { type: String, select: false },
  authVersion: { type: Number, default: 1 },
});

schema.index({ email: 1 }, { unique: true });
schema.index(
  { employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $type: "string" } },
  },
);
export const usersModel = mongoose.model("users", schema, "users");
