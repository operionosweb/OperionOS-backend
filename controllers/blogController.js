import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  publishPost,
} from "../services/blogService.js";

/* =====================================================
   CONTROLLER LAYER = PURE PASS-THROUGH
===================================================== */

export const createPostController = createPost;

export const getAllPostsController = getAllPosts;

export const getPostBySlugController = getPostBySlug;

export const updatePostController = updatePost;

export const deletePostController = deletePost;

export const publishPostController = publishPost;
