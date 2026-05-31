// middleware/authMiddleware.js

export function apiKeyMiddleware(req, res, next) {
  console.log("🔥 HEADERS RECEIVED:", req.headers);

  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"];

  console.log("🔑 Extracted API key:", apiKey);

  if (!process.env.INTERNAL_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Server missing INTERNAL_API_KEY",
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Missing API key",
    });
  }

  const cleanKey = apiKey.replace("Bearer ", "").trim();

  if (cleanKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({
      success: false,
      error: "Invalid API key",
    });
  }

  /**
   * =========================================
   * ATTACH AUTH CONTEXT (CRITICAL FIX)
   * =========================================
   */

  req.auth = {
    type: "internal_api_key",
    isAuthenticated: true,
    role: "internal",
    permissions: [
      "contracts:read",
      "contracts:write",
      "providers:read",
      "providers:write",
      "portfolio:read",
      "media:upload",
      "admin:access",
    ],
  };

  next();
}

/**
 * =========================================
 * OPTIONAL ROLE GUARD (FOR FUTURE USE)
 * =========================================
 */

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || req.auth.role !== role) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
    }

    next();
  };
}
