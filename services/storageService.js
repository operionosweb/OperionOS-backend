// services/storageService.js

import uploadcare from "uploadcare-client";

/**
 * -----------------------------------------
 * UPLOADCARE CONFIG
 * -----------------------------------------
 */

const uploadClient = new uploadcare.Client({
  publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
  secretKey: process.env.UPLOADCARE_SECRET_KEY, // server-side only
});

/**
 * -----------------------------------------
 * UPLOAD FILE (EU STORAGE LAYER)
 * -----------------------------------------
 */

export async function uploadFile(fileBuffer, filename = "file") {
  try {
    if (!fileBuffer) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    const file = await uploadClient.uploadFile(fileBuffer, {
      filename,
      store: true,
    });

    return {
      success: true,
      file_url: file.cdnUrl,
      file_uuid: file.uuid,
    };
  } catch (error) {
    console.error("Uploadcare Upload Error:", error);

    return {
      success: false,
      error: error.message || "Upload failed",
    };
  }
}
