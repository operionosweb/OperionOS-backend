// routes/mediaRoutes.js

import express from "express";
import multer from "multer";
import supabase from "../config/supabase.js";
import { uploadFile } from "../services/storageService.js";

const router = express.Router();

/**
 * -----------------------------------------
 * MULTER (memory only - EU SAFE)
 * -----------------------------------------
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

/**
 * -----------------------------------------
 * UPLOAD FILE (UPLOADCARE ONLY)
 * -----------------------------------------
 */

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const file = req.file;

    const uploadResult = await uploadFile({
      buffer: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
    });

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || "Upload failed",
      });
    }

    const { data, error } = await supabase
      .from("uploads")
      .insert({
        filename: file.originalname,
        url: uploadResult.url,
        file_id: uploadResult.file_id,
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

    return res.status(200).json({
      success: true,
      file: data,
      storage: "uploadcare",
    });
  } catch (error) {
    console.error("Media upload error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Upload failed",
    });
  }
});

export default router;
