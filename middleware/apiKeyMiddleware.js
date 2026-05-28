// middleware/apiKeyMiddleware.js

export function apiKeyMiddleware(req, res, next) {
  try {
    /**
     * =========================================
     * READ API KEY
     * =========================================
     */

    const receivedKey =
      req.headers["x-api-key"];

    const expectedKey =
      process.env.INTERNAL_API_KEY;

    /**
     * =========================================
     * DEBUG LOGS
     * =========================================
     */

    console.log(
      "================ API KEY DEBUG ================"
    );

    console.log(
      "EXPECTED KEY:",
      expectedKey
    );

    console.log(
      "RECEIVED KEY:",
      receivedKey
    );

    console.log(
      "================================================"
    );

    /**
     * =========================================
     * VALIDATION
     * =========================================
     */

    if (!receivedKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API key",
      });
    }

    if (receivedKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        error: "Invalid API key",
      });
    }

    next();

  } catch (error) {
    console.error(
      "apiKeyMiddleware error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "API authentication failed",
    });
  }
}
