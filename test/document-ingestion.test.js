import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateSha256,
  extractDocumentMetadata,
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

  test("existing synthetic DOCX fixture extracts ordered clause text with unknown page count", async () => {
    const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
    const metadata = await extractDocumentMetadata(buffer, ".docx");
    const expected = [
      "AIRCRAFT LEASE AGREEMENT",
      "1. MAINTENANCE AND AIRWORTHINESS",
      "The Lessee shall maintain the Aircraft in an airworthy condition throughout the Lease Term and shall notify the Lessor of material damage within five Business Days after discovery.",
      "2. RETURN CONDITIONS",
      "The Lessee shall return the Aircraft to the Lessor at the Return Location on the Expiry Date in airworthy condition with all maintenance records complete.",
      "3. LATE RETURN",
      "If the Lessee returns the Aircraft after the Expiry Date, the Lessee shall pay late return compensation of EUR 25,000 for each calendar day until the Aircraft is returned. This obligation does not limit the Lessor's other contractual rights.",
      "4. TERMINATION NOTICE",
      "The Lessor may terminate this Agreement for an uncured material breach by giving the Lessee 30 calendar days written notice. The Lessee may cure the breach during that notice period.",
      "5. INSURANCE",
      "The Lessee shall maintain hull and aviation liability insurance throughout the Lease Term and provide evidence of renewal no later than 15 calendar days before policy expiry.",
      "6. RETURN INSPECTION",
      "The Lessee shall make the Aircraft and its records available for return inspection at least 10 Business Days before the Expiry Date.",
      "7. PAYMENT DEFAULT",
      "Any rent unpaid for more than five calendar days after its due date incurs a late payment charge of EUR 10,000.",
    ];
    assert.deepEqual(metadata.text.split("\n").filter((line) => line.length), expected);
    assert.equal(metadata.pageCount, null);
    assert.equal(metadata.requiresOcr, false);
    assert.deepEqual(await extractDocumentMetadata(buffer, ".docx"), metadata);
  });

  test("malformed DOCX ZIP-signature bytes fail actual local parser validation", async () => {
    const file = validateDocumentFile({
      originalname: "malformed.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("PK\x03\x04not a complete DOCX archive"),
    });
    await assert.rejects(
      () => extractDocumentMetadata(file.buffer, ".docx"),
      (error) => error.code === "INVALID_DOCX" && error.status === 400
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
