export function apiKeyMiddleware(req, res, next) {
  const apiKey =
    req.headers["x-api-key"];

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

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({
      success: false,
      error: "Invalid API key",
    });
  }

  next();
}
