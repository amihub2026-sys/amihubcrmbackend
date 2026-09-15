import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE", "INACTIVE"] },
  name: String,
  description: String,
});

export const departmentsModel = mongoose.model(
  "departments",
  schema,
  "departments",
);
