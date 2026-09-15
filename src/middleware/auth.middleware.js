import { Session } from "../models/system.model.js";
import { usersModel } from "../models/users.model.js";
import { assert, digest } from "../utils/index.js";
import { sessionCookies } from "../config/cookies.js";
export function createAuthMiddleware(config) {
  const { cookieName } = sessionCookies(config);
  return async (req, res, next) => {
    const raw = req.cookies[cookieName];
    assert(
      typeof raw === "string" && raw.length === 64,
      401,
      "Sign in required",
    );
    const session = await Session.findOne({
      _id: digest(raw),
      expiresAt: { $gt: new Date() },
    }).lean();
    assert(session, 401, "Session expired");
    const user = await usersModel
      .findOne({
        _id: session.userId,
        status: "ACTIVE",
        authVersion: session.authVersion,
      })
      .lean();
    assert(user, 401, "Session expired");
    req.user = user;
    req.session = session;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      assert(
        config.origins.includes(req.get("origin")),
        403,
        "Untrusted or missing request Origin",
      );
      assert(
        req.get("X-XSRF-TOKEN") === session.csrf,
        403,
        "Invalid CSRF token",
      );
    }
    next();
  };
}
