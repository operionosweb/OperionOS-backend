import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ======================================================
// PATH SETUP (SAFE FOR LOCAL + RENDER)
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TEMP upload directory (Render-safe ephemeral usage)
const uploadsDir = "/tmp/uploads";

// Ensure directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ======================================================
// MULTER STORAGE (TEMP FILES ONLY)
// ======================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },

  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

// ======================================================
// EXPORT UPLOAD MIDDLEWARE
// ======================================================

export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB safety limit
  },
});
