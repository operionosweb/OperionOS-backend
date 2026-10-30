import express from "express";

const LAYERS = Object.freeze([
  { id: "radar", label: "Radar (regional coverage)" },
  { id: "satellite-geocolor", label: "Satellite / clouds (GeoColor)" },
  { id: "wind-speeds", label: "Surface wind speed (10 m)" },
  { id: "admin", label: "Administrative boundaries" },
]);
const TTL_MS = 5 * 60 * 1000;
const MAX_TILE_BYTES = 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function createWeatherMapRouter({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  const router = express.Router();
  const cache = new Map();
  const inFlight = new Map();
  let windowStart = now();
  let requests = 0;
  const configured = () => env.XWEATHER_MAPS_ENABLED === "1"
    && Boolean(env.XWEATHER_CLIENT_ID && env.XWEATHER_CLIENT_SECRET);

  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/status", (req, res) => {
    res.json({
      configured: configured(),
      provider: "Xweather Raster Maps",
      layers: configured() ? LAYERS : [],
      maximumLevel: 6,
      minimumLevel: 1,
      attribution: "Weather imagery: Vaisala Xweather",
      turbulenceAvailable: false,
      subscriptionVerified: false,
    });
  });

  router.get("/tiles/:layer/:z/:x/:y", async (req, res) => {
    const { layer, z, x, y } = req.params;
    const validInteger = (value) => /^(0|[1-9]\d*)$/.test(value);
    if (!LAYERS.some(({ id }) => id === layer) || ![z, x, y].every(validInteger)
      || Number(z) < 1 || Number(z) > 6 || Number(x) >= 2 ** Number(z) || Number(y) >= 2 ** Number(z)
      || Object.keys(req.query).length) {
      return res.status(400).json({ error: "Unsupported weather tile" });
    }
    if (!configured()) return res.status(503).json({ error: "Xweather maps are not configured" });
    const key = `${layer}/${z}/${x}/${y}`;
    const cached = cache.get(key);
    if (cached && now() - cached.at < TTL_MS) {
      return res.type("png").send(cached.bytes);
    }
    for (const [id, entry] of cache) if (now() - entry.at >= TTL_MS) cache.delete(id);

    if (now() - windowStart >= TTL_MS) { windowStart = now(); requests = 0; }
    if (!inFlight.has(key)) {
      if (requests >= 300 || inFlight.size >= 24) {
        res.set("Retry-After", "60");
        return res.status(429).json({ error: "Weather tile request limit reached" });
      }
      requests++;
      inFlight.set(key, (async () => {
        const credentials = `${encodeURIComponent(env.XWEATHER_CLIENT_ID)}_${encodeURIComponent(env.XWEATHER_CLIENT_SECRET)}`;
        const response = await fetchImpl(`https://maps.api.xweather.com/${credentials}/${key}/current.png`, {
          signal: AbortSignal.timeout(8000), redirect: "error",
        });
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) {
          const error = new Error("Weather imagery provider rejected the request");
          error.code = "WEATHER_PROVIDER_REJECTED";
          throw error;
        }
        if (Number(response.headers.get("content-length")) > MAX_TILE_BYTES) {
          throw new Error("Weather tile exceeds the permitted size");
        }
        const chunks = [];
        let length = 0;
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > MAX_TILE_BYTES) throw new Error("Weather tile exceeds the permitted size");
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Invalid weather tile image");
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, { bytes, at: now() });
        return bytes;
      })());
    }
    try {
      const bytes = await inFlight.get(key);
      return res.type("png").send(bytes);
    } catch (error) {
      // Fetch errors can include the credential-bearing URL; never log the error object.
      console.error("Xweather tile request failed", { code: error.code === "WEATHER_PROVIDER_REJECTED" ? error.code : "WEATHER_TILE_FAILED" });
      return res.status(502).json({ error: "Weather imagery unavailable; verify the server subscription and configuration" });
    } finally {
      inFlight.delete(key);
    }
  });

  return router;
}

export default createWeatherMapRouter();
