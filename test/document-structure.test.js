import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisPageRows, parseDocumentStructure } from "../services/documentStructureService.js";

test("document structure parser derives pages, sections, subsections, and chunks", () => {
  const text = [
    "Agreement preamble.",
    "\f",
    "1. Maintenance",
    "The aircraft shall remain airworthy.",
    "",
    "1.1 Records",
    "The lessee shall provide records.",
  ].join("\n");
  const structure = parseDocumentStructure({ text, chunkSize: 40 });

  assert.equal(structure.pages.length, 2);
  assert.equal(structure.pageBoundaries, "explicit");
  assert.equal(structure.sections.length, 3);
  assert.equal(structure.sections[1].clauseNumber, "1");
  assert.equal(structure.sections[2].clauseNumber, "1.1");
  assert.equal(structure.sections[2].parentIndex, 1);
  assert.ok(structure.chunks.length >= 3);
  for (const chunk of structure.chunks) {
    assert.equal(chunk.text, text.slice(chunk.charStart, chunk.charEnd));
    assert.match(chunk.contentHash, /^[0-9a-f]{64}$/);
  }
});

test("document structure parser handles unstructured text deterministically", () => {
  const text = "A short source document with no recognizable headings.";
  const first = parseDocumentStructure({ text, chunkSize: 12 });
  const second = parseDocumentStructure({ text, chunkSize: 12 });

  assert.equal(first.pages.length, 1);
  assert.equal(first.sections[0].structure, "unstructured");
  assert.deepEqual(first.chunks, second.chunks);
});

test("document structure parser rejects missing text", () => {
  assert.throws(
    () => parseDocumentStructure({ text: "" }),
    (error) => error.code === "SOURCE_TEXT_UNAVAILABLE" && error.status === 422
  );
});

test("analysis page rows retain tenant, run, page, and character provenance", () => {
  const structure = parseDocumentStructure({ text: "Page one\fPage two" });
  const rows = buildAnalysisPageRows({
    organizationId: "11111111-1111-4111-8111-111111111111",
    contractId: "22222222-2222-4222-8222-222222222222",
    documentId: "33333333-3333-4333-8333-333333333333",
    documentVersionId: "44444444-4444-4444-8444-444444444444",
    analysisRunId: "55555555-5555-4555-8555-555555555555",
    pages: structure.pages,
  });

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.page_number), [1, 2]);
  assert.ok(rows.every((row) => row.organization_id === "11111111-1111-4111-8111-111111111111"));
  assert.ok(rows.every((row) => row.analysis_run_id === "55555555-5555-4555-8555-555555555555"));
  assert.equal(rows[1].text_content, "Page two");
  assert.equal(rows[1].char_start, 9);
  assert.match(rows[1].text_hash, /^[0-9a-f]{64}$/);
});