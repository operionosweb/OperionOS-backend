const SITE_URL = "https://operionos.com";

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function blogMediaUrl(mediaId, backendBase = "") {
  const path = `/api/blog/media/${encodeURIComponent(mediaId)}`;
  return backendBase ? `${backendBase.replace(/\/+$/, "")}${path}` : path;
}

export function renderBlogBlocksHtml(blocks = [], backendBase = "") {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return "";
    const text = escapeHtml(block.text || "");
    switch (block.type) {
      case "heading":
        return [2, 3].includes(Number(block.level)) ? `<h${Number(block.level)}>${text}</h${Number(block.level)}>` : "";
      case "paragraph":
        return text ? `<p>${text.replace(/\n/g, "<br>")}</p>` : "";
      case "unordered_list":
      case "ordered_list": {
        if (!Array.isArray(block.items)) return "";
        const tag = block.type === "ordered_list" ? "ol" : "ul";
        return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
      }
      case "quote":
        return `<blockquote><p>${text}</p>${block.attribution ? `<cite>${escapeHtml(block.attribution)}</cite>` : ""}</blockquote>`;
      case "table":
        if (!Array.isArray(block.rows) || block.rows.length < 2) return "";
        return `<div class="op-blog-table-wrap"><table><tbody>${block.rows.map((row, rowIndex) => {
          if (!Array.isArray(row)) return "";
          const tag = rowIndex === 0 ? "th" : "td";
          return `<tr>${row.map((cell) => `<${tag}${rowIndex === 0 ? ' scope="col"' : ""}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
        }).join("")}</tbody></table></div>`;
      case "link": {
        const href = safeLink(block.href);
        return href ? `<p><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(block.text || href)}</a></p>` : "";
      }
      case "image":
        if (!/^[0-9a-f-]{36}$/i.test(block.mediaId || "") || !block.alt) return "";
        return `<figure><img src="${escapeHtml(blogMediaUrl(block.mediaId, backendBase))}" alt="${escapeHtml(block.alt)}" loading="lazy" decoding="async">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
      default:
        return "";
    }
  }).join("\n");
}

function schemaScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function siteHeader() {
  return `<header class="op-blog-header"><a class="op-blog-brand" href="/" aria-label="Operion home">OPERION<span>AVIATION CONTRACT INTELLIGENCE</span></a><nav aria-label="Main navigation"><a href="/blog">Insights</a><a href="/aviation">Aviation</a><a href="/request-demo">Request a demo</a></nav></header>`;
}

function pageShell({ title, description, canonical, robots = "index, follow, max-image-preview:large", type = "website", image = "", socialTitle = title, socialDescription = description, articlePublished, articleModified, authorUrl, structuredData, body }) {
  const escapedImage = image ? `<meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:image" content="${escapeHtml(image)}">` : "";
  const articleMetadata = [
    articlePublished ? `<meta property="article:published_time" content="${escapeHtml(articlePublished)}">` : "",
    articleModified ? `<meta property="article:modified_time" content="${escapeHtml(articleModified)}">` : "",
    authorUrl ? `<meta property="article:author" content="${escapeHtml(authorUrl)}">` : "",
  ].join("");
  const jsonLd = structuredData ? `<script type="application/ld+json">${schemaScript(structuredData)}</script>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${escapeHtml(robots)}">
<link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:site_name" content="Operion"><meta property="og:type" content="${escapeHtml(type)}">
<meta property="og:title" content="${escapeHtml(socialTitle || title)}"><meta property="og:description" content="${escapeHtml(socialDescription || description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${escapedImage}${articleMetadata}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(socialTitle || title)}"><meta name="twitter:description" content="${escapeHtml(socialDescription || description)}">
<link rel="stylesheet" href="/blog.css"><link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">${jsonLd}</head>
<body><a class="op-blog-skip" href="#main">Skip to content</a>${siteHeader()}<main id="main">${body}</main>
<footer class="op-blog-footer"><a href="/blog">Operion Insights</a><span>Evidence-led aviation contract intelligence</span><a href="/request-demo">Talk to Operion</a></footer></body></html>`;
}

function articleSchema(post, canonical, backendBase) {
  const organizationId = `${SITE_URL}/#organization`;
  const author = post.author_url
    ? { "@type": "Person", name: post.author_name || "Operion", url: post.author_url }
    : { "@type": "Person", name: post.author_name || "Operion" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Article", "BlogPosting"],
        "@id": `${canonical}#article`,
        headline: post.title,
        description: post.seo_description || post.excerpt || "",
        articleSection: post.category || "Aviation Contract Intelligence",
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author,
        publisher: { "@type": "Organization", "@id": organizationId, name: "Operion", url: `${SITE_URL}/` },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        ...(post.cover_image ? { image: blogMediaUrl(post.cover_image, backendBase) } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonical },
        ],
      },
    ],
  };
}

export function renderBlogIndexHtml(posts = [], backendBase = "") {
  const items = posts.map((post) => {
    const url = `/blog/${encodeURIComponent(post.slug)}`;
    const cover = post.cover_image ? `<a class="op-blog-card-image" href="${url}" aria-label="Read ${escapeHtml(post.title)}"><img src="${escapeHtml(blogMediaUrl(post.cover_image, backendBase))}" alt="${escapeHtml(post.cover_image_alt || "")}" loading="lazy" decoding="async"></a>` : "";
    return `<article class="op-blog-card${cover ? " has-cover" : ""}">${cover}<div class="op-blog-card-copy"><p class="op-blog-eyebrow">${escapeHtml(post.category || "Aviation")}</p><h2><a href="${url}">${escapeHtml(post.title)}</a></h2>${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ""}<div class="op-blog-byline"><span>${escapeHtml(post.author_name || "Operion")}</span><span aria-hidden="true">·</span><time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(post.published_at ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "")}</time></div><a class="op-blog-read-more" href="${url}">Read article <span aria-hidden="true">→</span></a></div></article>`;
  }).join("");
  const body = `<div class="op-blog-page"><section class="op-blog-hero"><div class="op-blog-hero-inner"><p class="op-blog-eyebrow"><span class="op-blog-pulse" aria-hidden="true"></span>OPERION / AVIATION INTELLIGENCE</p><h1>Insights for the complexity of aviation contracts.</h1><p>Practical perspectives on aircraft leasing, contractual exposure, maintenance agreements and the decisions that keep aviation moving.</p><a class="op-blog-primary-link" href="/request-demo">Explore Operion <span aria-hidden="true">→</span></a></div><div class="op-blog-hero-mark" aria-hidden="true"><span>AVIATION</span><strong>01</strong><span>CONTRACT INTELLIGENCE</span></div></section><section class="op-blog-content" aria-labelledby="insights-heading"><div class="op-blog-section-heading"><div><p class="op-blog-eyebrow">KNOWLEDGE / FIELD NOTES</p><h2 id="insights-heading">Ideas for better decisions</h2></div><p>Clear analysis for the people responsible for aviation contracts, assets and operations.</p></div>${items ? `<div class="op-blog-grid">${items}</div>` : `<div class="op-blog-state" role="status">New aviation insights are in editorial development. Please check back soon.</div>`}</section><section class="op-blog-conversion"><div><p class="op-blog-eyebrow">OPERION / CONTRACT INTELLIGENCE</p><h2>Find the obligations, evidence and exposure that matter.</h2><p>Explore how Operion connects aviation contract terms to clear, evidence-grounded decisions.</p></div><a href="/request-demo">Talk to Operion <span aria-hidden="true">→</span></a></section></div>`;
  return pageShell({
    title: "Operion Insights | Aviation Contract Intelligence",
    description: "Evidence-led insights on aircraft leasing, aviation contract intelligence, maintenance reserves, redelivery, MRO agreements and aviation risk.",
    canonical: `${SITE_URL}/blog`,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Blog", name: "Operion Insights", url: `${SITE_URL}/blog`, publisher: { "@type": "Organization", name: "Operion", url: `${SITE_URL}/` } },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE_URL}/blog` },
        ] },
      ],
    },
    body,
  });
}

export function renderBlogArticleHtml(post, backendBase = "") {
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || "";
  const canonical = post.canonical_url || `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
  const image = post.cover_image ? blogMediaUrl(post.cover_image, backendBase) : "";
  const author = post.author_name || "Operion";
  const date = post.published_at ? new Date(post.published_at) : null;
  const modified = post.updated_at ? new Date(post.updated_at) : date;
  const displayDate = date?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) || "";
  const body = `<article class="op-blog-article-page"><nav class="op-blog-breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span><a href="/blog">Insights</a><span aria-hidden="true">›</span><span aria-current="page">${escapeHtml(post.title)}</span></nav><header class="op-blog-article-header"><p class="op-blog-eyebrow">${escapeHtml(post.category || "Aviation Contract Intelligence")}</p><h1>${escapeHtml(post.title)}</h1>${post.subtitle ? `<p class="op-blog-subtitle">${escapeHtml(post.subtitle)}</p>` : ""}${post.excerpt ? `<p class="op-blog-deck">${escapeHtml(post.excerpt)}</p>` : ""}<div class="op-blog-author"><span class="op-blog-author-mark" aria-hidden="true">${escapeHtml(author.slice(0, 1))}</span><span><strong>${escapeHtml(author)}</strong>${post.author_role ? `<small>${escapeHtml(post.author_role)}</small>` : ""}</span>${displayDate ? `<span class="op-blog-date"><time datetime="${escapeHtml(date.toISOString())}">Published ${displayDate}</time></span>` : ""}</div></header>${image ? `<figure class="op-blog-cover"><img src="${escapeHtml(image)}" alt="${escapeHtml(post.cover_image_alt || "")}" fetchpriority="high"></figure>` : ""}<div class="op-blog-prose">${renderBlogBlocksHtml(post.content, backendBase)}</div><section class="op-blog-article-cta"><p class="op-blog-eyebrow">OPERION / AVIATION CONTRACT INTELLIGENCE</p><h2>Connect contract terms to decisions.</h2><a href="/request-demo">Explore Operion <span aria-hidden="true">→</span></a></section><aside class="op-blog-editorial-note">Operion articles share industry information and product perspectives; they are not legal advice. Verify contractual interpretation with qualified advisers.</aside></article>`;
  return pageShell({
    title,
    description,
    canonical,
    robots: post.is_indexable === false ? "noindex, follow, noarchive" : "index, follow, max-image-preview:large",
    type: "article",
    image,
    socialTitle: post.social_title || title,
    socialDescription: post.social_description || description,
    articlePublished: post.published_at,
    articleModified: post.updated_at || post.published_at,
    authorUrl: post.author_url,
    structuredData: articleSchema(post, canonical, backendBase),
    body,
  });
}

export function blogSiteUrl() {
  return SITE_URL;
}
