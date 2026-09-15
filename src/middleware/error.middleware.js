import { logger } from "../config/logger.js";
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status =
    err.status ||
    (err.code === 11000
      ? 409
      : ["ValidationError", "StrictModeError", "CastError"].includes(err.name)
        ? 422
        : 500);
  if (status >= 500)
    logger.error(
      { requestId: req.requestId, errorType: err.name, code: err.code },
      "request failed",
    );
  if (status === 429) res.setHeader("Retry-After", "900");
  res
    .status(status)
    .json({
      message:
        status >= 500
          ? "Unexpected server error"
          : err.code === 11000
            ? "Duplicate unique record"
            : err.message,
      requestId: req.requestId,
    });
};
