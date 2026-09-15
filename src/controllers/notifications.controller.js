import {
  listNotifications,
  markRead,
} from "../services/notification.service.js";
export function createController() {
  return {
    async list(req, res) {
      res.json({ items: await listNotifications(req.user) });
    },
    async markRead(req, res) {
      res.json({ record: await markRead(req.user, req.params.id) });
    },
  };
}
