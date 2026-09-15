import { Router } from "express";
import { createController } from "../controllers/leads.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.post("/api/leads/:id/convert", controller.convert);
  return router;
}
