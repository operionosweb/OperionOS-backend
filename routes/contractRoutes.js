// routes/contractRoutes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

const { analyzeContract } = require("../services/contractAnalysisService");

// Use memory storage for PDF uploads (no disk needed)
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Health check for contract service
 */
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "contract-routes",
    status: "active"
  });
});

/**
 * POST /api/contracts/analyze
 * Upload PDF and run full contract intelligence pipeline
 */
router.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Expected field name: 'file'"
      });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    // Call unified analysis pipeline
    const result = await analyzeContract(fileBuffer, fileName);

    return res.status(200).json(result);

  } catch (error) {
    console.error("Contract analysis error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error during contract analysis"
    });
  }
});

module.exports = router;
