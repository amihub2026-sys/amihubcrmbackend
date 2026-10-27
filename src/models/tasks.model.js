
import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "TODO",
      "IN_PROGRESS",
      "REVIEW",
      "CHANGES_REQUIRED",
      "COMPLETED",
    ],
  },

  // Task information
  title: String,
  description: String,

  // Existing project task
  projectId: String,

  // Digital Marketing task connections
  contentId: String,
  marketingPlanId: String,

  // Employee assignment
  assignedTo: String,
  dueDate: String,
  priority: String,

  // Task progress and review
  progress: Number,
  comments: String,
  attachments: String,
});

// Existing indexes
schema.index({ projectId: 1 });
schema.index({ assignedTo: 1 });

// New indexes for Digital Marketing tasks
schema.index({ contentId: 1 });
schema.index({ marketingPlanId: 1 });

export const tasksModel = mongoose.model(
  "tasks",
  schema,
  "tasks"
);
