import fs from "fs";
import multer from "multer";
import pdfParse from "pdf-parse";

/* =========================
   MULTER STORAGE
========================= */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");

    cb(null, uniqueName);
  },
});

/* =========================
   FILE FILTER
========================= */

function fileFilter(req, file, cb) {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
}

/* =========================
   MULTER EXPORT
========================= */

export const upload = multer({
  storage,
  fileFilter,
});

/* =========================
   PDF TEXT EXTRACTION
========================= */

export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    const pdfData = await pdfParse(dataBuffer);

    return pdfData.text || "";
  } catch (error) {
    console.error("PDF extraction failed:", error);

    throw new Error("Failed to extract PDF text");
  }
}
