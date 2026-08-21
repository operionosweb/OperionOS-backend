import crypto from "node:crypto";

export function tenantContext(req, res, next) {
  try {
    req.requestId = generateRequestId();
    req.tenant = {
      request_id: req.requestId,
      timestamp: new Date().toISOString(),
    };

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Tenant context failure",
    });
  }
}

/**
 * Request ID generator
 */
function generateRequestId() {
  return `op_${crypto.randomUUID()}`;
}