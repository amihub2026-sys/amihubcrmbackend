import { convert } from "../services/lead-conversion.service.js";
export function createController() {
  return {
    async convert(req, res) {
      res.json({ record: await convert(req.user, req.params.id) });
    },
  };
}
