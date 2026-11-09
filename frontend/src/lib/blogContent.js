export const BLOG_CATEGORIES = Object.freeze([
  "Aircraft Leasing",
  "Aviation Contract Intelligence",
  "MRO and Maintenance Contracts",
  "Aviation Risk and Compliance",
  "Airline Supplier Contracts",
  "Predictive Contract Intelligence",
]);

const BLOCK_TYPES = new Set(["heading", "paragraph", "unordered_list", "ordered_list", "quote", "table", "link", "image"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function slugFromTitle(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

function boundedText(value, maxLength, field, { required = false } = {}) {
  if (typeof value !== "string") {
    if (required) throw new TypeError(`${field} is required`);
    return "";
  }
  const text = value.trim();
  if (required && !text) throw new TypeError(`${field} is required`);
  if (text.length > maxLength) throw new RangeError(`${field} exceeds ${maxLength} characters`);
  return text;
}

function safeLink(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeBlogBlocks(value) {
  if (!Array.isArray(value) || value.length > 100) throw new TypeError("Article body must contain at most 100 content blocks");
  return value.map((block, index) => {
    if (!block || typeof block !== "object" || !BLOCK_TYPES.has(block.type)) {
      throw new TypeError(`Content block ${index + 1} has an unsupported type`);
    }

    switch (block.type) {
      case "heading": {
        const level = Number(block.level);
        if (![2, 3].includes(level)) throw new TypeError(`Heading block ${index + 1} must use level 2 or 3`);
        return { type: "heading", level, text: boundedText(block.text, 240, "Heading", { required: true }) };
      }
      case "paragraph":
        return { type: "paragraph", text: boundedText(block.text, 12000, "Paragraph", { required: true }) };
      case "unordered_list":
      case "ordered_list": {
        if (!Array.isArray(block.items) || block.items.length === 0 || block.items.length > 50) {
          throw new TypeError(`List block ${index + 1} must contain 1 to 50 items`);
        }
        return { type: block.type, items: block.items.map((item) => boundedText(item, 1000, "List item", { required: true })) };
      }
      case "quote":
        return {
          type: "quote",
          text: boundedText(block.text, 4000, "Quote", { required: true }),
          attribution: boundedText(block.attribution, 240, "Quote attribution"),
        };
      case "table": {
        if (!Array.isArray(block.rows) || block.rows.length < 2 || block.rows.length > 20) {
          throw new TypeError(`Table block ${index + 1} must contain 2 to 20 rows`);
        }
        const rows = block.rows.map((row) => {
          if (!Array.isArray(row) || row.length < 2 || row.length > 6) throw new TypeError("Table rows must contain 2 to 6 cells");
          return row.map((cell) => boundedText(cell, 1000, "Table cell", { required: true }));
        });
        if (rows.some((row) => row.length !== rows[0].length)) throw new TypeError("Table rows must have the same number of columns");
        return { type: "table", rows };
      }
      case "link": {
        const href = safeLink(block.href);
        if (!href) throw new TypeError(`Link block ${index + 1} must use a valid HTTP, HTTPS, or email link`);
        return { type: "link", href, text: boundedText(block.text, 240, "Link text", { required: true }) };
      }
      case "image":
        if (!UUID_PATTERN.test(block.mediaId || "")) throw new TypeError(`Image block ${index + 1} must reference uploaded blog media`);
        return {
          type: "image",
          mediaId: block.mediaId,
          alt: boundedText(block.alt, 300, "Image alt text", { required: true }),
          caption: boundedText(block.caption, 500, "Image caption"),
        };
      default:
        throw new TypeError(`Content block ${index + 1} has an unsupported type`);
    }
  });
}

export function normalizeBlogPostInput(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("Article data must be an object");
  const title = boundedText(payload.title, 200, "Title", { required: !partial });
  const slugInput = boundedText(payload.slug, 120, "Slug") || (title ? slugFromTitle(title) : "");
  const slug = slugFromTitle(slugInput);
  if (!partial && !slug) throw new TypeError("A valid URL slug is required");

  const category = boundedText(payload.category, 80, "Category");
  if (category && !BLOG_CATEGORIES.includes(category)) throw new TypeError("Choose a supported aviation category");
  const content = payload.content === undefined && partial ? undefined : normalizeBlogBlocks(payload.content || []);
  const excerpt = boundedText(payload.excerpt, 500, "Excerpt");
  const firstParagraph = content?.find((block) => block.type === "paragraph")?.text || "";
  const generatedDescription = (excerpt || firstParagraph).replace(/\s+/g, " ").slice(0, 160);

  let canonicalUrl = boundedText(payload.canonical_url, 500, "Canonical URL");
  if (canonicalUrl) {
    let canonical;
    try {
      canonical = new URL(canonicalUrl, "https://operionos.com");
    } catch {
      throw new TypeError("Canonical URL must be a valid Operion URL");
    }
    if (canonical.origin !== "https://operionos.com" || canonical.pathname !== `/blog/${slug}` || canonical.search || canonical.hash) {
      throw new TypeError("Canonical URL must match this Operion blog article URL");
    }
    canonicalUrl = canonical.href;
  }

  if (payload.is_indexable !== undefined && typeof payload.is_indexable !== "boolean") {
    throw new TypeError("Indexing preference must be true or false");
  }

  const input = {
    title,
    subtitle: boundedText(payload.subtitle, 240, "Subtitle"),
    slug,
    excerpt,
    content,
    cover_image: boundedText(payload.cover_image, 80, "Cover image media ID"),
    cover_image_alt: boundedText(payload.cover_image_alt, 300, "Cover image alt text"),
    category,
    author_name: boundedText(payload.author_name, 120, "Author name"),
    author_role: boundedText(payload.author_role, 160, "Author role"),
    author_bio: boundedText(payload.author_bio, 800, "Author biography"),
    author_url: boundedText(payload.author_url, 500, "Author URL"),
    seo_title: boundedText(payload.seo_title, 100, "SEO title") || title.slice(0, 100),
    seo_description: boundedText(payload.seo_description, 200, "SEO description") || generatedDescription,
    canonical_url: canonicalUrl,
    social_title: boundedText(payload.social_title, 100, "Social title") || title.slice(0, 100),
    social_description: boundedText(payload.social_description, 200, "Social description") || generatedDescription,
    is_indexable: payload.is_indexable === undefined ? true : payload.is_indexable === true,
  };

  if (input.cover_image && !UUID_PATTERN.test(input.cover_image)) throw new TypeError("Cover image must reference uploaded blog media");
  if (input.cover_image && !input.cover_image_alt) throw new TypeError("Cover image alt text is required");
  if (input.author_url) {
    const authorUrl = safeLink(input.author_url);
    if (!authorUrl || !authorUrl.startsWith("https://")) throw new TypeError("Author URL must use HTTPS");
    input.author_url = authorUrl;
  }

  return input;
}

export function validateForPublication(article) {
  const required = [
    ["title", "Add an article title."],
    ["slug", "Add a URL slug."],
    ["excerpt", "Add a concise article summary."],
    ["category", "Choose an aviation category."],
    ["author_name", "Add editorial attribution."],
    ["seo_title", "Add an SEO title."],
    ["seo_description", "Add a meta description."],
  ];
  const missing = required.filter(([field]) => !article[field]).map(([, message]) => message);
  if (!Array.isArray(article.content) || article.content.length === 0) missing.push("Add article content.");
  if (!article.is_indexable) return missing;
  return missing;
}

export function isBlogMediaId(value) {
  return UUID_PATTERN.test(value || "");
}
