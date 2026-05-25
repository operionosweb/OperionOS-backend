import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import cloudinary from "../config/cloudinary.js";

import {
  requireAdmin
} from "../middleware/authMiddleware.js";

const router = express.Router();

/* =====================================================
   CLOUDINARY STORAGE
===================================================== */

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {

    return {
      folder: "operion-blog",
      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp"
      ],
      transformation: [
        {
          width: 2000,
          crop: "limit",
          quality: "auto",
          fetch_format: "auto"
        }
      ]
    };
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

/* =====================================================
   IMAGE UPLOAD
===================================================== */

router.post(
  "/upload",
  requireAdmin,
  upload.single("image"),
  async (req, res) => {

    try {

      return res.json({
        success: true,
        image: {
          url: req.file.path,
          public_id: req.file.filename
        }
      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({
        success: false,
        error: "Upload failed"
      });

    }
  }
);

/* =====================================================
   IMAGE DELETE
===================================================== */

router.delete(
  "/delete/:publicId",
  requireAdmin,
  async (req, res) => {

    try {

      const { publicId } = req.params;

      await cloudinary.uploader.destroy(publicId);

      return res.json({
        success: true
      });

    } catch (err) {

      console.error(err);

      return res.status(500).json({
        success: false,
        error: "Delete failed"
      });

    }
  }
);

export default router;
