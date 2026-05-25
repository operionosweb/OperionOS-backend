import { uploadToUploadcare } from "./providers/uploadcareProvider.js";
import { uploadToS3 } from "./providers/s3Provider.js";

/**
 * EU-FIRST STORAGE ORCHESTRATOR
 * Order:
 * 1. Uploadcare (primary EU-friendly)
 * 2. S3 EU fallback
 */

export async function uploadFile({
  buffer,
  filename,
  mimeType
}) {
  try {
    /**
     * -----------------------------------------
     * 1. PRIMARY: UPLOADCARE
     * -----------------------------------------
     */

    const uploadcareResult = await uploadToUploadcare({
      buffer,
      filename,
      mimeType
    });

    if (uploadcareResult.success) {
      return uploadcareResult;
    }

    console.warn("⚠️ Uploadcare failed, switching to S3 fallback");

    /**
     * -----------------------------------------
     * 2. FALLBACK: S3 (EU REGION)
     * -----------------------------------------
     */

    const s3Result = await uploadToS3({
      buffer,
      filename,
      mimeType
    });

    if (s3Result.success) {
      return s3Result;
    }

    /**
     * -----------------------------------------
     * FINAL FAILURE
     * -----------------------------------------
     */

    return {
      success: false,
      error: "All storage providers failed",
      uploadcare_error: uploadcareResult.error,
      s3_error: s3Result.error
    };

  } catch (error) {
    console.error("StorageService fatal error:", error);

    return {
      success: false,
      error: error.message || "Storage failure"
    };
  }
}
