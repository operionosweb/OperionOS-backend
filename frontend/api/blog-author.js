import { renderAuthorHtml } from "../src/lib/blogRendering.js";
import { isPublicArticle } from "../src/lib/richText.js";

export default async function authorPage(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).send("Method not allowed"); }
  const id = String(req.query.id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(404).send("Author not found.");
  try {
    const base = new URL(process.env.OPERION_BACKEND_URL || process.env.VITE_API_BASE_URL).origin;
    const response = await fetch(`${base}/api/blog/authors/${id}`, { signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return res.status(404).send("Author not found.");
    if (!response.ok) throw new Error("Author source unavailable");
    const result = await response.json();
    const posts = (result.posts || []).filter(p => isPublicArticle(p));
    if (!result.author || !posts.length) return res.status(404).send("Author not found.");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(renderAuthorHtml(result.author, posts, base));
  } catch {
    console.error("public_author_unavailable");
    return res.status(503).send("Author profile temporarily unavailable.");
  }
}
