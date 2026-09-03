import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateSha256,
  extractPdfMetadata,
  renderPdfPage,
  validateDocumentFile,
  validatePdfFile,
} from "../services/documentIngestionService.js";
import { buildDocumentStorageKey } from "../services/documentStorageService.js";

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("PDF signature and metadata validation are server-controlled", () => {
  const buffer = Buffer.from("%PDF-1.7\nsource bytes");
  const file = validatePdfFile({
    originalname: "source.pdf",
    mimetype: "application/pdf",
    buffer,
  });

  assert.equal(file.mimeType, "application/pdf");
  assert.equal(file.fileSize, buffer.length);
});

test("DOCX extension, MIME, ZIP signature, and storage key are server-controlled", () => {
  const file = validateDocumentFile({
    originalname: "source.docx",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("PK\x03\x04docx source"),
  });

  assert.equal(file.extension, ".docx");
  assert.equal(file.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(
    buildDocumentStorageKey({
      organizationId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      versionId: "33333333-3333-4333-8333-333333333333",
      extension: ".docx",
    }).endsWith("/source.docx"),
    true
  );
});

test("parseable image-like PDF is marked as requiring OCR", async () => {
  const buffer = await fs.readFile(path.join(repositoryRoot, "test.pdf"));
  const metadata = await extractPdfMetadata(buffer);

  assert.ok(metadata.pageCount > 0);
  assert.equal(metadata.requiresOcr, true);
});

test("PDF extraction preserves real page boundaries and page order", async () => {
  const metadata = await extractPdfMetadata(
    await fs.readFile(path.join(repositoryRoot, "test.pdf"))
  );

  assert.equal(metadata.pageCount, 6);
  assert.equal(metadata.pages.length, 6);
  assert.deepEqual(metadata.pages.map((page) => page.pageNumber), [1, 2, 3, 4, 5, 6]);
  assert.equal(metadata.text, metadata.pages.map((page) => page.text).join("\f"));
});

test("PDF page rendering preserves text order and line boundaries", async () => {
  const pageText = await renderPdfPage({
    getTextContent: async () => ({
      items: [
        { str: "2. MAINTENANCE", transform: [1, 0, 0, 1, 0, 720] },
        { str: "The Lessee shall", transform: [1, 0, 0, 1, 0, 696] },
        { str: "maintain the Aircraft.", transform: [1, 0, 0, 1, 120, 696] },
      ],
    }),
  });

  assert.equal(pageText, "2. MAINTENANCE\nThe Lessee shall maintain the Aircraft.");
});

test("renamed non-PDF, empty, and oversized files are rejected", () => {
  assert.throws(
    () => validatePdfFile({
      originalname: "contract.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("not a pdf"),
    }),
    (error) => error.code === "INVALID_PDF"
  );

  assert.throws(
    () => validatePdfFile({
      originalname: "contract.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.alloc(0),
    }),
    (error) => error.code === "INVALID_FILE"
  );

  assert.throws(
    () => validatePdfFile({
      originalname: "contract.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(20 * 1024 * 1024)]),
    }),
    (error) => error.code === "FILE_TOO_LARGE"
  );
});

test("malformed PDF bytes fail parser validation", async () => {
  await assert.rejects(
    () => extractPdfMetadata(Buffer.from("%PDF-1.7\nmalformed source")),
    (error) => error.code === "INVALID_PDF"
  );
});

test("client-provided hash metadata cannot override the server hash", () => {
  const content = Buffer.from("server-owned-bytes");
  const source = Buffer.concat([Buffer.from("%PDF-1.7\n"), content]);
  const expectedHash = crypto.createHash("sha256").update(source).digest("hex");
  const file = validatePdfFile({
    originalname: "source.pdf",
    mimetype: "application/pdf",
    buffer: source,
    sha256: "client-controlled-hash",
  });

  assert.equal(calculateSha256(file.buffer), expectedHash);
  assert.notEqual(calculateSha256(file.buffer), "client-controlled-hash");
});

test("server hash is calculated from bytes and storage keys are server-shaped", () => {
  const content = Buffer.from("aviation-contract-source");
  const expectedHash = crypto.createHash("sha256").update(content).digest("hex");
  const storageKey = buildDocumentStorageKey({
    organizationId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
    versionId: "33333333-3333-4333-8333-333333333333",
  });

  assert.equal(calculateSha256(content), expectedHash);
  assert.equal(
    storageKey,
    "organizations/11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/source.pdf"
  );
  assert.throws(
    () => buildDocumentStorageKey({ organizationId: "../../other-org" }),
    (error) => error instanceof TypeError
  );
  assert.throws(
    () => buildDocumentStorageKey({
      organizationId: "11111111-1111-4111-8111-111111111111",
      documentId: "../../other-document",
      versionId: "33333333-3333-4333-8333-333333333333",
    }),
    (error) => error instanceof TypeError
  );
});
