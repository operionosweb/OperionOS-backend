import express from "express";

import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePost,
  deletePost,
  publishPost,
} from "../controllers/blogController.js";

const router = express.Router();

/* =====================================================
   CREATE POST
===================================================== */
router.post("/", createPost);

/* =====================================================
   GET ALL POSTS
===================================================== */
router.get("/", getAllPosts);

/* =====================================================
   GET SINGLE POST
===================================================== */
router.get("/:slug", getPostBySlug);

/* =====================================================
   UPDATE POST
===================================================== */
router.put("/:id", updatePost);

/* =====================================================
   DELETE POST
===================================================== */
router.delete("/:id", deletePost);

/* =====================================================
   PUBLISH POST
===================================================== */
router.post("/:id/publish", publishPost);

export default router;
