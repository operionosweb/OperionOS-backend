import crypto from "node:crypto";
import { query, default as pool } from "../db.js";
import {
  normalizeBlogPostInput,
  validateForPublication,
} from "../frontend/src/lib/blogContent.js";

const SITE_URL = "https://operionos.com";
const PUBLIC_POST_FIELDS = `
  id, title, subtitle, slug, excerpt, content, cover_image, cover_image_alt,
  category, seo_title, seo_description, canonical_url, social_title,
  social_description, author_name, author_role, author_bio, author_url,
  is_indexable, status, published_at, created_at, updated_at
`;
const ADMIN_POST_FIELDS = `${PUBLIC_POST_FIELDS}, created_by, updated_by, archived_at`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function errorResponse(res, error, operation) {
  if (error?.code === "23505") {
    return res.status(409).json({ success: false, error: "That article URL is already in use." });
  }
  const status = Number.isInteger(error?.status) ? error.status : error?.code === "DATABASE_NOT_CONFIGURED" ? 503 : 500;
  if (status >= 500) console.error("blog_operation_failed", { operation, code: error?.code || "BLOG_REQUEST_FAILED" });
  return res.status(status).json({
    success: false,
    error: status >= 500 ? "Blog service is unavailable." : error.message,
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

export function createBlogController({ queryFn = query, database = pool } = {}) {
  const runTransaction = (callback) => transaction(database, queryFn, callback);

  const listPublished = withRequest("list_published", async (req, res) => {
    const values = [req.query.category || null];
    const result = await queryFn(
      `SELECT ${PUBLIC_POST_FIELDS}
       FROM blog_posts
       WHERE status = 'published' AND archived_at IS NULL
         AND ($1::text IS NULL OR category = $1)
       ORDER BY published_at DESC, id DESC`,
      values
    );
    return res.json({ success: true, posts: result.rows });
  });

  const getPublished = withRequest("get_published", async (req, res) => {
    const result = await queryFn(
      `SELECT ${PUBLIC_POST_FIELDS} FROM blog_posts
       WHERE slug = $1 AND status = 'published' AND archived_at IS NULL LIMIT 1`,
      [req.params.slug]
    );
    if (result.rows[0]) return res.json({ success: true, post: result.rows[0] });

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
       WHERE status = 'published' AND archived_at IS NULL AND is_indexable = TRUE
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
    const article = normalizeBlogPostInput(req.body);
    const actorId = req.user.id;
    await assertMediaExists(queryFn, mediaIdsFor(article));
    const result = await runTransaction(async (execute) => {
      const inserted = await execute(
        `INSERT INTO blog_posts (
          title, subtitle, slug, excerpt, content, cover_image, cover_image_alt,
          category, seo_title, seo_description, canonical_url, social_title,
          social_description, author_name, author_role, author_bio, author_url,
          is_indexable, status, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',$19,$19
        ) RETURNING ${ADMIN_POST_FIELDS}`,
        [
          article.title, article.subtitle || null, article.slug, article.excerpt || null,
          JSON.stringify(article.content), article.cover_image || null, article.cover_image_alt || null,
          article.category || null, article.seo_title || null, article.seo_description || null,
          article.canonical_url || null, article.social_title || null, article.social_description || null,
          article.author_name || null, article.author_role || null, article.author_bio || null,
          article.author_url || null, article.is_indexable, actorId,
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
    const article = normalizeBlogPostInput(req.body);
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
          updated_at=NOW()
         WHERE id=$20 RETURNING ${ADMIN_POST_FIELDS}`,
        [
          article.title, article.subtitle || null, article.slug, article.excerpt || null,
          JSON.stringify(article.content), article.cover_image || null, article.cover_image_alt || null,
          article.category || null, article.seo_title || null, article.seo_description || null,
          article.canonical_url || null, article.social_title || null, article.social_description || null,
          article.author_name || null, article.author_role || null, article.author_bio || null,
          article.author_url || null, article.is_indexable, actorId, id,
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
    const id = requiredId(req.params.id, "Article ID");
    const result = await runTransaction(async (execute) => {
      const currentResult = await execute(
        `SELECT ${ADMIN_POST_FIELDS} FROM blog_posts WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw httpError(404, "Article not found.");
      if (current.status === "archived") throw httpError(409, "Restore the archived article before publishing it.");
      const issues = validateForPublication(current);
      if (issues.length) throw httpError(400, `Article is not ready to publish: ${issues.join(" ")}`);
      await assertMediaExists(execute, mediaIdsFor(current));
      const updated = await execute(
        `UPDATE blog_posts SET status='published', published_at=COALESCE(published_at,NOW()),
          archived_at=NULL, updated_by=$1, updated_at=NOW()
         WHERE id=$2 RETURNING ${ADMIN_POST_FIELDS}`,
        [req.user.id, id]
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
        `UPDATE blog_posts SET status='draft', updated_by=$1, updated_at=NOW()
         WHERE id=$2 AND status='published' RETURNING ${ADMIN_POST_FIELDS}`,
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
         WHERE p.status='published' AND p.archived_at IS NULL
           AND (p.cover_image=m.id::text OR p.content @> jsonb_build_array(jsonb_build_object('mediaId',m.id::text)))
       )`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).end();
    res.set({ "Content-Type": result.rows[0].mime_type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400, immutable" });
    return res.send(result.rows[0].image_bytes);
  });

  return {
    listPublished, getPublished, sitemap, listAdmin, getAdmin, create, update,
    publish, unpublish, archive, restore, history, uploadMedia, adminMedia, publicMedia,
  };
}

export const blogController = createBlogController();
