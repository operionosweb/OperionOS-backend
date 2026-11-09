function backendUrl() {
  const configured = process.env.OPERION_BACKEND_URL || process.env.VITE_API_BASE_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default async function sitemap(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }
  const base = backendUrl();
  if (!base) return res.status(503).send("Sitemap temporarily unavailable.");
  try {
    const response = await fetch(`${base}/api/blog/sitemap.xml`, {
      headers: { Accept: "application/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Blog sitemap API returned ${response.status}`);
    const body = await response.text();
    if (!body.startsWith("<?xml") || !body.includes("<urlset")) throw new Error("Blog sitemap response was invalid.");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
    return res.status(200).send(body);
  } catch {
    console.error("blog_sitemap_failed");
    return res.status(503).send("Sitemap temporarily unavailable.");
  }
}
