// middleware/apiKeyMiddleware.js

import crypto from "node:crypto";

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
     * VALIDATION
     * =========================================
     */

    if (!receivedKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API key",
      });
    }

    const receivedBuffer = Buffer.from(receivedKey);
    const expectedBuffer = Buffer.from(expectedKey || "");
    const isValid =
      receivedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

    if (!isValid) {
      return res.status(403).json({
        success: false,
        error: "Invalid API key",
      });
    }

    req.auth = {
      type: "internal_api_key",
      isAuthenticated: true,
      role: "internal",
    };

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
