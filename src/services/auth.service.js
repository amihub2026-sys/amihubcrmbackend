import { models, Session, transaction } from "../config/database.js";
import {
  assert,
  token,
  digest,
  hashPassword,
  verifyPassword,
  businessClock,
} from "../utils/index.js";
import { audit } from "./context.service.js";
import { consumeLimit as rate } from "./rate-limit.service.js";
const dummyHash = await hashPassword(token());
export const publicUser = (user) => ({
  id: user._id,
  employeeId: user.employeeId,
  name: user.name,
  email: user.email,
  role: user.role,
});
export async function login(body, ip, previousToken, config) {
  assert(
    body && typeof body.email === "string" && typeof body.password === "string",
    422,
    "Email and password required",
  );
  const email = body.email.trim().toLowerCase();
  assert(
    email.length <= 254 && body.password.length <= 128,
    422,
    "Invalid credentials",
  );
  await rate("login-ip:" + ip, 30, 900);
  await rate("login-email:" + email, 10, 900);
  const user = await models.users
    .findOne({ email })
    .select("+passwordHash")
    .lean();
  const valid = await verifyPassword(
    body.password,
    user?.passwordHash || dummyHash,
  );
  assert(valid && user?.status === "ACTIVE", 401, "Invalid email or password");
  const raw = token(),
    csrf = token(),
    expiresAt = new Date(Date.now() + config.sessionHours * 3600000);
  await transaction(async (session) => {
    const active = await models.users
      .findOne({
        _id: user._id,
        status: "ACTIVE",
        authVersion: user.authVersion,
      })
      .session(session)
      .lean();
    assert(active, 401, "Account changed. Sign in again.");
    if (user.employeeId)
      assert(
        await models.employees
          .exists({ _id: user.employeeId, status: { $ne: "INACTIVE" } })
          .session(session),
        403,
        "Employee account is inactive",
      );
    if (previousToken)
      await Session.deleteOne({ _id: digest(previousToken) }).session(session);
    await Session.create(
      [
        {
          _id: digest(raw),
          userId: user._id,
          authVersion: user.authVersion,
          csrf,
          expiresAt,
        },
      ],
      { session },
    );
    if (user.employeeId) {
      assert(
        user.employeeId,
        422,
        "Developer account must link to an employee",
      );
      const clock = businessClock(config.timezone);
      const prior = await models.attendance
        .findOne({ employeeId: user.employeeId, date: clock.date })
        .session(session)
        .lean();
      if (!prior) {
        const [row] = await models.attendance.create(
          [
            {
              employeeId: user.employeeId,
              date: clock.date,
              checkIn: clock.time,
              checkInAt: new Date(),
              status: "PRESENT",
              source: "LOGIN",
              createdBy: user._id,
            },
          ],
          { session },
        );
        await audit(user, "attendance", row, "Automatic check-in", session);
      } else if (!prior.checkInAt) {
        await models.attendance.updateOne(
          { _id: prior._id },
          {
            $set: {
              checkIn: prior.checkIn || clock.time,
              checkInAt: new Date(),
              status: "PRESENT",
              source: "LOGIN",
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        await audit(user, "attendance", prior, "Automatic check-in", session);
      }
    }
    await audit(user, "auth", { _id: user._id }, "Signed in", session);
  });

  return { user: publicUser(user), raw, csrf };
}
export async function logout(sessionId, user, config) {
  await transaction(async (session) => {
    if (user?.employeeId) {
      const clock = businessClock(config.timezone);

      const attendance = await models.attendance
        .findOne({
          employeeId: user.employeeId,
          date: clock.date,
        })
        .session(session)
        .lean();

      if (attendance && !attendance.checkOutAt) {
        await models.attendance.updateOne(
          { _id: attendance._id },
          {
            $set: {
              checkOut: clock.time,
              checkOutAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { session },
        );

        await audit(
          user,
          "attendance",
          attendance,
          "Automatic check-out",
          session,
        );
      }
    }

    await Session.deleteOne({ _id: sessionId }).session(session);

    await audit(
      user,
      "auth",
      { _id: user._id },
      "Signed out",
      session,
    );
  });
}
export async function changePassword(currentUser, body) {
  assert(
    body && typeof body.currentPassword === "string",
    422,
    "Current password required",
  );
  await rate("password:" + currentUser._id, 10, 900);
  const user = await models.users
    .findById(currentUser._id)
    .select("+passwordHash")
    .lean();
  assert(
    await verifyPassword(body.currentPassword, user.passwordHash),
    401,
    "Current password incorrect",
  );
  const passwordHash = await hashPassword(body.newPassword);
  await transaction(async (session) => {
    const changed = await models.users.updateOne(
      { _id: user._id, authVersion: user.authVersion },
      { $set: { passwordHash }, $inc: { authVersion: 1, revision: 1 } },
      { session },
    );
    assert(changed.modifiedCount === 1, 409, "Account changed. Sign in again.");
    await Session.deleteMany({ userId: user._id }).session(session);
    await audit(user, "auth", user, "Changed password", session);
  });
}
