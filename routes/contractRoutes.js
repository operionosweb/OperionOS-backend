import express from "express";
import fs from "fs";

import { processContract } from "../contractPipeline.js";

import {
  upload,
  extractTextFromPDF,
} from "../services/uploadService.js";

const router = express.Router();

/* =========================================
   BASIC JSON CONTRACT PROCESSING
========================================= */

router.post("/", async (req, res) => {
  try {
    const result = await processContract(req.body);

    res.json(result);
  } catch (err) {
    console.error("Contract error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/* =========================================
   PDF CONTRACT UPLOAD
========================================= */

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No PDF uploaded",
        });
      }

      /* =========================
         EXTRACT PDF TEXT
      ========================= */

      const extractedText = await extractTextFromPDF(
        req.file.path
      );

      /* =========================
         RUN CONTRACT PIPELINE
      ========================= */

      const result = await processContract({
        extracted_text: extractedText,
      });

      /* =========================
         CLEAN TEMP FILE
      ========================= */

      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error("File cleanup failed:", err);
        }
      });

      /* =========================
         RESPONSE
      ========================= */

      res.json({
        success: true,
        filename: req.file.originalname,
        extractedCharacters: extractedText.length,
        ...result,
      });
    } catch (err) {
      console.error("Upload route error:", err);

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

export default router;
