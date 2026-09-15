import { plansService as service } from "./plans.service.js";
import { assert } from "../../utils/index.js";
export function createController(config) {
  return {
    async list(req, res) {
      const page = Number(req.query.page || 1),
        pageSize = Number(req.query.pageSize || 200);
      assert(
        Number.isInteger(page) &&
          page > 0 &&
          page <= 100000 &&
          Number.isInteger(pageSize) &&
          pageSize > 0 &&
          pageSize <= 200,
        422,
        "Invalid pagination",
      );
      res.json(await service.list(req.user, page, pageSize));
    },
    async create(req, res) {
      res
        .status(201)
        .json({
          record: await service.create(
            req.user,
            req.body,
            config,
            req.get("Idempotency-Key"),
          ),
        });
    },
    async update(req, res) {
      res.json({
        record: await service.update(
          req.user,
          req.params.id,
          req.body,
          config,
          req.get("Idempotency-Key"),
        ),
      });
    },
    async remove(req, res) {
      await service.remove(req.user, req.params.id, Number(req.query.revision));
      res.status(204).end();
    },
  };
}
