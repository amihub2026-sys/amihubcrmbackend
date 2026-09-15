import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE"] },
  name: String,
  address: String,
  email: String,
  phone: String,
  taxId: String,
  bankDetails: String,
  terms: String,
});
schema.index({ status: 1 }, { unique: true });
export const billingProfileModel = mongoose.model(
  "billingProfile",
  schema,
  "billingProfile",
);
