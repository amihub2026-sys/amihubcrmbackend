import { Router } from "express";
import { createController } from "../controllers/notifications.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.get("/api/notifications", controller.list);
  router.patch("/api/notifications/:id/read", controller.markRead);
  return router;
}
