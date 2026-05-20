import express from "express";
import fs from "fs";
import pdf from "pdf-parse";

import { processContract } from "../contractPipeline.js";
import { upload } from "../services/uploadService.js";

const router = express.Router();

/* =====================================================
   HEALTH CHECK FOR ROUTE
===================================================== */

router.get("/test", (req, res) => {
  res.json({
    status: "contract routes alive"
  });
});

/* =====================================================
   1. RAW TEXT PROCESSING (YOUR EXISTING FLOW)
===================================================== */

router.post("/", async (req, res) => {
  try {
    const result = await processContract(req.body);

    res.json(result);
  } catch (err) {
    console.error("Contract error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =====================================================
   2. NEW PDF UPLOAD PROCESSING
===================================================== */

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    // Read PDF file
    const fileBuffer = fs.readFileSync(req.file.path);

    // Extract text
    const pdfData = await pdf(fileBuffer);
    const extracted_text = pdfData.text;

    // Process contract pipeline
    const result = await processContract({
      extracted_text
    });

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json(result);

  } catch (err) {
    console.error("Upload error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
