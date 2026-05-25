import { uploadToUploadcare } from "./providers/uploadcareProvider.js";

/**
 * =========================================
 * EU-FIRST STORAGE LAYER (UPLOADCARE ONLY)
 * =========================================
 *
 * Architecture principle:
 * - No AWS dependency
 * - No Cloudinary dependency
 * - Provider abstraction kept for future EU vendors
 * =========================================
 */

export async function uploadFile({
  buffer,
  filename = "file.pdf",
  mimeType = "application/octet-stream"
}) {
  try {
    /**
     * -----------------------------------------
     * VALIDATION
     * -----------------------------------------
     */

    if (!buffer) {
      return {
        success: false,
        error: "Missing file buffer"
      };
    }

    /**
     * -----------------------------------------
     * PRIMARY PROVIDER: UPLOADCARE
     * -----------------------------------------
     */

    const result = await uploadToUploadcare({
      buffer,
      filename,
      mimeType
    });

    if (result.success) {
      return {
        ...result,
        storage: "uploadcare_primary"
      };
    }

    /**
     * -----------------------------------------
     * NO FALLBACK (INTENTIONAL)
     * -----------------------------------------
     *
     * Reason:
     * Uploadcare is already EU-friendly and production-grade.
     * Avoid unnecessary multi-provider complexity.
     */

    return {
      success: false,
      error: result.error || "Upload failed (Uploadcare)",
      storage: "uploadcare_failed"
    };

  } catch (error) {
    console.error("StorageService error:", error);

    return {
      success: false,
      error: error.message || "Storage service failure"
    };
  }
}
