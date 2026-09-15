import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
export function baseSchema(fields) {
  const schema = new mongoose.Schema(
    {
      _id: { type: String, default: randomUUID },
      revision: { type: Number, default: 1 },
      createdBy: String,
      ...fields,
    },
    { timestamps: true, strict: "throw", versionKey: false },
  );
  schema.index({ createdAt: -1, _id: 1 });
  return schema;
}
export const lineItems = [
  { _id: false, description: String, quantity: Number, unitPrice: Number },
];
