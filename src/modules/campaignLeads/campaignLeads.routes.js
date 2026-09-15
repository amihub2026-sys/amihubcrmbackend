import { Router } from "express";
import { createController } from "./campaignLeads.controller.js";
export function createRouter(config) {
  const router = Router();
  const c = createController(config);
  router.get("/", c.list);
  router.post("/", c.create);
  router.patch("/:id", c.update);
  router.delete("/:id", c.remove);
  return router;
}
