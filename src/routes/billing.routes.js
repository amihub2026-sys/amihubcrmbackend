import { Router } from "express";
import { createController } from "../controllers/billing.controller.js";
export function createRouter(config) {
  const router = Router();
  const controller = createController(config);
  router.post("/api/subscriptions/:id/invoice", controller.createCycleInvoice);
  return router;
}
