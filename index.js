import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import pdfParse from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================
   SUPABASE
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   MULTER STORAGE
========================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Decision OS Live",
    layer: "Unified Aviation Intelligence System",
  });
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Operion Backend",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   CONTRACT UPLOAD
========================= */

app.post(
  "/api/contracts/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      const file = req.file;

      /* =========================
         PDF TEXT EXTRACTION
      ========================= */

      let extractedText = "";

      try {
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text || "";
      } catch (pdfError) {
        console.error("PDF extraction failed:", pdfError);
      }

      /* =========================
         UPLOAD TO SUPABASE STORAGE
      ========================= */

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

      /* =========================
         RESPONSE
      ========================= */

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
  }
);

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});
