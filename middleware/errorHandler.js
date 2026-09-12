import { sendSafeHttpError } from "../utils/safeHttpError.js";

export function errorHandler(err, req, res, next) {
  console.error("Unhandled request error", {
    request_id: req.requestId || null,
    error_code: err?.code || "INTERNAL_ERROR",
  });

  return sendSafeHttpError(res, err, {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "The request could not be completed",
  });
}
