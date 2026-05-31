import express from "express";

import {
  createPostController,
  getAllPostsController,
  getPostBySlugController,
  updatePostController,
  deletePostController,
  publishPostController,
} from "../controllers/blogController.js";

const router = express.Router();

/* =====================================================
   BLOG ROUTES
===================================================== */

router.post("/", createPostController);

router.get("/", getAllPostsController);

router.get("/:slug", getPostBySlugController);

router.put("/:id", updatePostController);

router.delete("/:id", deletePostController);

router.post("/:id/publish", publishPostController);

export default router;
