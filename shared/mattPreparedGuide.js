import { OPERION_PLATFORM_KNOWLEDGE, readOperionPlatformKnowledge } from "./operionPlatformKnowledge.js";

export function preparedPlatformGuide(question) {
  const text = String(question).toLowerCase();
  const words = (text.match(/[a-z]{4,}/g) || []).filter((word) => !["what", "which", "does", "with", "have", "this", "that", "work", "features"].includes(word));
  const statusOverview = /\b(operational|implemented|available|status|ready)\b/.test(text)
    && /\b(features?|capabilities|operion|platform)\b/.test(text);
  const scored = OPERION_PLATFORM_KNOWLEDGE.map((item) => ({
    item, score: words.reduce((score, word) => score
      + (item.title.toLowerCase().includes(word) ? 4 : 0)
      + (`${item.description} ${item.workflow}`.toLowerCase().includes(word) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const selected = statusOverview ? [...OPERION_PLATFORM_KNOWLEDGE]
    : scored.filter((entry) => entry.score > 0).slice(0, 3).map((entry) => entry.item);
  if (!selected.length) selected.push(OPERION_PLATFORM_KNOWLEDGE[0]);
  const sources = readOperionPlatformKnowledge().evidence;
  return {
    answer: `Prepared platform guide, not a generated AI response.\n${selected.map((item) => `${item.title} [${item.status}]: ${item.description} ${item.workflow}`).join("\n\n")}`,
    established: true, source: "prepared_platform_guide",
    findings: selected.map((item) => ({ id: item.id, type: "platform", label: `${item.title}: ${item.status}` })),
    evidence: sources.filter((source) => selected.some((item) => item.id === source.id)),
    limitations: ["Reviewed product documentation only. This guide does not inspect customer data, answer a contractual question or establish operational provider readiness."],
  };
}
