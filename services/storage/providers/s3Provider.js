import AWS from "aws-sdk";

/**
 * EU-FIRST S3 CONFIGURATION
 * Example region: eu-central-1 (Frankfurt)
 */

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "eu-central-1"
});

export async function uploadToS3({
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

    const key = `uploads/${Date.now()}-${filename}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: "private"
    };

    const result = await s3.upload(params).promise();

    return {
      success: true,
      provider: "s3",
      file_id: key,
      url: result.Location,
      mimeType,
      filename
    };

  } catch (error) {
    console.error("S3 upload error:", error);

    return {
      success: false,
      provider: "s3",
      error: error.message || "S3 upload failed"
    };
  }
}
