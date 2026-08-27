import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(".");
const forbidden = /from\s+["']openai["']|new\s+OpenAI|chat\.completions|embeddings\.create|api\.openai\.com|api\.mistral\.ai|openrouter\.ai/;

function productionJavaScriptFiles(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "test") return [];
    if (entry.isDirectory()) return productionJavaScriptFiles(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

test("direct AI provider usage is limited to the gateway adapter", () => {
  const offenders = productionJavaScriptFiles()
    .filter((filePath) => !filePath.endsWith(path.join("services", "ai", "aiGateway.js")))
    .filter((filePath) => forbidden.test(fs.readFileSync(filePath, "utf8")));
  assert.deepEqual(offenders, [], `Provider calls found outside aiGateway.js: ${offenders.join(", ")}`);
});