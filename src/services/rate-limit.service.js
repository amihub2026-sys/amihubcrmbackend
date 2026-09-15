import { Rate } from "../models/system.model.js";
import { assert, digest } from "../utils/index.js";
export async function consumeLimit(key, limit, seconds) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const row = await Rate.findOneAndUpdate(
    { _id: digest(key + ":" + bucket) },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) },
    },
    { upsert: true, new: true },
  );
  assert(row.count <= limit, 429, "Too many requests. Please try again later.");
}
