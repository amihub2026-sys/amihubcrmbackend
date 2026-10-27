import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "PLANNED",
      "ASSIGNED",
      "CREATED",
      "INTERNAL_REVIEW",
      "CLIENT_REVIEW",
      "REVISION",
      "APPROVED",
      "SCHEDULED",
      "PUBLISHED",
    ],
  },

  // Content information
  title: String,
  marketingPlanId: String,
  customerId: String,
  contentType: String,
  platform: String,
  scheduledDate: String,

  // Employee assignment
  assignedTo: String,
  taskInstructions: String,
  deadline: String,
  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  },

  // Completed creative and approval
  fileUrl: String,
  clientFeedback: String,
  approvalDueDate: String,
});

// Existing indexes
schema.index({ marketingPlanId: 1 });
schema.index({ customerId: 1 });
schema.index({ assignedTo: 1 });

export const contentModel = mongoose.model(
  "content",
  schema,
  "content"
);
