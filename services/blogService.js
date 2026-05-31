import slugify from "slugify";
import { query } from "../db.js";

/* =====================================================
   CREATE POST (BUSINESS LOGIC ONLY)
===================================================== */

export async function createBlogPost(data) {
  const {
    title,
    subtitle,
    excerpt,
    content,
    cover_image,
    seo_title,
    seo_description,
    author_name,
  } = data;

  const slug = slugify(title, {
    lower: true,
    strict: true,
  });

  const result = await query(
    `
    INSERT INTO blog_posts
    (
      title,
      subtitle,
      slug,
      excerpt,
      content,
      cover_image,
      seo_title,
      seo_description,
      author_name
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      title,
      subtitle || null,
      slug,
      excerpt || null,
      content || {},
      cover_image || null,
      seo_title || null,
      seo_description || null,
      author_name || "Operion",
    ]
  );

  return result.rows[0];
}

/* =====================================================
   GET ALL POSTS
===================================================== */

export async function getAllBlogPosts() {
  const result = await query(`
    SELECT *
    FROM blog_posts
    ORDER BY created_at DESC
  `);

  return result.rows;
}

/* =====================================================
   GET BY SLUG
===================================================== */

export async function getBlogPostBySlug(slug) {
  const result = await query(
    `
    SELECT *
    FROM blog_posts
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

/* =====================================================
   UPDATE POST
===================================================== */

export async function updateBlogPost(id, data) {
  const {
    title,
    subtitle,
    excerpt,
    content,
    cover_image,
    seo_title,
    seo_description,
    status,
  } = data;

  const slug = slugify(title, {
    lower: true,
    strict: true,
  });

  const result = await query(
    `
    UPDATE blog_posts
    SET
      title = $1,
      subtitle = $2,
      slug = $3,
      excerpt = $4,
      content = $5,
      cover_image = $6,
      seo_title = $7,
      seo_description = $8,
      status = $9,
      updated_at = NOW()
    WHERE id = $10
    RETURNING *
    `,
    [
      title,
      subtitle,
      slug,
      excerpt,
      content,
      cover_image,
      seo_title,
      seo_description,
      status,
      id,
    ]
  );

  return result.rows[0] || null;
}

/* =====================================================
   DELETE POST
===================================================== */

export async function deleteBlogPost(id) {
  await query(
    `
    DELETE FROM blog_posts
    WHERE id = $1
    `,
    [id]
  );

  return true;
}

/* =====================================================
   PUBLISH POST
===================================================== */

export async function publishBlogPost(id) {
  const result = await query(
    `
    UPDATE blog_posts
    SET
      status = 'published',
      published_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}
