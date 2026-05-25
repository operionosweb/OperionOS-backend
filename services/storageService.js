// services/storageService.js

/**
 * =========================================
 * OPERION OS - STORAGE ABSTRACTION LAYER
 * EU-FIRST DESIGN (UPLOADCARE PRIMARY)
 * FUTURE-PROOF: S3 / MINIO / OTHER PROVIDERS
 * =========================================
 */

import axios from "axios";
import FormData from "form-data";

/**
 * -----------------------------------------
 * PROVIDER SELECTION (EU-FIRST ARCHITECTURE READY)
 * -----------------------------------------
 */

const STORAGE_PROVIDER = "uploadcare"; // future: env switch

/**
 * -----------------------------------------
 * UPLOAD FILE (MAIN ENTRY POINT)
 * -----------------------------------------
 * Standardized contract across ALL providers:
 * {
 *   success: boolean,
 *   file_id: string,
 *   url: string,
 *   provider: string,
 *   raw?: any
 * }
 */

export async function uploadFile({
  buffer,
  filename = "file",
  mimetype = "application/octet-stream",
}) {
  try {
    if (!buffer) {
      return {
        success: false,
        error: "No file buffer provided",
        provider: STORAGE_PROVIDER,
      };
    }

    switch (STORAGE_PROVIDER) {
      case "uploadcare":
        return await uploadToUploadcare({ buffer, filename, mimetype });

      default:
        return {
          success: false,
          error: `Unsupported storage provider: ${STORAGE_PROVIDER}`,
          provider: STORAGE_PROVIDER,
        };
    }
  } catch (error) {
    console.error("Storage Service Error:", error);

    return {
      success: false,
      error: error.message || "Storage upload failed",
      provider: STORAGE_PROVIDER,
    };
  }
}

/**
 * -----------------------------------------
 * UPLOADCARE IMPLEMENTATION (EU-FIRST)
 * -----------------------------------------
 */

async function uploadToUploadcare({ buffer, filename, mimetype }) {
  try {
    const publicKey = process.env.UPLOADCARE_PUBLIC_KEY;

    if (!publicKey) {
      return {
        success: false,
        error: "UPLOADCARE_PUBLIC_KEY missing in environment",
        provider: "uploadcare",
      };
    }

    const form = new FormData();

    form.append("file", buffer, {
      filename,
      contentType: mimetype,
    });

    form.append("UPLOADCARE_PUB_KEY", publicKey);
    form.append("UPLOADCARE_STORE", "1");

    const response = await axios.post(
      "https://upload.uploadcare.com/base/",
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000,
      }
    );

    const fileUUID = response?.data?.file;

    if (!fileUUID) {
      return {
        success: false,
        error: "Uploadcare did not return file UUID",
        provider: "uploadcare",
        raw: response?.data,
      };
    }

    return {
      success: true,
      file_id: fileUUID,
      url: `https://ucarecdn.com/${fileUUID}/`,
      provider: "uploadcare",
    };
  } catch (error) {
    console.error(
      "Uploadcare Error:",
      error?.response?.data || error
    );

    return {
      success: false,
      error:
        error?.response?.data?.detail ||
        error.message ||
        "Upload failed",
      provider: "uploadcare",
    };
  }
}

/**
 * -----------------------------------------
 * FUTURE EXTENSION HOOKS (DO NOT USE YET)
 * -----------------------------------------
 * - S3 EU (Backblaze / Scaleway / OVH)
 * - MinIO self-hosted EU cluster
 * - Azure EU regions (optional enterprise)
 * -----------------------------------------
 */
