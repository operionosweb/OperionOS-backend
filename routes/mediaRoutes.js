// routes/mediaRoutes.js

import express from "express";
import multer from "multer";
import supabase from "../config/supabase.js";
import { uploadFile } from "../services/storageService.js";

const router = express.Router();

/**
 * -----------------------------------------
 * MULTER CONFIG (EU-FIRST: MEMORY ONLY)
 * -----------------------------------------
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (req, file, cb) => {
    /**
     * Basic EU-safe file validation layer
     */
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Unsupported file type"),
        false
      );
    }

    cb(null, true);
  },
});

/**
 * -----------------------------------------
 * UPLOAD FILE (UPLOADCARE EU-FIRST PIPELINE)
 * -----------------------------------------
 */

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      /**
       * Validate file exists
       */
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file provided",
        });
      }

      const file = req.file;

      /**
       * -----------------------------------------
       * EU-FIRST STORAGE LAYER (Uploadcare abstraction)
       * -----------------------------------------
       */
      const uploadResult = await uploadFile({
        buffer: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
      });

      if (!uploadResult?.success) {
        return res.status(500).json({
          success: false,
          error:
            uploadResult?.error ||
            "Upload failed",
        });
      }

      /**
       * -----------------------------------------
       * SUPABASE TRACKING (metadata only)
       * -----------------------------------------
       */
      const { data, error } = await supabase
        .from("uploads")
        .insert({
          filename: file.originalname,
          url: uploadResult.url,
          file_id: uploadResult.file_id,
          mimetype: file.mimetype,
          size: file.size,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      /**
       * -----------------------------------------
       * RESPONSE
       * -----------------------------------------
       */

      return res.status(200).json({
        success: true,
        storage: "uploadcare",
        file: {
          id: data.id,
          filename: data.filename,
          url: data.url,
          file_id: data.file_id,
          mimetype: data.mimetype,
          size: data.size,
        },
      });
    } catch (error) {
      console.error("Media upload error:", error);

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Upload failed",
      });
    }
  }
);

export default router;
