import {
  createBlogPost,
  getAllBlogPosts,
  getBlogPostBySlug,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
} from "../services/blogService.js";

/* =====================================================
   CREATE POST
===================================================== */

export async function createPost(req, res) {
  try {
    const post = await createBlogPost(req.body);

    return res.json({
      success: true,
      post,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: "Failed to create post",
    });
  }
}

/* =====================================================
   GET ALL
===================================================== */

export async function getAllPosts(req, res) {
  try {
    const posts = await getAllBlogPosts();

    return res.json({
      success: true,
      posts,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch posts",
    });
  }
}

/* =====================================================
   GET BY SLUG
===================================================== */

export async function getPostBySlug(req, res) {
  try {
    const post = await getBlogPostBySlug(req.params.slug);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    return res.json({
      success: true,
      post,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch post",
    });
  }
}

/* =====================================================
   UPDATE
===================================================== */

export async function updatePost(req, res) {
  try {
    const post = await updateBlogPost(req.params.id, req.body);

    return res.json({
      success: true,
      post,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to update post",
    });
  }
}

/* =====================================================
   DELETE
===================================================== */

export async function deletePost(req, res) {
  try {
    await deleteBlogPost(req.params.id);

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to delete post",
    });
  }
}

/* =====================================================
   PUBLISH
===================================================== */

export async function publishPost(req, res) {
  try {
    const post = await publishBlogPost(req.params.id);

    return res.json({
      success: true,
      post,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to publish post",
    });
  }
}
