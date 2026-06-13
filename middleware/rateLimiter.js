import redis from "../services/redisClient.js";

/**
 * =========================================
 * TENANT RATE LIMITER (SIMPLE + EFFECTIVE)
 * =========================================
 */

export async function rateLimiter(req, res, next) {
  try {
    const tenantId = req.tenant?.org_id || "default";

    const key = `rate:${tenantId}`;

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, 60); // 1 minute window
    }

    if (current > 30) {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded (30 req/min)",
      });
    }

    next();
  } catch (err) {
    console.error("Rate limiter error:", err.message);
    next(); // fail open
  }
}