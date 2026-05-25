 // services/storageService.js

/**
 * -----------------------------------------
 * UPLOADCARE (EU-FRIENDLY STORAGE LAYER)
 * BACKEND SAFE: uses REST API (NO SDK)
 * -----------------------------------------
 */

import axios from "axios";
import FormData from "form-data";

/**
 * -----------------------------------------
 * UPLOAD FILE
 * -----------------------------------------
 */

export async function uploadFile(fileBuffer, filename = "file.pdf") {
  try {
    if (!fileBuffer) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    const form = new FormData();
    form.append("file", fileBuffer, filename);

    const response = await axios.post(
      "https://upload.uploadcare.com/base/",
      form,
      {
        params: {
          pub_key: process.env.UPLOADCARE_PUBLIC_KEY,
          store: 1,
        },
        headers: form.getHeaders(),
      }
    );

    const fileUUID = response?.data?.file;

    if (!fileUUID) {
      return {
        success: false,
        error: "Upload failed - no file UUID returned",
      };
    }

    return {
      success: true,
      file_uuid: fileUUID,
      file_url: `https://ucarecdn.com/${fileUUID}/`,
    };
  } catch (error) {
    console.error("Uploadcare Error:", error?.response?.data || error);

    return {
      success: false,
      error: error.message || "Upload failed",
    };
  }
}
