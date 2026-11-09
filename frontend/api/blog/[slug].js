import { renderBlogArticleHtml } from "../../src/lib/blogRendering.js";

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

export default async function blogArticle(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }
  const slug = String(req.query.slug || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(404).send("Article not found.");
  const base = backendUrl();
  if (!base) return res.status(503).send("Operion Insights is temporarily unavailable.");
  try {
    const response = await fetch(`${base}/api/blog/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return res.status(response.status === 404 ? 404 : 503).send(response.status === 404 ? "Article not found." : "Operion Insights is temporarily unavailable.");
    const result = await response.json();
    if (result.redirectTo && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.redirectTo)) {
      return res.redirect(301, `/blog/${encodeURIComponent(result.redirectTo)}`);
    }
    if (!result.post || result.post.status !== "published" || result.post.archived_at) return res.status(404).send("Article not found.");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=0, must-revalidate");
    return res.status(200).send(renderBlogArticleHtml(result.post, base));
  } catch {
    console.error("blog_ssr_article_failed");
    return res.status(503).send("Operion Insights is temporarily unavailable.");
  }
}
