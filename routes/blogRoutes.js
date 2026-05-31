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

/* =========================================
   BLOG ROUTES
========================================= */

router.post("/", createPost);

router.get("/", getAllPosts);

router.get("/:slug", getPostBySlug);

router.put("/:id", updatePost);

router.delete("/:id", deletePost);

router.post("/:id/publish", publishPost);

export default router;
