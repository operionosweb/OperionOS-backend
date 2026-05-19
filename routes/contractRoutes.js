import express from "express";
import multer from "multer";

import supabase from "../config/supabase.js";
import { extractPdfText } from "../services/pdfService.js";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const file = req.file;

    const extractedText = await extractPdfText(file.buffer);

    const fileName = `${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({
        error: uploadError.message,
      });
    }

    return res.json({
      success: true,
      filename: fileName,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      extractedCharacters: extractedText.length,
      extractedPreview: extractedText.substring(0, 500),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message,
    });
  }
});

export default router;
