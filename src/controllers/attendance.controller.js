import { checkOut } from "../services/attendance.service.js";
export function createController(config) {
  return {
    async checkOut(req, res) {
      res.json({ record: await checkOut(req.user, config) });
    },
  };
}
