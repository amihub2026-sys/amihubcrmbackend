import { Router } from "express";
import { createController } from "../controllers/workspace.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.get("/api/bootstrap", controller.bootstrap);
  return router;
}
