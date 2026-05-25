import axios from "axios";
import FormData from "form-data";

export async function uploadToUploadcare({
  buffer,
  filename,
  mimeType
}) {
  try {
    if (!buffer) {
      return {
        success: false,
        error: "Missing file buffer"
      };
    }

    const form = new FormData();
    form.append("file", buffer, filename);

    const response = await axios.post(
      "https://upload.uploadcare.com/base/",
      form,
      {
        params: {
          pub_key: process.env.UPLOADCARE_PUBLIC_KEY,
          store: 1
        },
        headers: form.getHeaders(),
        timeout: 30000
      }
    );

    const fileUUID = response?.data?.file;

    if (!fileUUID) {
      return {
        success: false,
        error: "Uploadcare did not return file UUID"
      };
    }

    return {
      success: true,
      provider: "uploadcare",
      file_id: fileUUID,
      url: `https://ucarecdn.com/${fileUUID}/`,
      mimeType,
      filename
    };

  } catch (error) {
    console.error("Uploadcare error:", error?.response?.data || error);

    return {
      success: false,
      provider: "uploadcare",
      error: error.message || "Upload failed"
    };
  }
}
