export function apiKeyMiddleware(req, res, next) {
  console.log("🔥 HEADERS RECEIVED:", req.headers);

  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["X-API-KEY"] ||
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

  next();
}
