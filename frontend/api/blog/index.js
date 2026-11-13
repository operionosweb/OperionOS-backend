import { renderBlogIndexHtml } from "../../src/lib/blogRendering.js";
import { isPublicArticle } from "../../src/lib/richText.js";

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

export default async function blogIndex(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }
  const base = backendUrl();
  if (!base) return res.status(503).send("Operion Insights is temporarily unavailable.");
  try {
    const query = new URLSearchParams(Object.fromEntries(["search", "category", "tag", "page", "limit"].filter(k => typeof req.query?.[k] === "string").map(k => [k, req.query[k].slice(0, 160)])));
    const response = await fetch(`${base}/api/blog${query.size ? `?${query}` : ""}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Blog API returned ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result.posts)) throw new Error("Published article response was invalid.");
    const posts = result.posts.filter(post => isPublicArticle(post));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
    return res.status(200).send(renderBlogIndexHtml(posts, base, req.query || {}, result.pagination || {}, result.categories || []));
  } catch {
    console.error("blog_ssr_index_failed");
    return res.status(503).send("Operion Insights is temporarily unavailable.");
  }
}
