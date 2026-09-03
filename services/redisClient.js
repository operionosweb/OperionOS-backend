import Redis from "ioredis";

/**
 * =========================================
 * REDIS CLIENT (CACHE LAYER)
 * =========================================
 */

const redisUrl = process.env.REDIS_URL;
const redis = new Redis(redisUrl || "redis://localhost:6379", redisUrl ? {} : {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

redis.on("connect", () => {
  console.log("🟢 Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
});

export default redis;