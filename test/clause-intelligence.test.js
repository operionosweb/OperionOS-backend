import assert from "node:assert/strict";
import test from "node:test";
import { selectRelevantChunks, validateSemanticClauses } from "../services/clauseIntelligenceService.js";

test("candidate selection ranks relevant structural chunks and caps the set", () => {
  const chunks = Array.from({ length: 20 }, (_, index) => ({
    chunk_order: index,
    source_text: index % 2 === 0 ? "The lessee shall maintain insurance and pay rent." : "Background narrative.",
  }));
  const selected = selectRelevantChunks(chunks);

  assert.equal(selected.length, 10);
  assert.ok(selected.every((chunk) => chunk.relevanceScore > 0));
  assert.deepEqual(selected.map((chunk) => chunk.chunk_order), [...selected].sort((a, b) => a.chunk_order - b.chunk_order).map((chunk) => chunk.chunk_order));
});

test("semantic clause output requires provenance and bounded confidence", () => {
  const result = validateSemanticClauses({ clauses: [{
    title: "Payment",
    category: "commercial/payment",
    source_chunk_indexes: [2],
    source_text: "The lessee shall pay rent.",
    confidence: 0.91,
    review_status: "pending",
  }] });
  assert.equal(result[0].title, "Payment");

  assert.throws(
    () => validateSemanticClauses({ clauses: [{ title: "Invalid", category: "unknown", source_chunk_indexes: [], source_text: "x", confidence: 2, review_status: "pending" }] }),
    (error) => error.code === "INVALID_SEMANTIC_OUTPUT"
  );
});