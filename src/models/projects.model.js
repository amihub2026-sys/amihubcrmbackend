import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";
const schema = baseSchema({
  status: {
    type: String,
    enum: [
      "REQUIREMENT",
      "DESIGN",
      "DEVELOPMENT",
      "TESTING",
      "INTERNAL_REVIEW",
      "CLIENT_REVIEW",
      "REVISION",
      "DEPLOYMENT",
      "COMPLETED",
      "DELIVERED",
    ],
  },
  projectName: String,
  customerId: String,
  projectType: String,
  description: String,
  projectManager: String,
  assignedEmployees: [String],
  startDate: String,
  deadline: String,
  priority: String,
  progress: Number,
  budget: Number,
});
schema.index({ customerId: 1 });
schema.index({ projectManager: 1 });
schema.index({ assignedEmployees: 1 });
export const projectsModel = mongoose.model("projects", schema, "projects");
