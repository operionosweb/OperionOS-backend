// services/storageService.js

/**
 * -----------------------------------------
 * UPLOADCARE (EU-FIRST STORAGE LAYER)
 * PRODUCTION HARDENED (NO SDK)
 * -----------------------------------------
 */

import axios from "axios";
import FormData from "form-data";

/**
 * -----------------------------------------
 * UPLOAD FILE TO UPLOADCARE
 * -----------------------------------------
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
      };
    }

    const publicKey = process.env.UPLOADCARE_PUBLIC_KEY;

    if (!publicKey) {
      return {
        success: false,
        error: "UPLOADCARE_PUBLIC_KEY missing in environment",
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
      }
    );

    const fileUUID = response?.data?.file;

    if (!fileUUID) {
      return {
        success: false,
        error: "Uploadcare did not return file UUID",
        raw: response?.data,
      };
    }

    return {
      success: true,
      file_id: fileUUID,
      url: `https://ucarecdn.com/${fileUUID}/`,
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
    };
  }
}
