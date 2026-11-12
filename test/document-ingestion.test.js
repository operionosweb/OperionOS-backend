import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import mammoth from "mammoth";
import { createCanvas } from "@napi-rs/canvas";
import { after, mock, test } from "node:test";
import { fileURLToPath } from "node:url";

import { getSupabaseClient } from "../config/supabase.js";
import {
  calculateSha256,
  extractDocumentMetadata,
  extractPdfMetadata,
  listDocumentVersions,
  ingestContractUpload,
  processPdfPageText,
  renderPdfPage,
  validateDocumentFile,
  validatePersistedTextLength,
  validatePdfPageExtraction,
  validatePdfFile,
} from "../services/documentIngestionService.js";
import { buildDocumentStorageKey } from "../services/documentStorageService.js";
import { terminateLocalPdfOcrWorker } from "../services/localPdfOcrService.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";
import { buildCanonicalPageSource } from "../services/phase3/source/deterministicSourcePageAdapter.js";
import { buildDeterministicObligationCandidates } from "../services/phase3/intelligence/deterministicObligationService.js";
import { toSafeHttpError } from "../utils/safeHttpError.js";

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

after(async () => {
  await terminateLocalPdfOcrWorker();
});

function createScannedPageImage(lines, { width = 1600, height = 2200 } = {}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111111";
  context.font = "bold 54px Arial";
  lines.forEach((line, index) => context.fillText(line, 100, 240 + index * 100));
  return canvas.toBuffer("image/png");
}

async function createSyntheticPdf(buildDocument) {
  const document = new PDFDocument({ size: "LETTER", margin: 36 });
  const chunks = [];
  document.on("data", (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => {
    document.once("end", resolve);
    document.once("error", reject);
  });
  await buildDocument(document);
  document.end();
  await completed;
  return Buffer.concat(chunks);
}

function mockUploadJournal(t, supabase, { actions = [], onReserve, reserveError = null, dispatchError = null, terminalError = null } = {}) {
  let runId;
  t.mock.method(supabase, "rpc", async (name, args) => {
    actions.push(`rpc:${name}${args.p_next_state ? `:${args.p_next_state}` : ""}`);
    if (name === "dispatch_contract_analysis") return { data: dispatchError ? null : runId, error: dispatchError };
    if (args.p_next_state === "ready") runId = args.p_analysis_run_id;
    if (name === "transition_contract_upload") return { data: null, error: args.p_next_state === "ready" ? terminalError : null };
    assert.equal(name, "reserve_contract_upload");
    if (reserveError) return { data: null, error: reserveError };
    onReserve?.(args);
    const documentId = args.p_document_id || args.p_new_document_id;
    return {
      data: {
        journal_id: crypto.randomUUID(),
        contract_id: args.p_contract_id || crypto.randomUUID(),
        document_id: documentId,
        version_id: args.p_version_id,
        version_number: 1,
        storage_key: buildDocumentStorageKey({
          organizationId: args.p_organization_id,
          documentId,
          versionId: args.p_version_id,
          extension: args.p_mime_type === "application/pdf" ? ".pdf" : ".docx",
        }),
      },
      error: null,
    };
  });
}

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

test("empty DOCX extraction is rejected before upload", async (t) => {
  t.mock.method(mammoth, "extractRawText", async () => ({ value: " \n " }));
  await assert.rejects(
    () => extractDocumentMetadata(Buffer.from("synthetic"), ".docx"),
    (error) => error.code === "SOURCE_TEXT_UNAVAILABLE" && error.status === 422
  );
});

test("synthetic PDF and DOCX uploads persist source and retain honest page evidence", async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-ingestion-key";
  const supabase = getSupabaseClient();
  t.after(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  const organizationId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const contractId = "33333333-3333-4333-8333-333333333333";
  const versionId = "44444444-4444-4444-8444-444444444444";
  const runId = "55555555-5555-4555-8555-555555555555";
  const pdf = await createSyntheticPdf((document) => {
    document.text("1. MAINTENANCE\nThe Lessee shall maintain the Aircraft in an airworthy condition.");
  });
  const docx = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));

  for (const [filename, mimetype, buffer, expectedPage] of [
    ["synthetic.pdf", "application/pdf", pdf, 1],
    ["synthetic.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx, null],
  ]) {
    await t.test(filename, async (subtest) => {
      const inserts = [];
      const uploads = [];
      mockUploadJournal(subtest, supabase);
      subtest.mock.method(supabase.storage, "from", () => ({
        async upload(key, bytes, options) {
          uploads.push({ key, bytes, options });
          return { error: null };
        },
        async download() { return { data: new Blob([buffer]), error: null }; },
      }));
      subtest.mock.method(supabase, "from", (table) => {
        let payload;
        const query = {
          insert(value) { payload = value; inserts.push({ table, value }); return this; },
          update() { return this; },
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() { return { data: null, error: null }; },
          async single() {
            const data = table === "contracts" ? { id: contractId, organization_id: organizationId }
              : table === "document_versions" ? { id: payload.id, document_id: payload.document_id, version_number: 1 }
                : table === "analysis_runs" ? { id: runId, status: "queued" }
                  : { id: payload?.id || crypto.randomUUID(), ...payload };
            return { data, error: null };
          },
          then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
        };
        return query;
      });

      const result = await ingestContractUpload({
        file: { originalname: filename, mimetype, buffer },
        organizationId,
        userId,
        requestId: "synthetic-upload",
        ocrProvider: null,
        withLock: async (_keys, operation) => operation(),
      });

      assert.equal(result.status, "ready");
      assert.equal(result.analysisRunId, runId);
      assert.equal(result.pageCount, expectedPage);
      assert.equal(uploads.length, 1);
      assert.match(uploads[0].key, new RegExp(`^organizations/${organizationId}/documents/${result.documentId}/versions/${result.documentVersionId}/source\\.(pdf|docx)$`));
      assert.deepEqual(uploads[0].bytes, buffer);
      assert.equal(uploads[0].options.upsert, false);
      const extraction = inserts.find((entry) => entry.table === "document_version_extractions").value;
      const pageRows = inserts.find((entry) => entry.table === "document_version_pages")?.value || [];
      assert.equal(pageRows.length, expectedPage || 0);
      const sections = inserts.filter((entry) => entry.table === "contract_sections").map((entry) => entry.value);
      if (!expectedPage) assert.ok(sections.every((section) => section.page_start === null && section.page_end === null));
      const source = buildCanonicalPageSource({
        documentVersion: { id: result.documentVersionId, organization_id: organizationId, mime_type: mimetype },
        document: { id: result.documentId, contract_id: contractId },
        analysisRun: { id: runId },
        extraction,
        pageRows,
      });
      const clause = segmentDeterministicClauses(source).find((item) => /maintain/i.test(item.source_text));
      assert.ok(clause);
      assert.equal(clause.evidence.page_number, expectedPage);
      assert.ok(source.text.includes(clause.evidence.excerpt));
      const obligations = buildDeterministicObligationCandidates(clause);
      assert.ok(obligations.some((obligation) => /maintain/i.test(obligation.description)));
    });
  }
});

test("parseable image-like PDF is marked as requiring OCR", async () => {
  const buffer = await fs.readFile(path.join(repositoryRoot, "test.pdf"));
  const originalHash = calculateSha256(buffer);
  const metadata = await extractPdfMetadata(buffer, { ocrProvider: null });

  assert.ok(metadata.pageCount > 0);
  assert.equal(metadata.requiresOcr, true);
  assert.ok(metadata.pages.some((page) => page.errorCode === "OCR_RUNTIME_UNAVAILABLE"));
  assert.equal(metadata.ocrSummary.unavailablePages, metadata.pages.filter((page) => page.errorCode === "OCR_RUNTIME_UNAVAILABLE").length);

  const withMockAdapter = await extractPdfMetadata(buffer, {
    ocrProvider: {
      async processPage({ pageNumber }) {
        return {
          status: "recognized",
          text: `Recognized local OCR fixture text for page ${pageNumber}.`,
          confidence: 0.93,
        };
      },
    },
  });
  assert.equal(withMockAdapter.requiresOcr, false);
  assert.equal(withMockAdapter.pages.length, metadata.pageCount);
  assert.ok(withMockAdapter.pages.every((page, index) => page.pageNumber === index + 1));
  assert.ok(withMockAdapter.pages.some((page) => page.extractionMethod === "ocr"));
  assert.equal(withMockAdapter.ocrSummary.failedPages, 0);
  assert.equal(calculateSha256(buffer), originalHash);
});

test("local OCR reads scanned and rotated PDF pages while preserving mixed-page provenance", async () => {
  const scan = createScannedPageImage([
    "AIRCRAFT LEASE SCHEDULE",
    "SECTION 2 - RENT",
    "The Lessee shall pay monthly rent of USD 175,000.",
    "SECTION 3 - MAINTENANCE RESERVES",
    "The Lessee shall pay airframe reserves of USD 450 per flight hour.",
    "Airframe Reserve        USD 450 per flight hour",
    "Engine Reserve          USD 300 per flight cycle",
    "Aircraft shall be returned in serviceable condition.",
  ]);
  const rotatedScan = createScannedPageImage([
    "TECHNICAL RECORDS",
    "The Lessee shall deliver complete maintenance records at redelivery.",
  ]);
  const buffer = await createSyntheticPdf(async (document) => {
    document.text("DIGITAL PAGE: This selectable text must not be sent to OCR.", 48, 80);
    document.addPage();
    document.image(scan, 36, 36, { width: 540 });
    document.addPage();
    document.image(createScannedPageImage([], { width: 800, height: 1100 }), 36, 36, { width: 540 });
    document.addPage();
    document.page.dictionary.data.Rotate = 90;
    document.image(rotatedScan, 36, 36, { width: 540 });
  });
  const originalHash = calculateSha256(buffer);

  const metadata = await extractPdfMetadata(buffer);

  assert.equal(metadata.pageCount, 4);
  assert.equal(metadata.requiresOcr, false);
  assert.deepEqual(metadata.pages.map(({ pageNumber }) => pageNumber), [1, 2, 3, 4]);
  assert.equal(metadata.pages[0].extractionMethod, "digital");
  assert.equal(metadata.pages[0].extractionStatus, "completed");
  assert.equal(metadata.pages[1].extractionMethod, "ocr");
  assert.ok(metadata.pages[1].confidence >= 0.2);
  assert.match(metadata.pages[1].text, /shall pay monthly rent of USD 175,000/i);
  assert.match(metadata.pages[1].text, /450/);
  assert.match(metadata.pages[1].text, /300/);
  assert.equal(metadata.pages[2].extractionMethod, "blank");
  assert.equal(metadata.pages[3].extractionMethod, "ocr");
  assert.match(metadata.pages[3].text, /TECHNICAL RECORDS/);
  assert.equal(metadata.ocrSummary.attemptedPages, 2);
  assert.equal(metadata.ocrSummary.completedPages, 2);
  assert.equal(metadata.ocrSummary.blankPages, 1);
  assert.equal(metadata.ocrSummary.failedPages, 0);
  assert.equal(metadata.pages[0].pageNumber, 1);
  assert.equal(metadata.pages[1].pageNumber, 2);
  assert.equal(metadata.pages[3].pageNumber, 4);
  assert.equal(calculateSha256(buffer), originalHash);
  assert.match(metadata.text, /DIGITAL PAGE/);
  assert.match(metadata.text, /175,000/);
  assert.match(metadata.text, /TECHNICAL RECORDS/);

  let pageStart = 0;
  const pages = metadata.pages.map((page) => {
    const charStart = pageStart;
    const charEnd = charStart + page.text.length;
    pageStart = charEnd + 1;
    return { page_number: page.pageNumber, char_start: charStart, char_end: charEnd };
  });
  const clauses = segmentDeterministicClauses({
    text: metadata.text,
    organizationId: "11111111-1111-4111-8111-111111111111",
    contractId: "22222222-2222-4222-8222-222222222222",
    documentId: "33333333-3333-4333-8333-333333333333",
    documentVersionId: "44444444-4444-4444-8444-444444444444",
    analysisRunId: "55555555-5555-4555-8555-555555555555",
    pageBoundaries: "explicit",
    pages,
    sourceLocator: (start, end) => `characters:${start}-${end}`,
  });
  const rentClause = clauses.find((clause) => /USD 175,000/.test(clause.source_text));
  assert.ok(rentClause);
  assert.equal(rentClause.evidence.page_number, 2);
  assert.ok(buildDeterministicObligationCandidates(rentClause).some((obligation) => (
    /USD 175,000/.test(obligation.description)
  )));
  await terminateLocalPdfOcrWorker();
});

test("low-confidence OCR output is blocked instead of accepted as extracted text", async () => {
  const page = await processPdfPageText({
    pageNumber: 2,
    digitalText: "",
    ocrProvider: {
      async processPage() {
        return { status: "unreadable", confidence: 0.08 };
      },
    },
  });

  assert.equal(page.extractionStatus, "failed");
  assert.equal(page.errorCode, "OCR_LOW_CONFIDENCE");
  assert.equal(page.confidence, 0.08);
});

test("local OCR flags a low-quality scanned page instead of marking it complete", async () => {
  const poorScan = createCanvas(1600, 2200);
  const context = poorScan.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, poorScan.width, poorScan.height);
  context.fillStyle = "#aaaaaa";
  context.font = "12px Arial";
  context.fillText("LOW QUALITY SCAN", 50, 100);
  const buffer = await createSyntheticPdf(async (document) => {
    document.image(createScannedPageImage([]), 36, 36, { width: 540 });
    document.addPage();
    document.image(poorScan.toBuffer("image/png"), 36, 36, { width: 540 });
  });

  const metadata = await extractPdfMetadata(buffer);

  assert.equal(metadata.requiresOcr, true);
  assert.equal(metadata.pages[0].extractionMethod, "blank");
  assert.equal(metadata.pages[1].extractionStatus, "failed");
  assert.equal(metadata.pages[1].errorCode, "OCR_LOW_CONFIDENCE");
  assert.ok(Number.isFinite(metadata.pages[1].confidence));
});

test("page OCR orchestration skips digital text and supports mixed digital, scanned, and blank pages", async () => {
  const calls = [];
  const ocrProvider = {
    async processPage(input) {
      calls.push(input.pageNumber);
      if (input.pageNumber === 2) {
        return { status: "recognized", text: "Scanned lease rent is USD 175,000 monthly.", confidence: 0.94 };
      }
      return { status: "blank" };
    },
  };
  const digital = await processPdfPageText({
    pageNumber: 1,
    digitalText: "This digital page already has selectable contract text.",
    ocrProvider,
  });
  const scanned = await processPdfPageText({
    pageData: { pageNumber: 2 },
    pageNumber: 2,
    digitalText: "",
    ocrProvider,
  });
  const blank = await processPdfPageText({
    pageData: { pageNumber: 3 },
    pageNumber: 3,
    digitalText: "",
    ocrProvider,
  });

  assert.equal(digital.extractionMethod, "digital");
  assert.equal(digital.text, "This digital page already has selectable contract text.");
  assert.deepEqual(calls, [2, 3]);
  assert.equal(scanned.extractionMethod, "ocr");
  assert.equal(scanned.pageNumber, 2);
  assert.equal(scanned.confidence, 0.94);
  assert.match(scanned.text, /USD 175,000/);
  assert.deepEqual(blank, {
    pageNumber: 3,
    text: "",
    extractionMethod: "blank",
    extractionStatus: "completed",
    confidence: null,
    errorCode: null,
  });
});

test("OCR preserves short selectable text alongside recognized text and blank scans", async () => {
  const recognized = await processPdfPageText({
    pageNumber: 1,
    digitalText: "2.1",
    ocrProvider: {
      async processPage() {
        return { status: "recognized", text: "Monthly rent is USD 175,000.", confidence: 0.9 };
      },
    },
  });
  const blank = await processPdfPageText({
    pageNumber: 2,
    digitalText: "2.2",
    ocrProvider: { async processPage() { return { status: "blank" }; } },
  });

  assert.match(recognized.text, /^2\.1\nMonthly rent/);
  assert.equal(blank.text, "2.2");
  assert.equal(blank.extractionStatus, "completed");
});

test("OCR exceptions and unreadable output remain explicit page failures", async () => {
  const failed = await processPdfPageText({
    pageNumber: 4,
    digitalText: "",
    ocrProvider: { async processPage() { throw new Error("private engine detail"); } },
  });
  const empty = await processPdfPageText({
    pageNumber: 5,
    digitalText: "",
    ocrProvider: { async processPage() { return { status: "recognized", text: "  ", confidence: 0.2 }; } },
  });

  assert.equal(failed.extractionStatus, "failed");
  assert.equal(failed.errorCode, "OCR_FAILED");
  assert.equal(empty.extractionStatus, "failed");
  assert.equal(empty.errorCode, "OCR_OUTPUT_INVALID");
  assert.doesNotMatch(JSON.stringify(failed), /private engine detail/);

  const timedOut = await processPdfPageText({
    pageNumber: 6,
    digitalText: "",
    ocrProvider: {
      async processPage() {
        throw Object.assign(new Error("timeout"), { code: "OCR_TIMEOUT" });
      },
    },
  });
  assert.equal(timedOut.extractionStatus, "failed");
  assert.equal(timedOut.errorCode, "OCR_TIMEOUT");
});

test("page provenance validator rejects duplicate or out-of-order page numbers", () => {
  assert.throws(
    () => validatePdfPageExtraction(2, [
      { pageNumber: 1, text: "first" },
      { pageNumber: 1, text: "duplicate" },
    ]),
    (error) => error.code === "PDF_PAGE_EXTRACTION_INCOMPLETE"
  );
});

test("PDF extraction preserves real page boundaries and page order", async () => {
  const metadata = await extractPdfMetadata(
    await fs.readFile(path.join(repositoryRoot, "test.pdf")),
    { ocrProvider: null }
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
        { str: "2. MAINTENANCE", width: 120, transform: [1, 0, 0, 1, 0, 720] },
        { str: "The Lessee shall", width: 120, transform: [1, 0, 0, 1, 0, 696] },
        { str: "maintain the Aircraft.", width: 110, transform: [1, 0, 0, 1, 120, 696] },
      ],
    }),
  });

  assert.equal(pageText, "2. MAINTENANCE\nThe Lessee shall maintain the Aircraft.");
});

test("PDF rendering preserves table column gaps as tab-delimited text", async () => {
  const pageText = await renderPdfPage({
    getTextContent: async () => ({
      items: [
        { str: "Monthly rent", width: 58, transform: [1, 0, 0, 1, 48, 700] },
        { str: "USD 175,000", width: 55, transform: [1, 0, 0, 1, 360, 700] },
      ],
    }),
  });

  assert.equal(pageText, "Monthly rent\tUSD 175,000");
});

test("PDF page extraction rejects missing or invalid page results", () => {
  assert.throws(
    () => validatePdfPageExtraction(3, ["page one", "page two"]),
    (error) => {
      assert.equal(error.code, "PDF_PAGE_EXTRACTION_INCOMPLETE");
      assert.equal(error.status, 422);
      assert.deepEqual(toSafeHttpError(error), {
        status: 422,
        body: {
          success: false,
          code: "PDF_PAGE_EXTRACTION_INCOMPLETE",
          error: "The uploaded PDF could not be fully extracted",
        },
      });
      return true;
    }
  );
  assert.throws(
    () => validatePdfPageExtraction(2, ["page one", null]),
    (error) => error.code === "PDF_PAGE_EXTRACTION_INCOMPLETE"
  );
});

test("over-limit extraction is rejected before the document can appear ready", () => {
  assert.doesNotThrow(() => validatePersistedTextLength("x".repeat(1_000_000)));
  assert.throws(
    () => validatePersistedTextLength("x".repeat(1_000_001)),
    (error) => {
      assert.equal(error.code, "DOCUMENT_TEXT_TOO_LARGE");
      assert.equal(error.status, 422);
      assert.equal(toSafeHttpError(error).status, 422);
      return true;
    }
  );
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
    () => validateDocumentFile({
      originalname: "contract.rtf",
      mimetype: "application/rtf",
      buffer: Buffer.from("source"),
    }),
    (error) => error.code === "UNSUPPORTED_FILE_TYPE"
  );

  assert.throws(
    () => validatePdfFile({
      originalname: "contract.pdf",
      mimetype: "application/octet-stream",
      buffer: Buffer.from("%PDF-1.7\nsource"),
    }),
    (error) => error.code === "UNSUPPORTED_FILE_TYPE"
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

test("failed ingestion retains owned records and blocks a repeated incomplete upload", async (t) => {
  const supabase = getSupabaseClient();
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  let document = null;
  const actions = [];
  mockUploadJournal(t, supabase, { actions, onReserve: (args) => { document = { id: args.p_new_document_id }; } });
  t.mock.method(supabase.storage, "from", () => ({
    async upload() { actions.push("upload"); return { error: null }; },
    async download() {
      return { data: new Blob([await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"))]), error: null };
    },
    async remove() { actions.push("remove"); return { error: null }; },
  }));
  t.mock.method(supabase, "from", (table) => {
    let payload;
    const query = {
      insert(value) { payload = value; actions.push(`insert:${table}`); return this; },
      update(value) { actions.push(`update:${table}:${value.status || value.extraction_status}`); return this; },
      delete() { actions.push(`delete:${table}`); return this; },
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() { return { data: table === "documents" ? document : null, error: null }; },
      async single() {
        if (table === "analysis_runs") return { data: null, error: { code: "synthetic" } };
        if (table === "documents") document = { id: payload.id };
        return { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
    };
    return query;
  });
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  const args = {
    file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
    organizationId, userId, requestId: "retained-failure-test",
    withLock: async (_keys, operation) => operation(),
  };
  await assert.rejects(ingestContractUpload(args), { code: "STORAGE_ERROR" });
  assert.ok(actions.includes("upload"));
  assert.ok(actions.includes("update:documents:failed"));
  assert.ok(actions.includes("update:document_versions:failed"));
  assert.ok(actions.indexOf("rpc:reserve_contract_upload") < actions.indexOf("upload"));
  assert.ok(actions.includes("rpc:transition_contract_upload:manual_review"));
  assert.equal(actions.some((action) => action === "remove" || action.startsWith("delete:")), false);
  const count = actions.length;
  await assert.rejects(ingestContractUpload(args), { code: "INGESTION_RECOVERY_REQUIRED" });
  assert.equal(actions.length, count);
});

test("observed lock loss during upload stops subsequent writes and leaves reserved records untouched", async (t) => {
  const supabase = getSupabaseClient();
  const actions = [];
  let lockLost = false;
  mockUploadJournal(t, supabase, { actions });
  t.mock.method(supabase.storage, "from", () => ({
    async upload() { actions.push("upload"); lockLost = true; return { error: null }; },
    async remove() { actions.push("remove"); return { error: null }; },
  }));
  t.mock.method(supabase, "from", (table) => {
    let payload;
    return {
      insert(value) { payload = value; actions.push(`insert:${table}`); return this; },
      update() { actions.push(`update:${table}`); return this; },
      delete() { actions.push(`delete:${table}`); return this; },
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() { return { data: null, error: null }; },
      async single() { return { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
    };
  });
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  await assert.rejects(ingestContractUpload({
    file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
    organizationId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    withLock: async (_keys, operation) => operation(() => {
      if (lockLost) throw Object.assign(new Error("synthetic disconnect"), { code: "OPERATION_LOCK_LOST" });
    }),
  }), { code: "OPERATION_LOCK_LOST" });
  assert.ok(actions.includes("rpc:reserve_contract_upload"));
  assert.ok(actions.includes("upload"));
  assert.equal(actions.includes("insert:analysis_runs"), false);
  assert.equal(actions.some((action) => action.startsWith("update:") || action.startsWith("delete:") || action === "remove"), false);
});

test("a failed version reservation does not create an untracked storage object", async (t) => {
  const supabase = getSupabaseClient();
  const actions = [];
  mockUploadJournal(t, supabase, { actions, reserveError: { code: "synthetic" } });
  t.mock.method(supabase.storage, "from", () => ({
    async upload() { actions.push("upload"); return { error: null }; },
  }));
  t.mock.method(supabase, "from", (table) => {
    let payload;
    return {
      insert(value) { payload = value; actions.push(`insert:${table}`); return this; },
      update(value) { actions.push(`update:${table}:${value.status}`); return this; },
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() { return { data: null, error: null }; },
      async single() {
        if (table === "document_versions") return { data: null, error: { code: "synthetic" } };
        return { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
    };
  });
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  await assert.rejects(ingestContractUpload({
    file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
    organizationId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    withLock: async (_keys, operation) => operation(),
  }), { code: "STORAGE_ERROR" });
  assert.equal(actions.includes("upload"), false);
  assert.equal(actions.some((action) => action.startsWith("update:")), false);
});

test("a partially failed processing-status write attempts to mark both owned records failed", async (t) => {
  const supabase = getSupabaseClient();
  const updates = [];
  const events = [];
  mockUploadJournal(t, supabase);
  t.mock.method(supabase.storage, "from", () => ({
    async upload() { return { error: null }; },
    async download() {
      return { data: new Blob([await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"))]), error: null };
    },
  }));
  t.mock.method(supabase, "from", (table) => {
    let payload;
    let update;
    return {
      insert(value) { payload = value; return this; },
      update(value) { update = value; updates.push({ table, value }); events.push(`${table}:${value.status || value.extraction_status}`); return this; },
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit() { return this; },
      async maybeSingle() { return { data: null, error: null }; },
      async single() { return { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null }; },
      then(resolve, reject) {
        if (table === "document_versions" && update?.extraction_status === "processing") {
          return Promise.reject(new Error("synthetic transport failure")).then(resolve, reject);
        }
        if (table === "documents" && update?.status === "processing") {
          return new Promise((done) => setTimeout(() => {
            events.push("documents:processing-settled");
            done({ data: null, error: null });
          }, 20)).then(resolve, reject);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      },
    };
  });
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  await assert.rejects(ingestContractUpload({
    file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
    organizationId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    withLock: async (_keys, operation) => operation(),
  }), { code: "STORAGE_ERROR" });
  assert.ok(updates.some(({ table, value }) => table === "documents" && value.status === "failed"));
  assert.ok(updates.some(({ table, value }) => table === "document_versions" && value.extraction_status === "failed"));
  assert.ok(updates.some(({ table, value }) => table === "analysis_runs" && value.status === "failed"));
  assert.ok(events.indexOf("documents:processing-settled") < events.indexOf("documents:failed"));
});

test("storage, integrity and structure failures never mark the journal ready", async (t) => {
  const supabase = getSupabaseClient();
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  for (const failure of ["upload", "checksum", "structure"]) {
    await t.test(failure, async (subtest) => {
      const actions = [];
      mockUploadJournal(subtest, supabase, { actions });
      subtest.mock.method(supabase.storage, "from", () => ({
        async upload() { return { error: failure === "upload" ? { code: "synthetic" } : null }; },
        async download() { return { data: new Blob([failure === "checksum" ? Buffer.from("incorrect") : buffer]), error: null }; },
      }));
      subtest.mock.method(supabase, "from", (table) => {
        let payload;
        return {
          insert(value) { payload = value; return this; },
          update() { return this; },
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() { return { data: null, error: null }; },
          async single() {
            return table === "contract_sections" && failure === "structure"
              ? { data: null, error: { code: "synthetic" } }
              : { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null };
          },
          then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
        };
      });
      await assert.rejects(ingestContractUpload({
        file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
        organizationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        withLock: async (_keys, operation) => operation(),
      }), { code: "STORAGE_ERROR" });
      assert.ok(actions.includes("rpc:transition_contract_upload:manual_review"));
      assert.equal(actions.includes("rpc:transition_contract_upload:ready"), false);
      if (failure !== "structure") assert.equal(actions.includes("rpc:transition_contract_upload:stored"), false);
    });
  }
});

test("uncertain terminal acknowledgements preserve ingestion without marking records failed", async (t) => {
  const supabase = getSupabaseClient();
  const buffer = await fs.readFile(path.join(repositoryRoot, "test", "fixtures", "step9-aircraft-lease.docx"));
  for (const boundary of ["terminal", "dispatch"]) {
    await t.test(boundary, async (subtest) => {
      const actions = [];
      mockUploadJournal(subtest, supabase, {
        actions,
        terminalError: boundary === "terminal" ? { code: "synthetic" } : null,
        dispatchError: boundary === "dispatch" ? { code: "synthetic" } : null,
      });
      subtest.mock.method(supabase.storage, "from", () => ({
        async upload() { return { error: null }; },
        async download() { return { data: new Blob([buffer]), error: null }; },
      }));
      subtest.mock.method(supabase, "from", (table) => {
        let payload;
        return {
          insert(value) { payload = value; return this; },
          update(value) { actions.push(`update:${table}:${value.status || value.extraction_status}`); return this; },
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() { return { data: null, error: null }; },
          async single() { return { data: { id: payload?.id || crypto.randomUUID(), ...payload }, error: null }; },
          then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
        };
      });
      await assert.rejects(ingestContractUpload({
        file: { originalname: "synthetic.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer },
        organizationId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        withLock: async (_keys, operation) => operation(),
      }), { code: boundary === "terminal" ? "STORAGE_ERROR" : "ANALYSIS_DISPATCH_PENDING" });
      assert.ok(actions.includes("rpc:transition_contract_upload:ready"));
      assert.equal(actions.includes("rpc:dispatch_contract_analysis"), boundary === "dispatch");
      assert.equal(actions.some((action) => action.endsWith(":failed")), false);
      assert.equal(actions.includes("rpc:transition_contract_upload:manual_review"), false);
    });
  }
});

test("duplicate upload returns the organization-scoped existing version before reparsing", async (t) => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const calls = [];
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "phase13-test-key";
  const supabase = getSupabaseClient();
  mock.method(supabase, "from", (table) => {
    const data = table === "contract_upload_journal" ? null : table === "document_versions"
      ? { id: "44444444-4444-4444-8444-444444444444", document_id: "33333333-3333-4333-8333-333333333333", extraction_status: "completed", processing_status: "processed" }
      : { id: "33333333-3333-4333-8333-333333333333", organization_id: organizationId, contract_id: "22222222-2222-4222-8222-222222222222", status: "ready" };
    const query = {
      select() {
        return this;
      },
      eq(column, value) {
        calls.push({ table, column, value });
        return this;
      },
      async maybeSingle() {
        return { data, error: null };
      },
    };
    return query;
  });
  t.after(() => {
    mock.restoreAll();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  const result = await ingestContractUpload({
    file: {
      originalname: "contract.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nmalformed source"),
    },
    organizationId,
    userId: "55555555-5555-4555-8555-555555555555",
    requestId: "phase13-duplicate-test",
    withLock: async (_keys, operation) => operation(),
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.status, "duplicate");
  assert.equal(result.documentId, "33333333-3333-4333-8333-333333333333");
  assert.equal(result.documentVersionId, "44444444-4444-4444-8444-444444444444");
  assert.equal(result.contractId, "22222222-2222-4222-8222-222222222222");
  assert.equal(calls.filter((call) => call.column === "organization_id").length, 3);
  assert.ok(calls.every((call) => call.column !== "sha256" || /^[0-9a-f]{64}$/.test(call.value)));
});

test("a partially persisted duplicate is not reported as a successful upload", async (t) => {
  const supabase = getSupabaseClient();
  t.mock.method(supabase, "from", (table) => {
    assert.equal(table, "document_versions");
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() {
        return { data: { extraction_status: "completed", processing_status: "failed" }, error: null };
      },
    };
  });
  await assert.rejects(ingestContractUpload({
    file: { originalname: "contract.pdf", mimetype: "application/pdf", buffer: Buffer.from("%PDF-synthetic") },
    organizationId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    withLock: async (_keys, operation) => operation(),
  }), { code: "INGESTION_RECOVERY_REQUIRED" });
});

test("document versions return the latest organization-scoped analysis run for workspace recovery", async (t) => {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const documentId = "22222222-2222-4222-8222-222222222222";
  const versionOneId = "33333333-3333-4333-8333-333333333333";
  const versionTwoId = "44444444-4444-4444-8444-444444444444";
  const calls = [];
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "phase26-version-run-test-key";
  const supabase = getSupabaseClient();
  mock.method(supabase, "from", (table) => {
    const result = table === "documents"
      ? { data: { id: documentId, organization_id: organizationId }, error: null }
      : table === "document_versions"
        ? {
            data: [
              { id: versionTwoId, document_id: documentId, organization_id: organizationId, version_number: 2 },
              { id: versionOneId, document_id: documentId, organization_id: organizationId, version_number: 1 },
            ],
            error: null,
          }
        : {
            data: [
              { id: "55555555-5555-4555-8555-555555555555", document_version_id: versionTwoId, status: "failed", created_at: "2026-11-06T12:00:00Z" },
              { id: "66666666-6666-4666-8666-666666666666", document_version_id: versionTwoId, status: "completed", created_at: "2026-11-05T12:00:00Z" },
              { id: "77777777-7777-4777-8777-777777777777", document_version_id: versionOneId, status: "completed", created_at: "2026-11-04T12:00:00Z" },
            ],
            error: null,
          };
    const query = {
      select() { return this; },
      eq(column, value) {
        calls.push({ table, column, value });
        return this;
      },
      in(column, value) {
        calls.push({ table, column, value });
        return this;
      },
      order(column, options) {
        calls.push({ table, column, options });
        return this;
      },
      async maybeSingle() { return result; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
    return query;
  });
  t.after(() => {
    mock.restoreAll();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  const versions = await listDocumentVersions(documentId, organizationId);

  assert.deepEqual(versions.map(({ id, analysis_run_id, analysis_run_status }) => ({
    id,
    analysis_run_id,
    analysis_run_status,
  })), [
    {
      id: versionTwoId,
      analysis_run_id: "55555555-5555-4555-8555-555555555555",
      analysis_run_status: "failed",
    },
    {
      id: versionOneId,
      analysis_run_id: "77777777-7777-4777-8777-777777777777",
      analysis_run_status: "completed",
    },
  ]);
  assert.ok(calls.some((call) => call.table === "analysis_runs"
    && call.column === "organization_id"
    && call.value === organizationId));
  assert.ok(calls.some((call) => call.table === "analysis_runs"
    && call.column === "document_version_id"
    && call.value.length === 2));
  assert.ok(calls.some((call) => call.table === "analysis_runs"
    && call.column === "created_at"
    && call.options.ascending === false));
});
