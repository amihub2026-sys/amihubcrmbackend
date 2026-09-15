import * as auth from "../services/auth.service.js";
import { assert } from "../utils/index.js";
import { sessionCookies } from "../config/cookies.js";
export function createController(config) {
  const { cookie, cookieName } = sessionCookies(config);
  return {
    async login(req, res) {
      assert(
        config.origins.includes(req.get("origin")),
        403,
        "Untrusted or missing request Origin",
      );
      const result = await auth.login(
        req.body,
        req.ip,
        req.cookies[cookieName],
        config,
      );
      res.cookie(cookieName, result.raw, cookie);
      res.cookie("XSRF-TOKEN", result.csrf, { ...cookie, httpOnly: false });
      res.json({ user: result.user });
    },
    me(req, res) {
      res.cookie("XSRF-TOKEN", req.session.csrf, {
        ...cookie,
        httpOnly: false,
      });
      res.json({ user: auth.publicUser(req.user) });
    },
    async logout(req, res) {
      await auth.logout(req.session._id);
      res.clearCookie(cookieName, { ...cookie, maxAge: undefined });
      res.clearCookie("XSRF-TOKEN", {
        ...cookie,
        httpOnly: false,
        maxAge: undefined,
      });
      res.status(204).end();
    },
    async changePassword(req, res) {
      await auth.changePassword(req.user, req.body);
      res.status(204).end();
    },
  };
}
