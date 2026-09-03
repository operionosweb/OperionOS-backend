import crypto from "node:crypto";

const DEFAULT_CHUNK_SIZE = 4000;
const HEADING_PATTERN = /^(?:(?:ARTICLE|SECTION)\s+)?(\d+(?:\.\d+)*)\s*(?:[-:.)]\s*|\s+)(.+)$/i;

function isHeading(line) {
  const text = line.trim();
  if (!text || text.length > 120 || /[.;!?]$/.test(text)) return false;
  const numbered = HEADING_PATTERN.exec(text);
  if (numbered && !/\b(shall|may|must|will|is|are|provide|required)\b/i.test(numbered[2])) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  return Boolean(letters) && (letters === letters.toUpperCase() || text.split(/\s+/).every((word) => /^[A-Z][A-Za-z0-9/&(),'-]*$/.test(word)));
}

function headingDetails(line) {
  const text = line.trim();
  const match = HEADING_PATTERN.exec(text);
  if (match) {
    const clauseNumber = match[1];
    return { heading: match[2].trim(), clauseNumber, structure: clauseNumber.includes(".") ? "subsection" : "section" };
  }
  return { heading: text, clauseNumber: null, structure: "section" };
}

function buildPages(text) {
  const pages = [];
  let start = 0;
  const pageParts = text.split("\f");
  pageParts.forEach((pageText, index) => {
    const end = start + pageText.length;
    pages.push({ pageNumber: index + 1, text: pageText, charStart: start, charEnd: end });
    start = end + 1;
  });
  return pages.filter((page) => page.text.length > 0 || pages.length === 1);
}

function buildSections(text) {
  const lines = [...text.matchAll(/.*(?:\r\n|\n|\r|$)/g)]
    .filter((match) => match[0].length > 0)
    .map((match) => ({ text: match[0].replace(/(?:\r\n|\n|\r)$/, ""), start: match.index }));
  const headings = lines.filter((line) => isHeading(line.text));
  if (!headings.length) {
    return [{ heading: "Document content", clauseNumber: null, structure: "unstructured", text, charStart: 0, charEnd: text.length, parentIndex: null }];
  }

  const sections = [];
  if (headings[0].start > 0 && text.slice(0, headings[0].start).trim()) {
    sections.push({ heading: "Preamble", clauseNumber: null, structure: "preamble", text: text.slice(0, headings[0].start), charStart: 0, charEnd: headings[0].start, parentIndex: null });
  }
  headings.forEach((line, index) => {
    const details = headingDetails(line.text);
    const charEnd = headings[index + 1]?.start ?? text.length;
    const parentNumber = details.clauseNumber?.includes(".")
      ? details.clauseNumber.split(".").slice(0, -1).join(".")
      : null;
    const parentIndex = parentNumber
      ? sections.findIndex((section) => section.clauseNumber === parentNumber)
      : null;
    sections.push({ ...details, text: text.slice(line.start, charEnd), charStart: line.start, charEnd, parentIndex: parentIndex >= 0 ? parentIndex : null });
  });
  return sections;
}

function buildChunks(sections, chunkSize) {
  const chunks = [];
  sections.forEach((section, sectionIndex) => {
    for (let offset = 0; offset < section.text.length; offset += chunkSize) {
      const text = section.text.slice(offset, offset + chunkSize);
      if (!text) continue;
      chunks.push({
        sectionIndex,
        chunkIndex: chunks.length,
        text,
        charStart: section.charStart + offset,
        charEnd: section.charStart + offset + text.length,
        contentHash: crypto.createHash("sha256").update(text).digest("hex"),
      });
    }
  });
  return chunks;
}

export function parseDocumentStructure({ text, chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    const error = new Error("Document text is required for structural parsing");
    error.code = "SOURCE_TEXT_UNAVAILABLE";
    error.status = 422;
    throw error;
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new TypeError("chunkSize must be a positive integer");

  const pages = buildPages(text);
  const sections = buildSections(text);
  return {
    text,
    pageBoundaries: pages.some((page) => page.charEnd < text.length) ? "explicit" : "derived_unavailable",
    pages,
    sections,
    chunks: buildChunks(sections, chunkSize),
  };
}

export function buildAnalysisPageRows({ organizationId, contractId, documentId, documentVersionId, analysisRunId, pages }) {
  if (!organizationId || !contractId || !documentId || !documentVersionId || !analysisRunId || !Array.isArray(pages)) {
    throw new TypeError("Analysis page persistence context is incomplete");
  }
  return pages.map((page) => ({
    organization_id: organizationId,
    contract_id: contractId,
    document_id: documentId,
    document_version_id: documentVersionId,
    analysis_run_id: analysisRunId,
    page_number: page.pageNumber,
    text_content: page.text,
    text_length: page.text.length,
    char_start: page.charStart,
    char_end: page.charEnd,
    text_hash: crypto.createHash("sha256").update(page.text).digest("hex"),
    extraction_status: "completed",
  }));
}

export async function persistDocumentStructure({ supabase, organizationId, contractId, documentId, documentVersionId, analysisRunId, structure }) {
  if (!supabase || !organizationId || !contractId || !documentId || !documentVersionId || !analysisRunId || !structure) throw new TypeError("Structure persistence context is incomplete");
  const sectionIds = [];
  if (structure.pages.length) {
    const documentPageRows = structure.pages.map((page) => ({
      organization_id: organizationId,
      contract_id: contractId,
      document_id: documentId,
      document_version_id: documentVersionId,
      page_number: page.pageNumber,
      text_content: page.text,
      text_length: page.text.length,
      char_start: page.charStart,
      char_end: page.charEnd,
      text_hash: crypto.createHash("sha256").update(page.text).digest("hex"),
    }));
    const analysisPageRows = buildAnalysisPageRows({ organizationId, contractId, documentId, documentVersionId, analysisRunId, pages: structure.pages });
    const [documentPagesResult, analysisPagesResult] = await Promise.all([
      supabase.from("contract_document_pages").insert(documentPageRows),
      supabase.from("document_version_pages").insert(analysisPageRows),
    ]);
    if (documentPagesResult.error || analysisPagesResult.error) throw Object.assign(new Error("Document page persistence failed"), { code: "STORAGE_ERROR" });
  }
  for (const [sectionIndex, section] of structure.sections.entries()) {
    const parentSectionId = section.parentIndex === null ? null : sectionIds[section.parentIndex] || null;
    const { data, error } = await supabase.from("contract_sections").insert({
      organization_id: organizationId,
      contract_id: contractId,
      document_id: documentId,
      document_version_id: documentVersionId,
      parent_section_id: parentSectionId,
      heading: section.heading,
      section_order: sectionIndex,
      page_start: structure.pages.find((page) => section.charStart >= page.charStart && section.charStart <= page.charEnd)?.pageNumber || null,
      page_end: structure.pages.find((page) => section.charEnd <= page.charEnd)?.pageNumber || null,
      source_text: section.text,
      metadata: { clause_number: section.clauseNumber, structure: section.structure, char_start: section.charStart, char_end: section.charEnd },
    }).select("id").single();
    if (error || !data) throw Object.assign(new Error("Document section persistence failed"), { code: "STORAGE_ERROR" });
    sectionIds[sectionIndex] = data.id;
  }

  if (structure.chunks.length) {
    const { error } = await supabase.from("contract_document_chunks").insert(structure.chunks.map((chunk) => ({
      organization_id: organizationId,
      contract_id: contractId,
      document_id: documentId,
      document_version_id: documentVersionId,
      section_id: sectionIds[chunk.sectionIndex] || null,
      page_number: structure.pages.find((page) => chunk.charStart >= page.charStart && chunk.charStart <= page.charEnd)?.pageNumber || null,
      chunk_order: chunk.chunkIndex,
      source_text: chunk.text,
      content_hash: chunk.contentHash,
      metadata: { char_start: chunk.charStart, char_end: chunk.charEnd },
    })));
    if (error) throw Object.assign(new Error("Document chunk persistence failed"), { code: "STORAGE_ERROR" });
  }
  return { pages: structure.pages.length, sections: structure.sections.length, chunks: structure.chunks.length };
}

export const documentStructureConstants = Object.freeze({ defaultChunkSize: DEFAULT_CHUNK_SIZE });
