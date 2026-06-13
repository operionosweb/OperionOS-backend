export function tenantContext(req, res, next) {
  try {
    /**
     * In production this comes from:
     * - JWT token
     * - API key mapping
     * - SSO (Airline login)
     */

    const org_id =
      req.headers["x-org-id"] ||
      req.user?.org_id ||
      "default-org";

    const airline_id =
      req.headers["x-airline-id"] ||
      req.user?.airline_id ||
      "unknown-airline";

    req.tenant = {
      org_id,
      airline_id,
      request_id: generateRequestId(),
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
  return (
    "op_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 10)
  );
}