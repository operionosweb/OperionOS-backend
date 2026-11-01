import assert from "node:assert/strict";
import test, { before } from "node:test";
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let engine;
before(async () => {
  const result = await build({
    absWorkingDir: root, entryPoints: ["src\\components\\matt\\mattIntelligence.js"],
    bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
  });
  engine = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
});

test("shared Matt preserves full prepared workspace intelligence categories and citations", () => {
  for (const question of [
    "What are my biggest contract risks?", "Which contracts need attention before renewal?",
    "Where is the largest modeled exposure?", "What commitments are due soon?",
    "Where does the contract mention termination?", "Where are the biggest intelligence gaps?",
    "What should I act on first?", "Which vendor is exposed?", "Compare termination language",
    "Show compliance requirements", "Show observed performance", "Summarise this contract",
  ]) {
    const answer = engine.askMattWorkspace(question, "demo-aircraft-lease");
    assert.equal(typeof answer.established, "boolean");
    assert.ok(answer.answer.length > 20, question);
    assert.ok(answer.findings.length > 0, question);
    assert.ok(Array.isArray(answer.evidence));
    if (answer.established) assert.ok(answer.evidence.length > 0, "Established answers retain source excerpts");
  }
});

test("unknown fuel exposure does not borrow unrelated modeled money; unsupported scopes fail explicitly", () => {
  const answer = engine.askMattWorkspace("What is our fuel price exposure?", "demo-aircraft-lease");
  assert.equal(answer.established, false);
  assert.deepEqual(answer.findings, []);
  assert.throws(() => engine.askMattWorkspace("Review risks", "missing-contract"), /unavailable/);
});

test("grounded obligations and named finding follow-ups retain the original contract assistant", () => {
  const answer = engine.askMattWorkspace("What are the key obligations?", "demo-aircraft-lease");
  assert.equal(answer.findings.length, 4);
  const followUp = engine.askMattWorkspace(`Explain obligation: ${answer.findings[0].label}`, "demo-aircraft-lease");
  assert.ok(followUp.evidence.length > 0);
  assert.equal(followUp.demonstration, true);
});
