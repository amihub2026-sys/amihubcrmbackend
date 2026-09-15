import { Event } from "../models/system.model.js";
import { plain } from "../config/database.js";
import { assert } from "../utils/index.js";
export async function listNotifications(user) {
  return (
    await Event.find({ recipientId: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  ).map(plain);
}
export async function markRead(user, id) {
  const row = await Event.findOneAndUpdate(
    { _id: id, recipientId: user._id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  assert(row, 404, "Notification not found");
  return plain(row);
}
