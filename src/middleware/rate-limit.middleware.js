import { consumeLimit } from "../services/rate-limit.service.js";
export async function rateLimit(req, res, next) {
  await consumeLimit("api:" + req.ip, 1200, 60);
  next();
}
