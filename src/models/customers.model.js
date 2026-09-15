import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE", "INACTIVE"] },
  businessName: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  location: String,
  services: String,
  accountManager: String,
  sourceLeadId: String,
});
schema.index({ accountManager: 1 });
schema.index(
  { sourceLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceLeadId: { $type: "string" } },
  },
);
export const customersModel = mongoose.model("customers", schema, "customers");
