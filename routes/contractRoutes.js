import express from "express";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";

import { processContract } from "../contractPipeline.js";
import { saveContractData } from "../services/supabaseService.js";

const router = express.Router();

// Ensure uploads folder exists (fixes ENOENT on Render)
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// HEALTH TEST ROUTE
router.get("/test", (req, res) => {
  res.json({ status: "contract route working" });
});

// MAIN UPLOAD ROUTE
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    // Read PDF
    const fileBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(fileBuffer);

    // Build contract object for pipeline
    const rawContract = {
      filename: req.file.originalname,
      contract: {
        extracted_text: pdfData.text
      }
    };

    // Run your AI pipeline
    const result = await processContract(rawContract);

    // Save to Supabase
    const saved = await saveContractData({
      filename: req.file.originalname,
      contract: result.contract,
      clauses: result.clauses,
      obligations: result.obligations
    });

    res.json({
      success: true,
      extraction: result,
      database: saved
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
