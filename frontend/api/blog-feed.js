import { escapeHtml } from "../src/lib/blogRendering.js";
import { isPublicArticle } from "../src/lib/richText.js";

export default async function blogFeed(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).send("Method not allowed"); }
  try {
    const base = new URL(process.env.OPERION_BACKEND_URL || process.env.VITE_API_BASE_URL).origin;
    const response = await fetch(`${base}/api/blog`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Feed source unavailable");
    const result = await response.json();
    if (!Array.isArray(result.posts)) throw new Error("Invalid feed source");
    const posts = result.posts.filter(p => isPublicArticle(p) && p.is_indexable !== false);
    const items = posts.map(p => `<item><title>${escapeHtml(p.title)}</title><link>https://operionos.com/blog/${encodeURIComponent(p.slug)}</link><guid isPermaLink="true">https://operionos.com/blog/${encodeURIComponent(p.slug)}</guid><description>${escapeHtml(p.excerpt || "")}</description><pubDate>${new Date(p.published_at).toUTCString()}</pubDate></item>`).join("");
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Operion Insights</title><link>https://operionos.com/blog</link><description>Evidence-led aviation intelligence</description>${items}</channel></rss>`);
  } catch {
    console.error("blog_feed_unavailable");
    return res.status(503).send("Feed temporarily unavailable.");
  }
}
