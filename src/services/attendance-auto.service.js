import { models } from "../config/database.js";
import { businessClock } from "../utils/index.js";

function toMinutes(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

export async function markAbsentEmployees(config) {
  const settings = await models.attendanceSettings
    .findOne({ status: "ACTIVE" })
    .sort({ updatedAt: -1 })
    .lean();

  if (!settings) {
    return;
  }

  const timezone = settings.timezone || config.timezone || "Asia/Kolkata";
  const clock = businessClock(timezone);

  const today = clock.date;
  const currentTime = clock.time;

  const dayOfWeek = new Date(
    `${today}T00:00:00+05:30`
  ).getDay();

  const workingDays = Array.isArray(settings.workingDays)
    ? settings.workingDays
    : [];

  if (!workingDays.includes(dayOfWeek)) {
    return;
  }

  const officeEndTime = settings.officeEndTime || "18:30";
  const bufferMinutes = Number(settings.absenceBufferMinutes || 0);

  const currentMinutes = toMinutes(currentTime);
  const endMinutes = toMinutes(officeEndTime) + bufferMinutes;

  if (currentMinutes < endMinutes) {
    return;
  }

  const employees = await models.employees
    .find({ status: { $ne: "INACTIVE" } })
    .lean();

  for (const employee of employees) {
    const existing = await models.attendance.findOne({
      employeeId: employee._id,
      date: today,
    });

    if (existing) continue;

    const approvedLeave = await models.leave.findOne({
      employeeId: employee._id,
      status: "APPROVED",
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    if (approvedLeave) continue;

    await models.attendance.create({
      employeeId: employee._id,
      date: today,
      status: "ABSENT",
      source: "AUTO_ABSENT",
    });
  }
}