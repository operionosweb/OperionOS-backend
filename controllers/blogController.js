import slugify from "slugify";
import { query } from "../db.js";

/* =====================================================
   CREATE POST
===================================================== */

export async function createPost(req, res) {
  try {
    const {
      title,
      subtitle,
      excerpt,
      content,
      cover_image,
      seo_title,
      seo_description,
      author_name,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Title is required",
      });
    }

    const slug = slugify(title, {
      lower: true,
      strict: true,
    });

    const result = await query(
      `
      INSERT INTO blog_posts (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("createPost error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to create post",
    });
  }
}

/* =====================================================
   GET ALL POSTS
===================================================== */

export async function getAllPosts(req, res) {
  try {
    const result = await query(`
      SELECT *
      FROM blog_posts
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch posts",
    });
  }
}

/* =====================================================
   GET POST BY SLUG
===================================================== */

export async function getPostBySlug(req, res) {
  try {
    const { slug } = req.params;

    const result = await query(
      `
      SELECT *
      FROM blog_posts
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch post",
    });
  }
}

/* =====================================================
   UPDATE POST
===================================================== */

export async function updatePost(req, res) {
  try {
    const { id } = req.params;

    const {
      title,
      subtitle,
      excerpt,
      content,
      cover_image,
      seo_title,
      seo_description,
      status,
    } = req.body;

    const slug = slugify(title || "", {
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

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to update post",
    });
  }
}

/* =====================================================
   DELETE POST
===================================================== */

export async function deletePost(req, res) {
  try {
    const { id } = req.params;

    await query(
      `
      DELETE FROM blog_posts
      WHERE id = $1
      `,
      [id]
    );

    return res.json({
      success: true,
      data: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to delete post",
    });
  }
}

/* =====================================================
   PUBLISH POST
===================================================== */

export async function publishPost(req, res) {
  try {
    const { id } = req.params;

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

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to publish post",
    });
  }
}
