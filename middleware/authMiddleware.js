// middleware/apiKeyMiddleware.js

export function apiKeyMiddleware(req, res, next) {
  try {
    /**
     * -----------------------------------------
     * READ API KEY FROM HEADERS
     * -----------------------------------------
     */

    const apiKey =
      req.headers["x-api-key"] ||
      req.headers["X-API-KEY"] ||
      req.headers["authorization"];

    /**
     * -----------------------------------------
     * VALIDATION
     * -----------------------------------------
     */

    const expectedKey = process.env.INTERNAL_API_KEY;

    if (!expectedKey) {
      console.error("❌ INTERNAL_API_KEY not set in environment");
      return res.status(500).json({
        success: false,
        error: "Server misconfiguration: missing INTERNAL_API_KEY",
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API key",
      });
    }

    /**
     * -----------------------------------------
     * NORMALIZE KEY
     * -----------------------------------------
     */

    const cleanKey = apiKey.replace("Bearer ", "").trim();

    /**
     * -----------------------------------------
     * COMPARE KEYS
     * -----------------------------------------
     */

    if (cleanKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        error: "Invalid API key",
      });
    }

    /**
     * -----------------------------------------
     * OK → CONTINUE
     * -----------------------------------------
     */

    next();
  } catch (error) {
    console.error("API key middleware error:", error);

    return res.status(500).json({
      success: false,
      error: "Authentication middleware failure",
    });
  }
}
