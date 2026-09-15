import { Router } from "express";
import { createController } from "../controllers/auth.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.post("/api/auth/login", controller.login);
  router.get("/api/auth/me", controller.me);
  router.post("/api/auth/logout", controller.logout);
  router.post("/api/auth/change-password", controller.changePassword);
  return router;
}
