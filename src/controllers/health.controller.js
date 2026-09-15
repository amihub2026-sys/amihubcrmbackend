import mongoose from "mongoose";
export function createController() {
  return {
    live(req, res) {
      res.json({ status: "ok" });
    },
    async ready(req, res) {
      try {
        await mongoose.connection.db.admin().ping();
        res.json({ status: "ready" });
      } catch {
        res.status(503).json({ status: "unavailable" });
      }
    },
  };
}
