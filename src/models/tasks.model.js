import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: ["TODO", "IN_PROGRESS", "REVIEW", "CHANGES_REQUIRED", "COMPLETED"],
  },
  title: String,
  projectId: String,
  description: String,
  assignedTo: String,
  dueDate: String,
  priority: String,
  progress: Number,
  comments: String,
  attachments: String,
});
schema.index({ projectId: 1 });
schema.index({ assignedTo: 1 });
export const tasksModel = mongoose.model("tasks", schema, "tasks");
