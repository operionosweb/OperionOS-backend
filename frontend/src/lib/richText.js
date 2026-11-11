const TYPES = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule", "table", "tableRow", "tableHeader", "tableCell"]);
const COLORS = /^#[0-9a-f]{6}$/i;
const FONTS = new Set(["Arial", "Georgia", "Verdana"]);
const ALIGN = new Set(["left", "center", "right", "justify"]);
const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code"]);

export function normalizeRichText(document) {
  let count = 0;
  let characters = 0;
  function node(value, depth = 0) {
    if (++count > 5000 || depth > 12 || !value || !TYPES.has(value.type)) throw new TypeError("Unsupported or oversized rich text document.");
    if (value.type === "text") {
      if (typeof value.text !== "string" || (characters += value.text.length) > 100000) throw new TypeError("Article text exceeds the supported limit.");
      const marks = (value.marks || []).map(mark => {
        if (SIMPLE_MARKS.has(mark.type)) return { type: mark.type };
        if (mark.type === "link") {
          let u;
          try { u = new URL(mark.attrs?.href); } catch { throw new TypeError("Invalid rich text link."); }
          if (!["https:", "http:", "mailto:"].includes(u.protocol)) throw new TypeError("Unsupported link protocol.");
          return { type: "link", attrs: { href: u.href } };
        }
        if (mark.type === "textStyle") {
          const attrs = {};
          if (COLORS.test(mark.attrs?.color || "")) attrs.color = mark.attrs.color;
          if (FONTS.has(mark.attrs?.fontFamily)) attrs.fontFamily = mark.attrs.fontFamily;
          if (/^(12|14|16|18|20|24|28|32)px$/.test(mark.attrs?.fontSize || "")) attrs.fontSize = mark.attrs.fontSize;
          return { type: mark.type, attrs };
        }
        if (mark.type === "highlight" && COLORS.test(mark.attrs?.color || "")) return { type: "highlight", attrs: { color: mark.attrs.color } };
        throw new TypeError("Unsupported rich text formatting.");
      });
      if (marks.length > 10) throw new TypeError("Too many formatting marks.");
      return { type: "text", text: value.text, ...(marks.length ? { marks } : {}) };
    }
    const attrs = {};
    if (value.type === "heading") {
      if (![1, 2, 3, 4].includes(value.attrs?.level)) throw new TypeError("Unsupported heading level.");
      attrs.level = value.attrs.level;
    }
    if (["heading", "paragraph"].includes(value.type) && ALIGN.has(value.attrs?.textAlign)) attrs.textAlign = value.attrs.textAlign;
    if (["tableCell", "tableHeader"].includes(value.type)) {
      for (const key of ["colspan", "rowspan"]) {
        const n = value.attrs?.[key] ?? 1;
        if (!Number.isInteger(n) || n < 1 || n > 20) throw new TypeError("Invalid table dimensions.");
        attrs[key] = n;
      }
    }
    const content = value.content || [];
    if (!Array.isArray(content)) throw new TypeError("Invalid rich text children.");
    return { type: value.type, ...(Object.keys(attrs).length ? { attrs } : {}), ...(content.length ? { content: content.map(c => node(c, depth + 1)) } : {}) };
  }
  if (document?.type !== "doc") throw new TypeError("A structured rich text document is required.");
  return node(document);
}
export function richTextPlain(document) {
  if (!document) return "";
  if (document.type === "text") return document.text || "";
  return (document.content || []).map(richTextPlain).join(document.type === "paragraph" || document.type === "heading" ? "" : " ");
}
export function articlePlainText(post) {
  return (post.content || []).map(b => b.type === "rich_text" ? richTextPlain(b.document) : b.text || (b.items || b.rows || []).flat().join(" ")).join("\n");
}
export function readingMinutes(post) { return Math.max(1, Math.ceil(articlePlainText(post).trim().split(/\s+/).filter(Boolean).length / 220)); }
export function isPublicArticle(post, now = Date.now()) {
  return !!post && ["published", "scheduled"].includes(post.status) && !post.archived_at
    && Number.isFinite(Date.parse(post.published_at)) && Date.parse(post.published_at) <= now;
}
