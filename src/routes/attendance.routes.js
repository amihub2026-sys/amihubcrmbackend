import { Router } from "express";
import { createController } from "../controllers/attendance.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.post("/api/attendance/check-out", controller.checkOut);
  return router;
}
