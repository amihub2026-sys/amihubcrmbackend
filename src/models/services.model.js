import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["ACTIVE", "INACTIVE"] },
  name: String,
  description: String,
});

export const servicesModel = mongoose.model("services", schema, "services");
