import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  publishPost,
} from "../services/blogService.js";

/* =====================================================
   CREATE POST
===================================================== */
export const createBlogPost = createPost;

/* =====================================================
   GET ALL POSTS
===================================================== */
export const getBlogs = getAllPosts;

/* =====================================================
   GET SINGLE POST
===================================================== */
export const getBlogBySlug = getPostBySlug;

/* =====================================================
   UPDATE POST
===================================================== */
export const updateBlogPost = updatePost;

/* =====================================================
   DELETE POST
===================================================== */
export const deleteBlogPost = deletePost;

/* =====================================================
   PUBLISH POST
===================================================== */
export const publishBlogPost = publishPost;
