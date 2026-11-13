import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createBlogController } from "../controllers/blogController.js";
import { requireSuperAdmin, createPlatformPermissionMiddleware, PLATFORM_PERMISSIONS, PLATFORM_ROLES } from "../middleware/superAdminMiddleware.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { createBlogRouter } from "../routes/blogRoutes.js";
import { BLOG_CATEGORIES, normalizeBlogBlocks, normalizeBlogPostInput, slugFromTitle, validateForPublication } from "../frontend/src/lib/blogContent.js";
import { articlePlainText } from "../frontend/src/lib/richText.js";
import { renderBlogArticleHtml, renderBlogBlocksHtml, renderBlogIndexHtml } from "../frontend/src/lib/blogRendering.js";
import { createCanvas } from "@napi-rs/canvas";
import blogIndex from "../frontend/api/blog/index.js";
import blogArticle from "../frontend/api/blog/[slug].js";
import blogSitemap from "../frontend/api/blog-sitemap.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const ID = "fcaabfe0-83ee-4ec5-8721-c312b9317f54";
const MEDIA_ID = "bcaabfe0-83ee-4ec5-8721-c312b9317f54";
const fixtureAuthor = async () => ({ author_id: ID, author_name: "Verified Fixture Author", author_role: "", author_bio: "", author_url: `https://operionos.com/blog/authors/${ID}`, author_avatar_media: MEDIA_ID });

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    json(value) { this.body = value; return this; },
    type(value) { this.headers["content-type"] = value; return this; },
    set(values) { Object.assign(this.headers, values); return this; },
    send(value) { this.body = value; return this; },
    redirect(code, value) { this.statusCode = code; this.location = value; return this; },
    end() { this.ended = true; return this; },
  };
}

test("blog slugs, block schemas, and publication validation are deterministic and bounded", () => {
  assert.equal(slugFromTitle("Aircraft Lease: Maintenance Reserves & Risk"), "aircraft-lease-maintenance-reserves-risk");
  assert.deepEqual(BLOG_CATEGORIES, [
    "Aircraft Leasing",
    "Aviation Contract Intelligence",
    "MRO and Maintenance Contracts",
    "Aviation Risk and Compliance",
    "Airline Supplier Contracts",
    "Predictive Contract Intelligence",
  ]);
  assert.throws(() => normalizeBlogBlocks([{ type: "link", href: "javascript:alert(1)", text: "open" }]), /valid HTTP/);
  assert.throws(() => normalizeBlogBlocks([{ type: "image", mediaId: "not-an-id", alt: "Chart" }]), /uploaded blog media/);
  assert.throws(() => normalizeBlogBlocks([{ type: "heading", level: 1, text: "Title" }]), /level 2 or 3/);
  assert.throws(() => normalizeBlogPostInput({ title: "Test", category: "Other", content: [] }), /supported aviation category/);
  assert.throws(() => normalizeBlogPostInput({ title: "Test", canonical_url: "https://attacker.example/blog/test", content: [] }), /Operion blog article/);
  assert.throws(() => normalizeBlogPostInput({
    title: "Unique canonical",
    slug: "unique-canonical",
    canonical_url: "https://operionos.com/blog/another-article",
    content: [],
  }), /match this Operion blog article URL/);
  assert.throws(() => normalizeBlogPostInput({
    title: "Canonical query",
    slug: "canonical-query",
    canonical_url: "https://operionos.com/blog/canonical-query?source=other",
    content: [],
  }), /match this Operion blog article URL/);

  const post = normalizeBlogPostInput({
    title: "Aviation Lease Terms",
    category: BLOG_CATEGORIES[0],
    author_name: "Operion Editorial",
    excerpt: "A practical guide to lease terms.",
    content: [{ type: "paragraph", text: "Grounded aviation guidance." }],
  });
  assert.equal(post.slug, "aviation-lease-terms");
  assert.equal(post.seo_title, post.title);
  assert.equal(post.seo_description, post.excerpt);
  assert.equal(post.social_description, post.excerpt);
  assert.deepEqual(validateForPublication(post), []);
  assert.deepEqual(validateForPublication({ ...post, seo_description: "" }), ["Add a meta description."]);
  assert.throws(() => normalizeBlogPostInput({ title: "Test", is_indexable: "false", content: [] }), /true or false/);
});

test("Phase 98 aviation article pack contains three substantial CMS-ready drafts", async () => {
  const pack = JSON.parse(await read("content/blog-drafts-phase98.json"));
  assert.equal(pack.format_version, 1);
  assert.equal(pack.publication_state, "draft");
  assert.equal(pack.articles.length, 3);
  assert.equal(new Set(pack.articles.map(article => article.slug)).size, 3);
  assert.equal(new Set(pack.articles.map(article => article.seo_title)).size, 3);

  for (const article of pack.articles) {
    assert.equal(article.status, "draft");
    const normalized = normalizeBlogPostInput(article);
    const wordCount = articlePlainText(normalized).trim().split(/\s+/).filter(Boolean).length;
    assert.ok(wordCount >= 350, `${article.slug} should be substantial (found ${wordCount} words)`);
    assert.deepEqual(validateForPublication({ ...normalized, author_name: "Verified Editorial Author" }), []);
    assert.equal(normalized.canonical_url, "");
  }
});

test("published article rendering is semantic, escaped, canonical, and includes BlogPosting metadata", () => {
  const html = renderBlogArticleHtml({
    title: "<script>alert(1)</script> Lease obligations",
    slug: "lease-obligations",
    category: "Aircraft Leasing",
    seo_title: "Lease obligations | Operion",
    seo_description: "Evidence-led aviation lease guidance.",
    social_title: "Lease obligations explained",
    social_description: "A grounded aviation guide.",
    canonical_url: "https://operionos.com/blog/lease-obligations",
    cover_image: MEDIA_ID,
    cover_image_alt: "Synthetic aircraft technical records",
    author_name: "Operion Editorial",
    author_role: "Aviation Contract Intelligence",
    author_url: "https://operionos.com/about",
    published_at: "2026-11-09T08:00:00.000Z",
    updated_at: "2026-11-09T08:30:00.000Z",
    is_indexable: true,
    content: [
      { type: "heading", level: 2, text: "What should a reviewer verify?" },
      { type: "paragraph", text: "Check payment evidence and contract terms. <img src=x onerror=alert(1)>" },
      { type: "link", href: "javascript:alert(2)", text: "unsafe" },
    ],
  }, "", [{
    title: "MRO agreement renewal controls",
    slug: "mro-agreement-renewal-controls",
    category: "MRO and Maintenance Contracts",
    excerpt: "Review renewal triggers and notice evidence.",
    author_name: "Operion Editorial",
    content: [{ type: "paragraph", text: "Review the executed MRO agreement." }],
  }]);

  assert.match(html, /<h1>&lt;script&gt;alert\(1\)&lt;\/script&gt; Lease obligations<\/h1>/);
  assert.match(html, /<h2>What should a reviewer verify\?<\/h2>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /<link rel="canonical" href="https:\/\/operionos\.com\/blog\/lease-obligations">/);
  assert.match(html, /<meta property="og:title" content="Lease obligations explained">/);
  assert.match(html, /<meta property="og:description" content="A grounded aviation guide\.">/);
  assert.match(html, /<meta property="og:image" content="\/api\/blog\/media\/bcaabfe0-83ee-4ec5-8721-c312b9317f54">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:description" content="A grounded aviation guide\.">/);
  assert.match(html, /<meta property="article:published_time" content="2026-11-09T08:00:00\.000Z">/);
  assert.match(html, /<meta property="article:modified_time" content="2026-11-09T08:30:00\.000Z">/);
  assert.match(html, /<meta property="article:author" content="https:\/\/operionos\.com\/about">/);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large">/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /"BlogPosting"/);
  assert.match(html, /"BreadcrumbList"/);
  assert.match(html, /<nav class="op-blog-share" aria-label="Share this article">/);
  assert.match(html, /linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2Foperionos\.com%2Fblog%2Flease-obligations/);
  assert.match(html, /twitter\.com\/intent\/tweet\?url=https%3A%2F%2Foperionos\.com%2Fblog%2Flease-obligations/);
  assert.match(html, /mailto:\?subject=%3Cscript%3Ealert\(1\)%3C%2Fscript%3E/);
  assert.match(html, /<section aria-label="Related aviation insights">[\s\S]*<div class="op-blog-grid">[\s\S]*class="op-blog-card"/);
  assert.match(html, /href="\/blog\/mro-agreement-renewal-controls"/);
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLdMatch);
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  assert.equal(jsonLd["@context"], "https://schema.org");
  assert.ok(jsonLd["@graph"].some((item) => item["@type"].includes("BlogPosting")));
  assert.ok(jsonLd["@graph"].some((item) => item["@type"] === "BreadcrumbList"));
  const article = jsonLd["@graph"].find((item) => item["@type"].includes("Article"));
  assert.equal(article.datePublished, "2026-11-09T08:00:00.000Z");
  assert.equal(article.dateModified, "2026-11-09T08:30:00.000Z");
  assert.equal(article.author.name, "Operion Editorial");
  assert.match(html, /<time datetime=/);
  assert.doesNotMatch(html, /<script type="module"/);

  const unindexed = renderBlogArticleHtml({
    title: "Private discovery article",
    slug: "private-discovery-article",
    is_indexable: false,
    content: [],
  });
  assert.match(unindexed, /noindex, follow, noarchive/);
});

test("blog index SSR exposes article text without JavaScript and media tables are responsive", async () => {
  const html = renderBlogIndexHtml([{
    title: "Maintenance reserve clauses",
    slug: "maintenance-reserve-clauses",
    category: "Aircraft Leasing",
    excerpt: "How to read a maintenance reserve clause.",
    author_name: "Operion",
    published_at: "2026-11-09T08:00:00.000Z",
    cover_image: MEDIA_ID,
    cover_image_alt: "Aircraft maintenance hangar",
  }], "https://api.operionos.com");
  assert.match(html, /<h1>Insights for the complexity of aviation contracts\.<\/h1>/);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, /<a href="\/blog\/maintenance-reserve-clauses">Maintenance reserve clauses<\/a>/);
  assert.match(html, /How to read a maintenance reserve clause/);
  assert.match(html, /src="https:\/\/api\.operionos\.com\/api\/blog\/media\/bcaabfe0-83ee-4ec5-8721-c312b9317f54"/);
  assert.match(html, /alt="Aircraft maintenance hangar"/);
  assert.match(html, /class="op-blog-card has-cover"/);
  assert.match(html, /"Blog"/);
  assert.match(renderBlogIndexHtml([{
    title: "Later maintenance article",
    slug: "later-maintenance-article",
  }], "", {}, { page: 1, page_size: 12, total: 14, has_more: true }), /class="op-blog-pagination"/);
  assert.match(renderBlogIndexHtml([{
    title: "Later maintenance article",
    slug: "later-maintenance-article",
  }], "", {}, { page: 2, page_size: 12, total: 14, has_more: false }), /href="\/blog" rel="prev"/);
  assert.match(renderBlogIndexHtml([{
    title: "Engine maintenance review",
    slug: "engine-maintenance-review",
    category: "Engine Maintenance",
    content: [],
  }]), /<option value="Engine Maintenance">Engine Maintenance<\/option>/);
  assert.match(html, /href="\/blog\.css"/);
  assert.doesNotMatch(html, /<script type="module"/);
  assert.match(renderBlogBlocksHtml([{ type: "table", rows: [["A", "B"], ["C", "D"]] }]), /op-blog-table-wrap/);
  const css = await read("frontend/public/blog.css");
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /min-width: 0/);
});

test("public blog reads filter to published articles and redirects remain local", async () => {
  const calls = [];
  const controller = createBlogController({
    database: {},
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("COUNT(*)")) return { rows: [{ total: 25 }] };
      if (sql.includes("SELECT DISTINCT category")) return { rows: [{ category: "Aircraft Leasing" }] };
      if (sql.includes("FROM blog_posts") && sql.includes("category = $1")) return { rows: [{ id: ID, status: "published", slug: "lease-guide" }] };
      if (sql.includes("FROM blog_posts") && sql.includes("WHERE slug")) return { rows: [] };
      if (sql.includes("blog_slug_redirects")) return { rows: [{ new_slug: "lease-guide" }] };
      return { rows: [] };
    },
  });

  const listingResponse = responseRecorder();
  await controller.listPublished({ query: { category: "Aircraft Leasing", page: "2", limit: "10" } }, listingResponse);
  assert.deepEqual(listingResponse.body.posts.map((post) => post.status), ["published"]);
  assert.match(calls[0].sql, /status IN \('published','scheduled'\) AND published_at<=NOW\(\) AND archived_at IS NULL/);
  assert.match(calls[0].sql.split("FROM blog_posts")[0], /\bstatus\b/);
  assert.match(calls[0].sql, /LIMIT \$4 OFFSET \$5/);
  assert.deepEqual(calls[0].params, ["Aircraft Leasing", "", null, 10, 10]);
  assert.deepEqual(listingResponse.body.categories, ["Aircraft Leasing"]);
  assert.deepEqual(listingResponse.body.pagination, { page: 2, page_size: 10, total: 25, has_more: true });

  const invalidPageResponse = responseRecorder();
  await controller.listPublished({ query: { page: "0" } }, invalidPageResponse);
  assert.equal(invalidPageResponse.statusCode, 400);
  const invalidLimitResponse = responseRecorder();
  await controller.listPublished({ query: { limit: "51" } }, invalidLimitResponse);
  assert.equal(invalidLimitResponse.statusCode, 400);

  const articleResponse = responseRecorder();
  await controller.getPublished({ params: { slug: "old-lease-guide" } }, articleResponse);
  assert.equal(articleResponse.body.redirectTo, "lease-guide");
  assert.equal(articleResponse.statusCode, 200);
});

test("public SQL projection preserves published status required by SSR privacy guards", async () => {
  const statements = [];
  const controller = createBlogController({
    database: {},
    queryFn: async (sql) => {
      statements.push(sql);
      return { rows: [{ title: "Published lease guide", slug: "published-lease-guide", status: "published", content: [] }] };
    },
  });
  const response = responseRecorder();
  await controller.getPublished({ params: { slug: "published-lease-guide" } }, response);
  assert.match(statements[0].split("FROM blog_posts")[0], /\bstatus\b/);
  assert.equal(response.body.post.status, "published");
});

test("public article recommendations prefer category, fill across categories, and exclude ineligible rows", async () => {
  const article = {
    id: ID,
    slug: "current-lease-guide",
    category: "Aircraft Leasing",
    status: "published",
    published_at: "2026-11-09T08:00:00.000Z",
  };
  const published = (id, slug, category, publishedAt = "2026-11-09T08:00:00.000Z") => ({
    id,
    slug,
    category,
    status: "published",
    published_at: publishedAt,
    cover_image: `${id.slice(0, 8)}-83ee-4ec5-8721-c312b9317f54`,
  });
  const candidates = [
    published(ID, article.slug, article.category),
    published("1caabfe0-83ee-4ec5-8721-c312b9317f51", "same-category-one", article.category),
    published("2caabfe0-83ee-4ec5-8721-c312b9317f52", "same-category-two", article.category),
    published("3caabfe0-83ee-4ec5-8721-c312b9317f53", "other-category-one", "Maintenance"),
    { ...published("4caabfe0-83ee-4ec5-8721-c312b9317f54", "draft", "Maintenance"), status: "draft" },
    published("5caabfe0-83ee-4ec5-8721-c312b9317f55", "scheduled-later", "Maintenance", "2999-01-01T00:00:00.000Z"),
    { ...published("6caabfe0-83ee-4ec5-8721-c312b9317f56", "archived", "Maintenance"), archived_at: "2026-11-09T09:00:00.000Z" },
    { ...published("7caabfe0-83ee-4ec5-8721-c312b9317f57", "without-cover", "Maintenance"), cover_image: null },
    published("3caabfe0-83ee-4ec5-8721-c312b9317f53", "other-category-one-duplicate", "Maintenance"),
  ];
  let recommendationSql = "";
  const controller = createBlogController({
    database: {},
    queryFn: async (sql) => {
      if (sql.includes("WHERE slug = $1")) return { rows: [article] };
      recommendationSql = sql;
      return { rows: candidates };
    },
  });

  const response = responseRecorder();
  await controller.getPublished({ params: { slug: article.slug } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.related.map((post) => post.slug), [
    "same-category-one",
    "same-category-two",
    "other-category-one",
  ]);
  assert.match(recommendationSql, /p\.status IN \('published','scheduled'\) AND p\.published_at<=NOW\(\) AND p\.archived_at IS NULL/);
  assert.match(recommendationSql, /p\.cover_image IS NOT NULL AND EXISTS \(SELECT 1 FROM blog_media/);
  assert.match(recommendationSql, /ORDER BY CASE WHEN p\.category IS NOT DISTINCT FROM \$1 THEN 0 ELSE 1 END/);
  assert.match(recommendationSql, /LIMIT 3/);
});

test("public media remains unavailable until referenced by a current published article", async () => {
  let statement = "";
  const controller = createBlogController({
    database: {},
    queryFn: async (sql) => { statement = sql; return { rows: [] }; },
  });
  const response = responseRecorder();
  await controller.publicMedia({ params: { id: MEDIA_ID } }, response);
  assert.equal(response.statusCode, 404);
  assert.match(statement, /status IN \('published','scheduled'\) AND p\.published_at<=NOW\(\) AND p\.archived_at IS NULL/);
  assert.match(statement, /p\.cover_image=m\.id::text OR p\.author_avatar_media=m\.id OR p\.content @>/);
});

test("CMS draft, edit, publish, unpublish, archive, and restore lifecycle keeps drafts private", async () => {
  let post = null;
  const auditActions = [];
  const controller = createBlogController({
    database: {},
    authorResolver: fixtureAuthor,
    queryFn: async (sql, params = []) => {
      if (sql.includes("FROM blog_posts") && sql.includes("FOR UPDATE")) {
        return { rows: post ? [{ ...post }] : [] };
      }
      if (sql.startsWith("INSERT INTO blog_posts")) {
        post = {
          id: ID,
          title: params[0],
          subtitle: params[1],
          slug: params[2],
          excerpt: params[3],
          content: JSON.parse(params[4]),
          cover_image: params[5],
          cover_image_alt: params[6],
          category: params[7],
          seo_title: params[8],
          seo_description: params[9],
          canonical_url: params[10],
          social_title: params[11],
          social_description: params[12],
          author_name: params[13],
          author_role: params[14],
          author_bio: params[15],
          author_url: params[16],
          is_indexable: params[17],
          status: "draft",
          created_by: params[18],
          updated_by: params[18],
          published_at: null,
          archived_at: null,
          updated_at: "2030-01-01T10:00:00.000Z",
        };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("UPDATE blog_posts SET") && sql.includes("title=$1")) {
        post = {
          ...post,
          title: params[0],
          subtitle: params[1],
          slug: params[2],
          excerpt: params[3],
          content: JSON.parse(params[4]),
          cover_image: params[5],
          cover_image_alt: params[6],
          category: params[7],
          seo_title: params[8],
          seo_description: params[9],
          canonical_url: params[10],
          social_title: params[11],
          social_description: params[12],
          author_name: params[13],
          author_role: params[14],
          author_bio: params[15],
          author_url: params[16],
          is_indexable: params[17],
          updated_by: params[18],
        };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("UPDATE blog_posts SET status='published'")) {
        post = { ...post, status: "published", published_at: post.published_at || "2026-11-09T12:00:00.000Z", archived_at: null };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("UPDATE blog_posts SET status='draft'") && sql.includes("status IN ('published','scheduled')")) {
        post = { ...post, status: "draft" };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("UPDATE blog_posts SET status='archived'")) {
        post = { ...post, status: "archived", archived_at: "2026-11-09T12:00:00.000Z" };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("UPDATE blog_posts SET status='draft'") && sql.includes("status='archived'")) {
        post = { ...post, status: "draft", archived_at: null };
        return { rows: [{ ...post }] };
      }
      if (sql.includes("FROM blog_posts") && sql.includes("WHERE slug = $1")) {
        return { rows: post?.slug === params[0] && post.status === "published" && !post.archived_at ? [{ ...post }] : [] };
      }
      if (sql.includes("FROM blog_posts") && sql.includes("WHERE id = $1")) {
        return { rows: post?.id === params[0] ? [{ ...post }] : [] };
      }
      if (sql.includes("INSERT INTO blog_post_audit")) {
        auditActions.push(sql.match(/'([a-z_]+)'/)?.[1]);
        return { rows: [] };
      }
      if (sql.includes("FROM blog_slug_redirects")) return { rows: [] };
      return { rows: [] };
    },
  });
  const articleInput = {
    title: "Aircraft lease obligations",
    excerpt: "A practical guide to reviewing aviation lease terms.",
    category: "Aircraft Leasing",
    author_name: "Operion Editorial",
    content: [{ type: "paragraph", text: "Check each obligation against its clause and evidence." }],
  };
  const request = (body = articleInput) => ({ body: { ...body, expected_updated_at: "2030-01-01T10:00:00.000Z" }, user: { id: ID }, params: { id: ID }, query: {} });

  const created = responseRecorder();
  await controller.create(request(), created);
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.post.status, "draft");
  assert.equal(created.body.post.slug, "aircraft-lease-obligations");

  const hiddenBeforePublish = responseRecorder();
  await controller.getPublished({ params: { slug: post.slug } }, hiddenBeforePublish);
  assert.equal(hiddenBeforePublish.statusCode, 404);

  const edited = responseRecorder();
  await controller.update(request({
    ...articleInput,
    excerpt: "Updated: a practical guide to reviewing aviation lease terms.",
    content: [{ type: "paragraph", text: "Compare each obligation with its executed clause and evidence." }],
  }), edited);
  assert.equal(edited.statusCode, 200);
  assert.match(edited.body.post.excerpt, /^Updated:/);
  assert.equal(edited.body.post.status, "draft");

  const published = responseRecorder();
  await controller.publish(request({ confirm_review: true }), published);
  assert.equal(published.statusCode, 200);
  assert.equal(published.body.post.status, "published");
  const visibleAfterPublish = responseRecorder();
  await controller.getPublished({ params: { slug: post.slug } }, visibleAfterPublish);
  assert.equal(visibleAfterPublish.body.post.status, "published");

  const unpublished = responseRecorder();
  await controller.unpublish(request(), unpublished);
  assert.equal(unpublished.body.post.status, "draft");
  const hiddenAfterUnpublish = responseRecorder();
  await controller.getPublished({ params: { slug: post.slug } }, hiddenAfterUnpublish);
  assert.equal(hiddenAfterUnpublish.statusCode, 404);

  const editedAfterUnpublish = responseRecorder();
  await controller.update(request({
    ...articleInput,
    title: "Reviewed aircraft lease obligations",
    excerpt: "Reviewed: a practical guide to aviation lease terms.",
    content: [{ type: "paragraph", text: "Recheck the reviewed terms against the executed clause and evidence." }],
  }), editedAfterUnpublish);
  assert.equal(editedAfterUnpublish.statusCode, 200);
  assert.equal(editedAfterUnpublish.body.post.status, "draft");
  assert.match(editedAfterUnpublish.body.post.title, /^Reviewed/);

  const republished = responseRecorder();
  await controller.publish(request({ confirm_review: true }), republished);
  assert.equal(republished.body.post.status, "published");
  const archived = responseRecorder();
  await controller.archive(request(), archived);
  assert.equal(archived.body.post.status, "archived");
  const hiddenAfterArchive = responseRecorder();
  await controller.getPublished({ params: { slug: post.slug } }, hiddenAfterArchive);
  assert.equal(hiddenAfterArchive.statusCode, 404);

  const restored = responseRecorder();
  await controller.restore(request(), restored);
  assert.equal(restored.body.post.status, "draft");
  const hiddenAfterRestore = responseRecorder();
  await controller.getPublished({ params: { slug: post.slug } }, hiddenAfterRestore);
  assert.equal(hiddenAfterRestore.statusCode, 404);
  assert.deepEqual(auditActions, [
    "created",
    "updated",
    "published",
    "unpublished",
    "updated",
    "published",
    "archived",
    "restored_to_draft",
  ]);
});

test("slug updates preserve redirects without creating redirect cycles", async () => {
  const calls = [];
  const controller = createBlogController({
    database: {},
    authorResolver: fixtureAuthor,
    queryFn: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("FOR UPDATE")) return { rows: [{ id: ID, status: "draft", slug: "lease-old", updated_at: "2030-01-01T10:00:00.000Z" }] };
      if (sql.includes("UPDATE blog_posts SET")) return { rows: [{ id: ID, status: "draft", slug: "lease-new" }] };
      return { rows: [] };
    },
  });
  const response = responseRecorder();
  await controller.update({
    params: { id: ID },
    user: { id: ID },
    body: {
      title: "Aircraft lease obligations",
      slug: "lease-new",
      expected_updated_at: "2030-01-01T10:00:00.000Z",
      excerpt: "Evidence-led guide to the lease.",
      category: "Aircraft Leasing",
      author_name: "Operion Editorial",
      content: [{ type: "paragraph", text: "Review source terms." }],
    },
  }, response);
  assert.equal(response.statusCode, 200);
  const redirectChanges = calls.filter(({ sql }) => sql.includes("blog_slug_redirects"));
  assert.match(redirectChanges[0].sql, /DELETE FROM blog_slug_redirects WHERE old_slug = \$1/);
  assert.deepEqual(redirectChanges[0].params, ["lease-new"]);
  assert.match(redirectChanges[1].sql, /UPDATE blog_slug_redirects SET new_slug = \$1/);
  assert.deepEqual(redirectChanges[1].params, ["lease-new", ID, "lease-old"]);
  assert.match(redirectChanges[2].sql, /INSERT INTO blog_slug_redirects/);
  assert.deepEqual(redirectChanges[2].params, ["lease-old", "lease-new", ID]);
});

test("CMS image uploads reject invalid images and store resized WebP with alt text", async () => {
  const statements = [];
  const controller = createBlogController({
    database: {},
    queryFn: async (sql, params) => {
      statements.push({ sql, params });
      return { rows: [] };
    },
  });
  const invalidResponse = responseRecorder();
  await controller.uploadMedia({
    file: { buffer: Buffer.from("not an image") },
    body: { alt_text: "Aircraft at gate" },
    user: { id: ID },
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 415);

  const source = createCanvas(2200, 1000).toBuffer("image/png");
  const response = responseRecorder();
  await controller.uploadMedia({
    file: { buffer: source },
    body: { alt_text: "Aircraft at the terminal" },
    user: { id: ID },
  }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.media.mime_type, "image/webp");
  assert.equal(response.body.media.alt_text, "Aircraft at the terminal");
  assert.equal(statements[0].params[1], "image/webp");
  assert.equal(statements[0].params[2].toString("ascii", 8, 12), "WEBP");
  assert.ok(statements[0].params[2].length < source.length);

  const oversized = Buffer.alloc(3 * 1024 * 1024 + 1);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized);
  const oversizedResponse = responseRecorder();
  await controller.uploadMedia({
    file: { buffer: oversized },
    body: { alt_text: "Oversized synthetic image" },
    user: { id: ID },
  }, oversizedResponse);
  assert.equal(oversizedResponse.statusCode, 413);
});

test("Super Admin authentication and permission middleware wrap every CMS operation", async () => {
  const authenticate = (_req, _res, next) => next();
  const authorize = (_req, _res, next) => next();
  const controller = Object.fromEntries([
    "listPublished", "getPublished", "sitemap", "publicMedia", "listAdmin", "listCategories", "createCategory", "getAdmin",
    "updateCategory", "deleteCategory",
    "create", "update", "publish", "unpublish", "archive", "restore", "history",
    "uploadMedia", "adminMedia", "authorPage", "profile", "updateProfile", "mediaLibrary", "schedule", "analyze", "deleteArchived",
  ].map((key) => [key, () => {}]));
  const router = createBlogRouter({ controller, authenticate, authorize });
  const adminLayer = router.stack.find((layer) => layer.name === "router");
  assert.ok(adminLayer, "admin router is mounted");
  assert.equal(adminLayer.handle.stack[0].handle, authenticate);
  assert.equal(adminLayer.handle.stack[1].handle, authorize);
  assert.equal(requireSuperAdmin.name, "requirePlatformPermission");
  const productionRouter = createBlogRouter();
  const productionAdminLayer = productionRouter.stack.find((layer) => layer.name === "router");
  assert.equal(productionAdminLayer.handle.stack[0].handle, authenticateUser);
  assert.equal(productionAdminLayer.handle.stack[1].handle, requireSuperAdmin);
  assert.ok(adminLayer.handle.stack.some(layer => layer.route?.path === "/categories" && layer.route.methods.get));
  assert.ok(adminLayer.handle.stack.some(layer => layer.route?.path === "/categories" && layer.route.methods.post));
  assert.ok(adminLayer.handle.stack.some(layer => layer.route?.path === "/categories/:id" && layer.route.methods.put));
  assert.ok(adminLayer.handle.stack.some(layer => layer.route?.path === "/categories/:id" && layer.route.methods.delete));
  assert.ok(router.stack.some((layer) => layer.route?.path === "/"));
  assert.ok(router.stack.some((layer) => layer.route?.path === "/:slug"));
  assert.equal(router.stack.find((layer) => layer.route?.path === "/:slug").route.methods.get, true);

  let anonymousNext = false;
  const anonymousResponse = responseRecorder();
  await authenticateUser({ headers: {} }, anonymousResponse, () => { anonymousNext = true; });
  assert.equal(anonymousNext, false);
  assert.equal(anonymousResponse.statusCode, 401);

  const access = createPlatformPermissionMiddleware(
    PLATFORM_PERMISSIONS.PLATFORM_ADMIN,
    async (_sql, [userId]) => ({ rows: userId === ID ? [{ role: PLATFORM_ROLES.SUPERADMIN }] : [{ role: "OPERION_ANALYST" }] })
  );
  const invoke = async (userId) => {
    const res = responseRecorder();
    let allowed = false;
    await access({ user: { id: userId } }, res, () => { allowed = true; });
    return { res, allowed };
  };
  assert.equal((await invoke(ID)).allowed, true);
  const denied = await invoke(MEDIA_ID);
  assert.equal(denied.allowed, false);
  assert.equal(denied.res.statusCode, 403);
});

test("SEO routing serves crawler-readable pages and generated published-only sitemap", async () => {
  const config = JSON.parse(await read("frontend/vercel.json"));
  assert.ok(config.rewrites.some((rule) => rule.source === "/blog" && rule.destination === "/api/blog"));
  assert.ok(config.rewrites.some((rule) => rule.source === "/blog/:slug" && rule.destination === "/api/blog/:slug"));
  assert.ok(config.rewrites.some((rule) => rule.source === "/sitemap.xml" && rule.destination === "/api/blog-sitemap"));
  assert.equal(config.rewrites.at(-1).destination, "/index.html");

  const robots = await read("frontend/public/robots.txt");
  assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \/blog/);
  assert.match(robots, /User-agent: PerplexityBot\s+Allow: \/blog/);
  assert.match(robots, /User-agent: GPTBot\s+Disallow: \//);
  assert.match(robots, /Disallow: \/app/);
  assert.match(robots, /Sitemap: https:\/\/operionos\.com\/sitemap\.xml/);

  let sql = "";
  const controller = createBlogController({
    database: {},
    queryFn: async (statement) => { sql = statement; return { rows: [{ slug: "published-guide", lastmod: "2026-11-09T00:00:00.000Z" }] }; },
  });
  const response = responseRecorder();
  await controller.sitemap({}, response);
  assert.match(sql, /status IN \('published','scheduled'\) AND published_at<=NOW\(\) AND archived_at IS NULL AND is_indexable = TRUE/);
  assert.match(response.body, /https:\/\/operionos\.com\/blog\/published-guide/);
  assert.doesNotMatch(response.body, /\/app\//);
});

test("Vercel SSR handlers render public articles and sitemap from the published API", async (t) => {
  const previousBackend = process.env.OPERION_BACKEND_URL;
  const previousFetch = globalThis.fetch;
  process.env.OPERION_BACKEND_URL = "https://api.operionos.com/";
  const article = {
    id: ID,
    title: "Aircraft lease payment obligations",
    slug: "aircraft-lease-payment-obligations",
    category: "Aircraft Leasing",
    excerpt: "Evidence-led guidance for lease payment terms.",
    author_name: "Operion Editorial",
    published_at: "2026-11-09T08:00:00.000Z",
    is_indexable: true,
    status: "published",
    content: [{ type: "paragraph", text: "Verify the amount, currency, due date, and triggering clause." }],
  };
  const recommendations = [1, 2, 3].map((number) => ({
    id: `${number}caabfe0-83ee-4ec5-8721-c312b9317f5${number}`,
    title: `Recommended aviation article ${number}`,
    slug: `recommended-aviation-article-${number}`,
    category: number === 1 ? article.category : "Maintenance",
    excerpt: `Evidence-led recommendation ${number}.`,
    author_name: "Operion Editorial",
    status: "published",
    published_at: "2026-11-08T08:00:00.000Z",
    cover_image: `${number}baabfe0-83ee-4ec5-8721-c312b9317f5${number}`,
    cover_image_alt: `Synthetic aviation image ${number}`,
    content: [{ type: "paragraph", text: `Review the evidence for recommendation ${number}.` }],
  }));
  const relatedWithIneligible = [
    ...recommendations,
    article,
    { ...recommendations[0], slug: "private-recommendation", status: "draft" },
    { ...recommendations[1], slug: "future-recommendation", published_at: "2999-01-01T00:00:00.000Z" },
    { ...recommendations[2], slug: "recommendation-without-image", cover_image: null },
    recommendations[0],
  ];
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (new URL(String(url)).pathname === "/api/blog") {
      return { ok: true, json: async () => ({ posts: [
        article,
        { ...article, slug: "unpublished-draft", status: "draft", title: "Private draft must not appear" },
        { ...article, slug: "archived-article", status: "archived", archived_at: "2026-11-09T09:00:00.000Z" },
      ] }) };
    }
    if (String(url).endsWith(`/api/blog/${article.slug}`)) {
      return { ok: true, json: async () => ({ post: article, related: relatedWithIneligible }) };
    }
    if (String(url).endsWith("/api/blog/fewer-eligible-articles")) {
      return { ok: true, json: async () => ({ post: { ...article, slug: "fewer-eligible-articles" }, related: recommendations.slice(0, 2) }) };
    }
    if (String(url).endsWith("/api/blog/private-draft")) {
      return { ok: true, json: async () => ({ post: { ...article, status: "draft" } }) };
    }
    if (String(url).endsWith("/api/blog/sitemap.xml")) {
      return { ok: true, text: async () => "<?xml version=\"1.0\"?><urlset></urlset>" };
    }
    throw new Error("Unexpected SSR backend request.");
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousBackend === undefined) delete process.env.OPERION_BACKEND_URL;
    else process.env.OPERION_BACKEND_URL = previousBackend;
  });

  const listing = responseRecorder();
  await blogIndex({ method: "GET" }, listing);
  assert.equal(listing.statusCode, 200);
  assert.match(listing.body, /Aircraft lease payment obligations/);
  assert.doesNotMatch(listing.body, /Private draft must not appear|archived-article/);
  assert.equal(listing.headers["content-type"], "text/html; charset=utf-8");

  const filteredListing = responseRecorder();
  await blogIndex({ method: "GET", query: { search: "lease terms", category: "Aircraft Leasing", tag: "renewal", page: "2", limit: "10" } }, filteredListing);
  assert.equal(filteredListing.statusCode, 200);
  assert.ok(requests.some(url => url.includes("/api/blog?search=lease+terms&category=Aircraft+Leasing&tag=renewal&page=2&limit=10")));
  assert.match(filteredListing.body, /name="search" value="lease terms"/);
  assert.match(filteredListing.body, /<option value="Aircraft Leasing" selected>/);

  const detail = responseRecorder();
  await blogArticle({ method: "GET", query: { slug: article.slug } }, detail);
  assert.equal(detail.statusCode, 200);
  assert.match(detail.body, /Verify the amount, currency, due date/);
  assert.equal((detail.body.match(/class="op-blog-card(?:\s|")/g) || []).length, 3);
  for (const recommendation of recommendations) {
    assert.match(detail.body, new RegExp(`href="/blog/${recommendation.slug}"`));
    assert.match(detail.body, new RegExp(`/api/blog/media/${recommendation.cover_image}`));
  }
  assert.doesNotMatch(detail.body, /private-recommendation|future-recommendation|recommendation-without-image/);

  const fewerRecommendations = responseRecorder();
  await blogArticle({ method: "GET", query: { slug: "fewer-eligible-articles" } }, fewerRecommendations);
  assert.equal(fewerRecommendations.statusCode, 200);
  assert.equal((fewerRecommendations.body.match(/class="op-blog-card(?:\s|")/g) || []).length, 2);

  const draftDetail = responseRecorder();
  await blogArticle({ method: "GET", query: { slug: "private-draft" } }, draftDetail);
  assert.equal(draftDetail.statusCode, 404);
  assert.equal(draftDetail.body, "Article not found.");

  const sitemap = responseRecorder();
  await blogSitemap({ method: "GET" }, sitemap);
  assert.equal(sitemap.statusCode, 200);
  assert.match(sitemap.body, /<urlset/);
  assert.equal(requests.length, 6);

  const unsupportedMethod = responseRecorder();
  await blogSitemap({ method: "POST" }, unsupportedMethod);
  assert.equal(unsupportedMethod.statusCode, 405);
  assert.equal(unsupportedMethod.headers.allow, "GET");
});
