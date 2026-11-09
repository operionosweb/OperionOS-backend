import express from "express";
import multer from "multer";
import { blogController, createBlogController } from "../controllers/blogController.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
});

function parseBlogImage(req, res, next) {
  imageUpload.single("file")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: tooLarge ? "Images must be 3 MB or smaller." : "Invalid image upload.",
    });
  });
}

export function createBlogRouter({
  controller = blogController,
  authenticate = authenticateUser,
  authorize = requireSuperAdmin,
} = {}) {
  const router = express.Router();
  const admin = express.Router();

  router.get("/", controller.listPublished);
  router.get("/sitemap.xml", controller.sitemap);
  router.get("/media/:id", controller.publicMedia);

  admin.use(authenticate, authorize);
  admin.get("/posts", controller.listAdmin);
  admin.post("/posts", controller.create);
  admin.get("/posts/:id/history", controller.history);
  admin.get("/posts/:id", controller.getAdmin);
  admin.put("/posts/:id", controller.update);
  admin.post("/posts/:id/publish", controller.publish);
  admin.post("/posts/:id/unpublish", controller.unpublish);
  admin.post("/posts/:id/archive", controller.archive);
  admin.post("/posts/:id/restore", controller.restore);
  admin.post("/media", parseBlogImage, controller.uploadMedia);
  admin.get("/media/:id", controller.adminMedia);
  router.use("/admin", admin);
  router.get("/:slug", controller.getPublished);
  return router;
}

export default createBlogRouter();
export { createBlogController };
