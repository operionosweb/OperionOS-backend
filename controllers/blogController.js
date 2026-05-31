import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  publishPost,
} from "../services/blogService.js";

import { success, fail } from "../utils/apiResponse.js";

/* =====================================================
   CREATE POST
===================================================== */
export async function createPostController(req, res) {
  try {
    const result = await createPost(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Failed to create post", 500);
    }

    return success(res, result.post, "Post created successfully");
  } catch (err) {
    console.error("createPostController error:", err);
    return fail(res, "Internal server error");
  }
}

/* =====================================================
   GET ALL POSTS
===================================================== */
export async function getAllPostsController(req, res) {
  try {
    const result = await getAllPosts(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Failed to fetch posts", 500);
    }

    return success(res, result.posts, "Posts fetched successfully");
  } catch (err) {
    console.error("getAllPostsController error:", err);
    return fail(res, "Internal server error");
  }
}

/* =====================================================
   GET POST BY SLUG
===================================================== */
export async function getPostBySlugController(req, res) {
  try {
    const result = await getPostBySlug(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Post not found", 404);
    }

    return success(res, result.post, "Post fetched successfully");
  } catch (err) {
    console.error("getPostBySlugController error:", err);
    return fail(res, "Internal server error");
  }
}

/* =====================================================
   UPDATE POST
===================================================== */
export async function updatePostController(req, res) {
  try {
    const result = await updatePost(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Failed to update post", 500);
    }

    return success(res, result.post, "Post updated successfully");
  } catch (err) {
    console.error("updatePostController error:", err);
    return fail(res, "Internal server error");
  }
}

/* =====================================================
   DELETE POST
===================================================== */
export async function deletePostController(req, res) {
  try {
    const result = await deletePost(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Failed to delete post", 500);
    }

    return success(res, {}, "Post deleted successfully");
  } catch (err) {
    console.error("deletePostController error:", err);
    return fail(res, "Internal server error");
  }
}

/* =====================================================
   PUBLISH POST
===================================================== */
export async function publishPostController(req, res) {
  try {
    const result = await publishPost(req, res);

    if (!result || result.error) {
      return fail(res, result?.error || "Failed to publish post", 500);
    }

    return success(res, result.post, "Post published successfully");
  } catch (err) {
    console.error("publishPostController error:", err);
    return fail(res, "Internal server error");
  }
}
