import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: { type: String, enum: ["REQUIREMENTS", "WORKING", "DELIVERABLE"] },
  title: String,
  projectId: String,
  fileUrl: String,
  notes: String,
});
schema.index({ projectId: 1 });
export const filesModel = mongoose.model("files", schema, "files");
