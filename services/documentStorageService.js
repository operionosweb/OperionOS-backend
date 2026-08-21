import supabase from "../config/supabase.js";

const STORAGE_BUCKET = process.env.DOCUMENT_STORAGE_BUCKET || "contract-documents";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value, name) {
  if (!UUID_PATTERN.test(value || "")) {
    throw new TypeError(`${name} must be a valid UUID`);
  }
}

export function buildDocumentStorageKey({
  organizationId,
  documentId,
  versionId,
}) {
  assertUuid(organizationId, "organizationId");
  assertUuid(documentId, "documentId");
  assertUuid(versionId, "versionId");

  return `organizations/${organizationId}/documents/${documentId}/versions/${versionId}/source.pdf`;
}

export async function uploadDocumentSource({ storageKey, buffer, mimeType }) {
  if (!storageKey || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError("storageKey and non-empty buffer are required");
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    const storageError = new Error("Document source storage failed");
    storageError.code = "STORAGE_ERROR";
    throw storageError;
  }

  return {
    provider: "supabase",
    bucket: STORAGE_BUCKET,
    storageKey,
  };
}

export async function removeDocumentSource(storageKey) {
  if (!storageKey) return;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storageKey]);

  if (error) {
    console.error("Document source cleanup failed", {
      storage_key_present: true,
      error_code: "STORAGE_CLEANUP_ERROR",
    });
  }
}

export async function downloadDocumentSource(storageKey) {
  if (!storageKey) {
    throw new TypeError("storageKey is required");
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storageKey);

  if (error || !data) {
    const storageError = new Error("Document source unavailable");
    storageError.code = "STORAGE_ERROR";
    throw storageError;
  }

  return Buffer.from(await data.arrayBuffer());
}
