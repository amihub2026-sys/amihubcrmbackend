import mongoose from "mongoose";
import { baseSchema } from "./base-schema.js";

const schema = baseSchema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  price: {
    type: Number,
    required: true,
    min: 0,
  },

  posterCount: {
    type: Number,
    required: true,
    min: 0,
  },

  videoCount: {
    type: Number,
    required: true,
    min: 0,
  },

  description: {
    type: String,
    default: "",
  },

  isCustom: {
    type: Boolean,
    default: false,
  },

status: {
  type: String,
  enum: ["ACTIVE", "INACTIVE"],
  default: "ACTIVE",
},
});

schema.index({ name: 1 }, { unique: true });

export const digitalMarketingPlanModel = mongoose.model(
  "digitalMarketingPlans",
  schema,
  "digital_marketing_plans",
);