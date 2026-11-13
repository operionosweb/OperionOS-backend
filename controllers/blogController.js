import crypto from "node:crypto";
import { getSupabaseClient } from "../config/supabase.js";
import { resolveAuthor, createEditorialAnalyzer, articleRevision } from "../services/blogEditorialService.js";
import { query, default as pool } from "../db.js";
import {
  BLOG_CATEGORIES,
  normalizeBlogCategory,
  normalizeBlogPostInput,
  validateForPublication,
} from "../frontend/src/lib/blogContent.js";
import { isPublicArticle } from "../frontend/src/lib/richText.js";

const SITE_URL = "https://operionos.com";
const PUBLIC_POST_FIELDS = `
  id, title, subtitle, slug, excerpt, content, cover_image, cover_image_alt,
  category, seo_title, seo_description, canonical_url, social_title,
  social_description, author_name, author_role, author_bio, author_url,
  is_indexable, status, published_at, created_at, updated_at,
  author_id, author_avatar_media, tags, is_featured
`;
const ADMIN_POST_FIELDS = `${PUBLIC_POST_FIELDS}, created_by, updated_by, archived_at, ai_analysis`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function errorResponse(res, error, operation) {
  if (error?.code === "23505") {
    if (["create_category", "update_category"].includes(operation)) return res.status(409).json({ success: false, error: "A category with this name or slug already exists." });
    return res.status(409).json({ success: false, error: "That article URL is already in use." });
  }
  if (error?.code === "23503" && operation === "delete_category") {
    return res.status(409).json({ success: false, error: "This category is assigned to an article and cannot be deleted." });
  }
  const status = Number.isInteger(error?.status) ? error.status : error instanceof TypeError || error instanceof RangeError ? 400 : ["DATABASE_NOT_CONFIGURED", "42P01", "42703"].includes(error?.code) ? 503 : 500;
  if (status >= 500) console.error("blog_operation_failed", { operation, code: error?.code || "BLOG_REQUEST_FAILED" });
  return res.status(status).json({
    success: false,
    error: operation === "ai_analyze" && status >= 500
      ? "AI analysis is unavailable. No score was generated or saved; retry after the provider or database is available."
      : status >= 500 ? "Blog service is unavailable." : error.message,
  });
}

function withRequest(operation, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorResponse(res, error, operation);
    }
  };
}

async function transaction(database, queryFn, callback) {
  if (typeof database.connect !== "function") return callback(queryFn);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client.query.bind(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function requiredId(value, label) {
  if (!UUID_PATTERN.test(value || "")) throw httpError(400, `${label} is invalid.`);
  return value;
}
function assertRevision(body, current) {
  const expected = typeof body?.expected_updated_at === "string" ? Date.parse(body.expected_updated_at) : NaN;
  const actual = new Date(current.updated_at).getTime();
  if (!Number.isFinite(expected) || expected !== actual) throw httpError(409, "This article changed or its saved revision is missing. Reload and review before continuing.");
}

function imageMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function optimizeBlogImage(buffer) {
  let image;
  try {
    const { loadImage } = await import("@napi-rs/canvas");
    image = await loadImage(buffer);
  } catch {
    throw httpError(415, "The image could not be decoded.");
  }
  if (!image.width || !image.height || image.width * image.height > 24_000_000) {
    throw httpError(413, "Images must be no larger than 24 megapixels.");
  }
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return canvas.toBuffer("image/webp", 82);
}

function mediaIdsFor(article) {
  return [...new Set([
    article.cover_image,
    ...(Array.isArray(article.content) ? article.content.filter((block) => block.type === "image").map((block) => block.mediaId) : []),
  ].filter(Boolean))];
}

async function assertMediaExists(queryFn, ids) {
  if (!ids.length) return;
  const result = await queryFn("SELECT id FROM blog_media WHERE id = ANY($1::uuid[])", [ids]);
  if (result.rows.length !== ids.length) throw httpError(400, "One or more selected images are unavailable.");
}

function auditSnapshot(row, actorId, action) {
  return [
    row?.id || null,
    actorId,
    action,
    JSON.stringify(row || {}),
  ];
}

export function createBlogController({ queryFn = query, database = pool, authorResolver = resolveAuthor, analyzer = createEditorialAnalyzer(), authClient = getSupabaseClient } = {}) {
  const runTransaction = (callback) => transaction(database, queryFn, callback);
  const normalizeArticle = async (value) => {
    const result = await queryFn("SELECT name FROM blog_categories ORDER BY name");
    const allowedCategories = [...new Set([...BLOG_CATEGORIES, ...result.rows.map((row) => row.name)])];
    return normalizeBlogPostInput(value, { allowedCategories });
  };

  const listPublished = withRequest("list_published", async (req, res) => {
    const values = [req.query.category || null, String(req.query.search || "").slice(0, 160), req.query.tag || null];
    const pageValue = req.query.page === undefined ? 1 : Number(req.query.page);
    const pageSizeValue = req.query.limit === undefined ? 12 : Number(req.query.limit);
    if (!Number.isSafeInteger(pageValue) || pageValue < 1 || pageValue > 100000) throw httpError(400, "Page must be a positive integer.");
    if (!Number.isSafeInteger(pageSizeValue) || pageSizeValue < 1 || pageSizeValue > 50) throw httpError(400, "Page size must be between 1 and 50.");
    const offset = (pageValue - 1) * pageSizeValue;
    const result = await queryFn(
      `SELECT ${PUBLIC_POST_FIELDS}
       FROM blog_posts
       WHERE status IN ('published','scheduled') AND published_at<=NOW() AND archived_at IS NULL
         AND ($1::text IS NULL OR category = $1)
         AND ($2='' OR position(lower($2) in lower(title||' '||coalesce(excerpt,'')))>0)
         AND ($3::text IS NULL OR $3=ANY(tags))
       ORDER BY is_featured DESC,published_at DESC, id DESC LIMIT $4 OFFSET $5`,
      [...values, pageSizeValue, offset]
    );
    const [count, categoryResult] = await Promise.all([
      queryFn(
        `SELECT COUNT(*)::int AS total FROM blog_posts
         WHERE status IN ('published','scheduled') AND published_at<=NOW() AND archived_at IS NULL
           AND ($1::text IS NULL OR category = $1)
           AND ($2='' OR position(lower($2) in lower(title||' '||coalesce(excerpt,'')))>0)
           AND ($3::text IS NULL OR $3=ANY(tags))`,
        values
      ),
      queryFn(
        `SELECT DISTINCT category FROM blog_posts
         WHERE status IN ('published','scheduled') AND published_at<=NOW() AND archived_at IS NULL
           AND category IS NOT NULL ORDER BY category`
      ),
    ]);
    const total = Number(count.rows[0]?.total || 0);
    return res.json({
      success: true,
      posts: result.rows,
      categories: categoryResult.rows.map(({ category }) => category),
      pagination: {
        page: pageValue,
        page_size: pageSizeValue,
        total,
        has_more: offset + result.rows.length < total,
      },
    });
  });

  const getPublished = withRequest("get_published", async (req, res) => {
    const result = await queryFn(
      `SELECT ${PUBLIC_POST_FIELDS} FROM blog_posts
       WHERE slug = $1 AND status IN ('published','scheduled') AND published_at<=NOW() AND archived_at IS NULL LIMIT 1`,
      [req.params.slug]
    );
    if (result.rows[0]) {
      const post = result.rows[0];
      const related = await queryFn(
        `SELECT ${PUBLIC_POST_FIELDS} FROM blog_posts p
         WHERE p.id<>$2 AND p.status IN ('published','scheduled') AND p.published_at<=NOW() AND p.archived_at IS NULL
           AND p.cover_image IS NOT NULL AND EXISTS (SELECT 1 FROM blog_media m WHERE m.id::text=p.cover_image)
         ORDER BY CASE WHEN p.category IS NOT DISTINCT FROM $1 THEN 0 ELSE 1 END,
           p.published_at DESC, p.id DESC
         LIMIT 3`,
        [post.category, post.id]
      );
      const seen = new Set([post.id]);
      const recommendations = related.rows.filter((article) => {
        if (!article || seen.has(article.id) || !article.cover_image || !isPublicArticle(article)) return false;
        seen.add(article.id);
        return true;
      }).slice(0, 3);
      return res.json({ success: true, post, related: recommendations });
    }

    const redirect = await queryFn(
      "SELECT new_slug FROM blog_slug_redirects WHERE old_slug = $1 LIMIT 1",
      [req.params.slug]
    );
    if (redirect.rows[0]) return res.json({ success: true, redirectTo: redirect.rows[0].new_slug });
    return res.status(404).json({ success: false, error: "Article not found." });
  });

  const sitemap = withRequest("sitemap", async (_req, res) => {
    const result = await queryFn(
      `SELECT slug, GREATEST(updated_at, published_at) AS lastmod
       FROM blog_posts
       WHERE status IN ('published','scheduled') AND published_at<=NOW() AND archived_at IS NULL AND is_indexable = TRUE
       ORDER BY published_at DESC`
    );
    const staticPaths = [
      "/", "/product", "/resources", "/intelligence", "/aviation", "/how-it-works",
      "/security", "/request-demo", "/privacy", "/legal", "/solutions", "/scenarios",
      "/enterprise", "/about", "/demo/dashboard", "/demo/contracts",
      "/demo/contracts/demo-aircraft-lease/financial-impact", "/demo/upload",
      "/demo/intelligence", "/demo/live-tracking", "/blog",
    ];
    const urls = staticPaths.map((pathname) => `<url><loc>${SITE_URL}${pathname}</loc></url>`);
    for (const post of result.rows) {
      const lastmod = post.lastmod ? new Date(post.lastmod).toISOString().slice(0, 10) : "";
      urls.push(`<url><loc>${SITE_URL}/blog/${encodeURIComponent(post.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
    }
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  });

  const listAdmin = withRequest("list_admin", async (_req, res) => {
    const result = await queryFn(
      `SELECT ${ADMIN_POST_FIELDS} FROM blog_posts ORDER BY updated_at DESC, id DESC`
    );
    return res.json({ success: true, posts: result.rows });
  });

  const listCategories = withRequest("list_categories", async (_req, res) => {
    const result = await queryFn(
      "SELECT id,name,slug,description,created_at FROM blog_categories ORDER BY lower(name),name"
    );
    return res.json({ success: true, categories: result.rows });
  });

  const createCategory = withRequest("create_category", async (req, res) => {
    const category = normalizeBlogCategory(req.body);
    const duplicate = await queryFn(
      "SELECT id FROM blog_categories WHERE lower(name)=lower($1) OR slug=$2 LIMIT 1",
      [category.name, category.slug]
    );
    if (duplicate.rows.length) throw httpError(409, "A category with this name or slug already exists.");
    const result = await runTransaction(async (execute) => {
      const inserted = await execute(
        `INSERT INTO blog_categories (name,slug,description,created_by)
         VALUES ($1,$2,$3,$4)
         RETURNING id,name,slug,description,created_at`,
        [category.name, category.slug, category.description, req.user.id]
      );
      return inserted.rows[0];
    });
    return res.status(201).json({ success: true, category: result });
  });

  const updateCategory = withRequest("update_category", async (req, res) => {
    const id = requiredId(req.params.id, "Category ID");
    const category = normalizeBlogCategory(req.body);
    const updated = await runTransaction(async (execute) => {
      const currentResult = await execute(
        "SELECT id,name FROM blog_categories WHERE id=$1 FOR UPDATE",
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError(404, "Category not found.");
      const duplicate = await execute(
        `SELECT id FROM blog_categories
         WHERE id<>$3 AND (lower(name)=lower($1) OR slug=$2) LIMIT 1`,
        [category.name, category.slug, id]
      );
      if (duplicate.rows.length) throw httpError(409, "A category with this name or slug already exists.");
      const result = await execute(
        `UPDATE blog_categories SET name=$1,slug=$2,description=$3
         WHERE id=$4 RETURNING id,name,slug,description,created_at`,
        [category.name, category.slug, category.description, id]
      );
      return { previousName: current.name, category: result.rows[0] };
    });
    return res.json({ success: true, category: updated.category, previous_name: updated.previousName });
  });

  const deleteCategory = withRequest("delete_category", async (req, res) => {
    const id = requiredId(req.params.id, "Category ID");
    const deleted = await runTransaction(async (execute) => {
      const currentResult = await execute(
        "SELECT id,name FROM blog_categories WHERE id=$1 FOR UPDATE",
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError(404, "Category not found.");
      const usage = await execute(
        "SELECT 1 FROM blog_posts WHERE category=$1 LIMIT 1",
        [current.name]
      );
      if (usage.rows.length) throw httpError(409, "This category is assigned to an article and cannot be deleted.");
      const result = await execute(
        "DELETE FROM blog_categories WHERE id=$1 RETURNING id,name",
        [id]
      );
      if (!result.rows[0]) throw httpError(404, "Category not found.");
      return result.rows[0];
    });
    return res.json({ success: true, category: deleted });
  });

  const getAdmin = withRequest("get_admin", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const result = await queryFn(
      `SELECT ${ADMIN_POST_FIELDS} FROM blog_posts WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: "Article not found." });
    return res.json({ success: true, post: result.rows[0] });
  });

  const create = withRequest("create", async (req, res) => {
    const article = await normalizeArticle(req.body);
    const actorId = req.user.id;
    await assertMediaExists(queryFn, mediaIdsFor(article));
    const result = await runTransaction(async (execute) => {
      Object.assign(article, await authorResolver(execute, actorId));
      const inserted = await execute(
        `INSERT INTO blog_posts (
          title, subtitle, slug, excerpt, content, cover_image, cover_image_alt,
          category, seo_title, seo_description, canonical_url, social_title,
          social_description, author_name, author_role, author_bio, author_url,
          is_indexable, status, created_by, updated_by,author_id,author_avatar_media,tags,is_featured
        ) VALUES (
          $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',$19,$19,$20,$21,$22,$23
        ) RETURNING ${ADMIN_POST_FIELDS}`,
        [
          article.title, article.subtitle || null, article.slug, article.excerpt || null,
          JSON.stringify(article.content), article.cover_image || null, article.cover_image_alt || null,
          article.category || null, article.seo_title || null, article.seo_description || null,
          article.canonical_url || null, article.social_title || null, article.social_description || null,
          article.author_name || null, article.author_role || null, article.author_bio || null,
          article.author_url || null, article.is_indexable, actorId,article.author_id,article.author_avatar_media,article.tags || [],article.is_featured || false,
        ]
      );
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'created',$3::jsonb)`,
        [inserted.rows[0].id, actorId, JSON.stringify(inserted.rows[0])]
      );
      return inserted.rows[0];
    });
    return res.status(201).json({ success: true, post: result });
  });

  const update = withRequest("update", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const article = await normalizeArticle(req.body);
    const actorId = req.user.id;
    await assertMediaExists(queryFn, mediaIdsFor(article));
    const post = await runTransaction(async (execute) => {
      const currentResult = await execute(
        `SELECT ${ADMIN_POST_FIELDS} FROM blog_posts WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError(404, "Article not found.");
      if (current.status === "archived") throw httpError(409, "Restore the archived article before editing it.");
      if (current.status !== "draft") throw httpError(409, "Unpublish or cancel scheduling before editing. Public articles are not autosaved.");
      assertRevision(req.body, current);
      Object.assign(article, await authorResolver(execute, current.author_id || current.created_by || actorId));
      if (current.slug !== article.slug) {
        await execute("DELETE FROM blog_slug_redirects WHERE old_slug = $1", [article.slug]);
        await execute(
          "UPDATE blog_slug_redirects SET new_slug = $1, changed_by = $2 WHERE new_slug = $3",
          [article.slug, actorId, current.slug]
        );
        await execute(
          `INSERT INTO blog_slug_redirects (old_slug, new_slug, changed_by)
           VALUES ($1,$2,$3)
           ON CONFLICT (old_slug) DO UPDATE SET new_slug = EXCLUDED.new_slug, changed_by = EXCLUDED.changed_by`,
          [current.slug, article.slug, actorId]
        );
      }
      const updated = await execute(
        `UPDATE blog_posts SET
          title=$1, subtitle=$2, slug=$3, excerpt=$4, content=$5::jsonb,
          cover_image=$6, cover_image_alt=$7, category=$8, seo_title=$9,
          seo_description=$10, canonical_url=$11, social_title=$12,
          social_description=$13, author_name=$14, author_role=$15,
          author_bio=$16, author_url=$17, is_indexable=$18, updated_by=$19,
          updated_at=NOW(),author_id=$21,author_avatar_media=$22,tags=$23,is_featured=$24,ai_analysis=NULL
         WHERE id=$20 RETURNING ${ADMIN_POST_FIELDS}`,
        [
          article.title, article.subtitle || null, article.slug, article.excerpt || null,
          JSON.stringify(article.content), article.cover_image || null, article.cover_image_alt || null,
          article.category || null, article.seo_title || null, article.seo_description || null,
          article.canonical_url || null, article.social_title || null, article.social_description || null,
          article.author_name || null, article.author_role || null, article.author_bio || null,
          article.author_url || null, article.is_indexable, actorId, id,article.author_id,article.author_avatar_media,article.tags || [],article.is_featured || false,
        ]
      );
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'updated',$3::jsonb)`,
        [id, actorId, JSON.stringify(updated.rows[0])]
      );
      return updated.rows[0];
    });
    return res.json({ success: true, post });
  });

  const publish = withRequest("publish", async (req, res) => {
    if (req.body?.confirm_review !== true) throw httpError(400, "Explicit editorial review approval is required.");
    const id = requiredId(req.params.id, "Article ID");
    const result = await runTransaction(async (execute) => {
      const currentResult = await execute(
        `SELECT ${ADMIN_POST_FIELDS} FROM blog_posts WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError(404, "Article not found.");
      if (current.status === "archived") throw httpError(409, "Restore the archived article before publishing it.");
      if (current.status !== "draft") throw httpError(409, "Only a reviewed saved draft can be published.");
      assertRevision(req.body, current);
      const author = await authorResolver(execute, current.author_id || current.created_by || req.user.id, { requireComplete: true });
      Object.assign(current, author);
      const issues = validateForPublication(current);
      if (issues.length) throw httpError(400, `Article is not ready to publish: ${issues.join(" ")}`);
      await assertMediaExists(execute, mediaIdsFor(current));
      const updated = await execute(
        `UPDATE blog_posts SET status='published', published_at=NOW(),
          archived_at=NULL, updated_by=$1, updated_at=NOW(),approved_at=NOW(),
          author_name=$3,author_bio=$4,author_url=$5,author_id=$6,author_avatar_media=$7,author_role=$8
         WHERE id=$2 RETURNING ${ADMIN_POST_FIELDS}`,
        [req.user.id, id,author.author_name,author.author_bio,author.author_url,author.author_id,author.author_avatar_media,author.author_role]
      );
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'published',$3::jsonb)`,
        [id, req.user.id, JSON.stringify(updated.rows[0])]
      );
      return updated.rows[0];
    });
    return res.json({ success: true, post: result });
  });

  const unpublish = withRequest("unpublish", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const result = await runTransaction(async (execute) => {
      const updated = await execute(
        `UPDATE blog_posts SET status='draft', updated_by=$1, updated_at=NOW(),approved_at=NULL
         WHERE id=$2 AND status IN ('published','scheduled') RETURNING ${ADMIN_POST_FIELDS}`,
        [req.user.id, id]
      );
      if (!updated.rows[0]) throw httpError(404, "Published article not found.");
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'unpublished',$3::jsonb)`,
        [id, req.user.id, JSON.stringify(updated.rows[0])]
      );
      return updated.rows[0];
    });
    return res.json({ success: true, post: result });
  });

  const archive = withRequest("archive", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const result = await runTransaction(async (execute) => {
      const updated = await execute(
        `UPDATE blog_posts SET status='archived', archived_at=NOW(), updated_by=$1, updated_at=NOW()
         WHERE id=$2 AND status <> 'archived' RETURNING ${ADMIN_POST_FIELDS}`,
        [req.user.id, id]
      );
      if (!updated.rows[0]) throw httpError(404, "Article not found.");
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'archived',$3::jsonb)`,
        [id, req.user.id, JSON.stringify(updated.rows[0])]
      );
      return updated.rows[0];
    });
    return res.json({ success: true, post: result });
  });

  const restore = withRequest("restore", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const result = await runTransaction(async (execute) => {
      const updated = await execute(
        `UPDATE blog_posts SET status='draft', archived_at=NULL, updated_by=$1, updated_at=NOW()
         WHERE id=$2 AND status='archived' RETURNING ${ADMIN_POST_FIELDS}`,
        [req.user.id, id]
      );
      if (!updated.rows[0]) throw httpError(404, "Archived article not found.");
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES ($1,$2,'restored_to_draft',$3::jsonb)`,
        [id, req.user.id, JSON.stringify(updated.rows[0])]
      );
      return updated.rows[0];
    });
    return res.json({ success: true, post: result });
  });

  const history = withRequest("history", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const result = await queryFn(
      `SELECT id, actor_id, action, snapshot, created_at
       FROM blog_post_audit WHERE post_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [id]
    );
    return res.json({ success: true, history: result.rows });
  });

  const uploadMedia = withRequest("upload_media", async (req, res) => {
    const buffer = req.file?.buffer;
    const mime = imageMime(buffer);
    if (!mime) throw httpError(415, "Upload a valid PNG, JPEG, or WebP image.");
    if (buffer.length > 3 * 1024 * 1024) throw httpError(413, "Images must be 3 MB or smaller.");
    const id = crypto.randomUUID();
    const alt = String(req.body?.alt_text || "").trim();
    const caption = String(req.body?.caption || "").trim();
    if (!alt || alt.length > 300) throw httpError(400, "Provide descriptive alt text up to 300 characters.");
    if (caption.length > 500) throw httpError(400, "Image captions must be 500 characters or fewer.");
    const optimizedImage = await optimizeBlogImage(buffer);
    if (optimizedImage.length > 3 * 1024 * 1024) throw httpError(413, "The image could not be optimized below 3 MB.");
    await runTransaction(async (execute) => {
      await execute(
        `INSERT INTO blog_media (id, mime_type, image_bytes, alt_text, caption, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, "image/webp", optimizedImage, alt, caption || null, req.user.id]
      );
      await execute(
        `INSERT INTO blog_post_audit (post_id, actor_id, action, snapshot)
         VALUES (NULL,$1,'media_uploaded',$2::jsonb)`,
        [req.user.id, JSON.stringify({ mediaId: id, sourceMimeType: mime, mimeType: "image/webp", sourceBytes: buffer.length, bytes: optimizedImage.length })]
      );
    });
    return res.status(201).json({ success: true, media: { id, mime_type: "image/webp", alt_text: alt, caption: caption || null } });
  });

  const adminMedia = withRequest("get_admin_media", async (req, res) => {
    const id = requiredId(req.params.id, "Media ID");
    const result = await queryFn("SELECT mime_type, image_bytes FROM blog_media WHERE id=$1", [id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: "Image not found." });
    res.set({ "Content-Type": result.rows[0].mime_type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
    return res.send(result.rows[0].image_bytes);
  });

  const publicMedia = withRequest("get_public_media", async (req, res) => {
    const id = requiredId(req.params.id, "Media ID");
    const result = await queryFn(
      `SELECT m.mime_type, m.image_bytes FROM blog_media m
       WHERE m.id=$1 AND EXISTS (
         SELECT 1 FROM blog_posts p
         WHERE p.status IN ('published','scheduled') AND p.published_at<=NOW() AND p.archived_at IS NULL
           AND (p.cover_image=m.id::text OR p.author_avatar_media=m.id OR p.content @> jsonb_build_array(jsonb_build_object('mediaId',m.id::text)))
       )`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).end();
    res.set({ "Content-Type": result.rows[0].mime_type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
    return res.send(result.rows[0].image_bytes);
  });

  const mediaLibrary = withRequest("list_media", async (_req, res) => {
    const result = await queryFn(`select id,mime_type,alt_text,caption,created_by,created_at,
      octet_length(image_bytes) as bytes from blog_media order by created_at desc limit 100`);
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, media: result.rows });
  });
  const profile = withRequest("author_profile", async (req, res) => {
    const author = await authorResolver(queryFn, req.user.id);
    res.json({ success: true, profile: author, complete: !!author.author_name && !!author.author_avatar_media });
  });
  const updateProfile = withRequest("update_author_profile", async (req, res) => {
    const name = String(req.body.full_name || "").trim();
    const biography = String(req.body.biography || "").trim();
    const avatar = requiredId(req.body.avatar_media_id, "Profile photograph");
    if (!name || name.includes("@") || name.length > 120 || biography.length > 800) throw httpError(400, "Provide your actual full name (not email) and a biography up to 800 characters.");
    const owned = await queryFn("select id from blog_media where id=$1 and created_by=$2", [avatar, req.user.id]);
    if (!owned.rows.length) throw httpError(400, "Choose a profile photograph you uploaded.");
    await queryFn(`insert into audit_events(actor_id,action,entity_type,entity_id) values($1,'AUTHOR_PROFILE_UPDATE_REQUESTED','user',$1)`, [req.user.id]);
    const { error } = await authClient().auth.admin.updateUserById(req.user.id, { user_metadata: { full_name: name, biography, avatar_media_id: avatar } });
    if (error) throw httpError(502, "Author profile update failed.");
    res.json({ success: true, profile: await authorResolver(queryFn, req.user.id) });
  });
  const schedule = withRequest("schedule", async (req, res) => {
    if (req.body?.confirm_review !== true) throw httpError(400, "Explicit editorial review approval is required.");
    const id = requiredId(req.params.id, "Article ID");
    if (typeof req.body.published_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(req.body.published_at)) throw httpError(400, "Publication time must include a timezone.");
    const due = new Date(req.body.published_at);
    if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) throw httpError(400, "Choose a future publication time including timezone.");
    const post = await runTransaction(async execute => {
      const result = await execute(`select ${ADMIN_POST_FIELDS} from blog_posts where id=$1 for update`, [id]);
      const current = result.rows[0];
      if (!current || current.status !== "draft") throw httpError(409, "Only a saved draft can be scheduled.");
      assertRevision(req.body, current);
      const author = await authorResolver(execute, current.author_id || current.created_by, { requireComplete: true });
      const issues = validateForPublication({ ...current, ...author });
      if (issues.length) throw httpError(400, issues.join(" "));
      await assertMediaExists(execute, mediaIdsFor(current));
      const updated = await execute(`update blog_posts set status='scheduled',published_at=$1,approved_at=now(),updated_by=$2,updated_at=now(),
        author_name=$4,author_bio=$5,author_url=$6,author_id=$7,author_avatar_media=$8,author_role=$9
        where id=$3 returning ${ADMIN_POST_FIELDS}`, [due.toISOString(), req.user.id, id, author.author_name, author.author_bio, author.author_url, author.author_id, author.author_avatar_media, author.author_role]);
      await execute("insert into blog_post_audit(post_id,actor_id,action,snapshot) values($1,$2,'scheduled',$3::jsonb)", [id, req.user.id, JSON.stringify(updated.rows[0])]);
      return updated.rows[0];
    });
    res.json({ success: true, post });
  });
  const analyze = withRequest("ai_analyze", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    const organizationId = requiredId(req.body.organization_id, "Publishing budget organization");
    const member = await queryFn(`select 1 from organization_memberships m join organizations o on o.id=m.organization_id
      where m.user_id=$1 and m.organization_id=$2 and m.status='active' and o.status='active'
      and m.role in ('owner','admin','ORG_ADMIN','CUSTOMER_ADMIN')`, [req.user.id, organizationId]);
    if (!member.rows.length) throw httpError(403, "An active administrator membership in the explicitly selected AI-budget organization is required.");
    const result = await queryFn(`select ${ADMIN_POST_FIELDS} from blog_posts where id=$1`, [id]);
    const current = result.rows[0];
    if (!current || current.status !== "draft") throw httpError(409, "Save a draft before AI analysis.");
    const analysis = await analyzer(current, { organizationId, consent: req.body.public_editorial_consent, userId: req.user.id });
    const updated = await runTransaction(async execute => {
      const locked = await execute(`select ${ADMIN_POST_FIELDS} from blog_posts where id=$1 for update`, [id]);
      if (!locked.rows[0] || locked.rows[0].status !== "draft" || articleRevision(locked.rows[0]) !== analysis.revision) throw httpError(409, "Article changed during AI analysis; regenerate against the saved revision.");
      await execute("update blog_posts set ai_analysis=$1::jsonb where id=$2", [JSON.stringify(analysis), id]);
      await execute("insert into blog_post_audit(post_id,actor_id,action,snapshot) values($1,$2,'ai_analyzed',$3::jsonb)", [id, req.user.id, JSON.stringify({ revision: analysis.revision, provider: analysis.provider })]);
      return analysis;
    });
    res.json({ success: true, analysis: updated });
  });
  const authorPage = withRequest("public_author", async (req, res) => {
    const id = requiredId(req.params.id, "Author ID");
    const result = await queryFn(`select ${PUBLIC_POST_FIELDS} from blog_posts where author_id=$1
      and status in ('published','scheduled') and published_at<=now() and archived_at is null order by published_at desc limit 100`, [id]);
    if (!result.rows.length) throw httpError(404, "Published author not found.");
    const p = result.rows[0];
    res.json({ success: true, author: { id, name: p.author_name, biography: p.author_bio, avatar_media: p.author_avatar_media, url: p.author_url }, posts: result.rows });
  });
  const deleteArchived = withRequest("delete_archived", async (req, res) => {
    const id = requiredId(req.params.id, "Article ID");
    await runTransaction(async execute => {
      const { rows } = await execute(`select ${ADMIN_POST_FIELDS} from blog_posts where id=$1 for update`, [id]);
      const current = rows[0];
      if (!current || current.status !== "archived") throw httpError(409, "Only an archived article can be permanently deleted.");
      assertRevision(req.body, current);
      if (req.body?.confirm_title !== current.title) throw httpError(400, "Type the exact archived article title to confirm permanent deletion.");
      await execute("insert into blog_post_audit(post_id,actor_id,action,snapshot) values($1,$2,'deleted',$3::jsonb)", [id, req.user.id, JSON.stringify(current)]);
      await execute("delete from blog_slug_redirects where new_slug=$1 or old_slug=$1", [current.slug]);
      await execute("delete from blog_posts where id=$1", [id]);
    });
    res.json({ success: true, deleted: true });
  });

  return {
    listPublished, getPublished, sitemap, listAdmin, listCategories, createCategory, updateCategory, deleteCategory, getAdmin, create, update,
    publish, unpublish, archive, restore, history, uploadMedia, adminMedia, publicMedia,
    mediaLibrary, profile, updateProfile, schedule, analyze, authorPage, deleteArchived,
  };
}

export const blogController = createBlogController();
