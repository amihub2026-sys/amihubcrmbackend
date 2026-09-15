import { models, transaction, plain } from "../config/database.js";
import { assert, businessClock } from "../utils/index.js";
import { audit } from "./context.service.js";
export async function checkOut(user, config) {
  assert(
    user.role === "developer" && user.employeeId,
    403,
    "Developer employee account required",
  );
  const clock = businessClock(config.timezone);
  const row = await transaction(async (session) => {
    const row = await models.attendance
      .findOne({ employeeId: user.employeeId, date: clock.date })
      .session(session);
    assert(row?.checkInAt, 409, "No check-in for today");
    if (!row.checkOutAt) {
      row.checkOut = clock.time;
      row.checkOutAt = new Date();
      row.revision++;
      await row.save({ session });
      await audit(user, "attendance", row, "Checked out", session);
    }
    return plain(row);
  });
  return row;
}
