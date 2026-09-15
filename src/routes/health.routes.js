import { Router } from "express";
import { createController } from "../controllers/health.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.get("/api/health/live", controller.live);
  router.get("/api/health/ready", controller.ready);
  return router;
}
