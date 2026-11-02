import test from "node:test";
import assert from "node:assert/strict";
import { preparedPlatformGuide } from "../shared/mattPreparedGuide.js";
import { OPERION_PLATFORM_KNOWLEDGE } from "../shared/operionPlatformKnowledge.js";

test("prepared guidance prioritizes Globe and source evidence rather than generic contract words", () => {
  for (const [question, expected] of [
    ["How does the Globe work?", "platform:aviation"],
    ["Explain Globe aircraft context", "platform:aviation"],
    ["How do I access evidence?", "platform:reports"],
    ["How are reports generated?", "platform:reports"],
    ["How do I upload a contract?", "platform:ingestion"],
  ]) {
    const answer = preparedPlatformGuide(question);
    assert.equal(answer.findings[0].id, expected, question);
    assert.equal(answer.source, "prepared_platform_guide");
    assert.match(answer.answer, /not a generated AI response/);
    assert.ok(answer.evidence.every((source) => answer.findings.some((finding) => finding.id === source.id)));
  }
});

test("operational status questions include all reviewed capability boundaries, not only Demo aviation", () => {
  for (const question of ["Which features are operational?", "What platform capabilities are available?", "What is the status of Operion?"]) {
    const result = preparedPlatformGuide(question);
    assert.deepEqual(result.findings.map((item) => item.id), OPERION_PLATFORM_KNOWLEDGE.map((item) => item.id));
    for (const status of ["implemented", "configuration_required", "demo_only", "roadmap"]) assert.match(result.answer, new RegExp(`\\[${status}\\]`));
    assert.match(result.answer, /not verified live telemetry/);
    assert.match(result.answer, /persistent production Matt have not been verified/);
  }
});
