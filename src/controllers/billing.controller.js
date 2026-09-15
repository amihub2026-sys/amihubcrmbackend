import { cycleInvoice } from "../services/billing.service.js";
export function createController(config) {
  return {
    async createCycleInvoice(req, res) {
      res.json({
        record: await cycleInvoice(
          req.user,
          req.params.id,
          config,
          req.body?.cycleDate,
        ),
      });
    },
  };
}
