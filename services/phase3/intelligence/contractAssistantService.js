const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "before", "by", "can", "do", "does",
  "for", "from", "how", "i", "if", "in", "is", "it", "me", "of", "on", "our", "the",
  "this", "to", "us", "what", "when", "where", "which", "who", "with",
]);

const CONCEPTS = Object.freeze({
  late: ["delay", "delayed", "overdue", "penalty", "redelivery", "return"],
  return: ["redelivery", "redeliver", "returned"],
  termination: ["terminate", "default", "cancellation", "notice"],
  maintenance: ["maintain", "repair", "airworthiness", "mro"],
  grounding: ["grounded", "aog", "airworthiness", "event"],
  penalty: ["penalties", "fee", "charge", "damages", "financial"],
  notice: ["notification", "notify", "period"],
});

function tokens(value) {
  const base = String(value || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  const meaningful = base.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  return new Set(meaningful.flatMap((token) => [token, ...(CONCEPTS[token] || [])]));
}

function textFor(type, item) {
  if (type === "clause") return [item.clause_number, item.title, item.category, item.source_text].filter(Boolean).join(" ");
  if (type === "obligation") return [item.description, item.obligation_type, item.actor, item.action, item.object, item.modality, item.condition, item.trigger_expression, item.timing_expression, item.frequency, item.consequence].filter(Boolean).join(" ");
  if (type === "deadline") return [item.deadline_type, item.original_expression, item.timing_expression, item.trigger_expression, item.condition, item.anchor_reference, item.computability, item.status].filter(Boolean).join(" ");
  return [item.title, item.risk_category, item.risk_type, item.description, item.rationale, item.consequence, item.exposure, item.status].filter(Boolean).join(" ");
}

function score(queryTokens, value) {
  const candidateTokens = tokens(value);
  let matches = 0;
  for (const token of queryTokens) if (candidateTokens.has(token)) matches += 1;
  return matches;
}

function summarize(type, item) {
  if (type === "risk") {
    return [item.title, item.rationale || item.description, item.consequence].filter(Boolean).join(": ");
  }
  if (type === "obligation") {
    const commitment = [item.actor, item.action, item.object].filter(Boolean).join(" ") || item.description;
    return [commitment, item.timing_expression || item.frequency, item.consequence].filter(Boolean).join(". ");
  }
  if (type === "deadline") {
    return [item.timing_expression || item.original_expression, item.trigger_expression || item.anchor_reference, item.status].filter(Boolean).join(". ");
  }
  return [item.title || item.clause_number, item.source_text].filter(Boolean).join(": ");
}

function sourceFromLink(link) {
  if (!link) return null;
  return link.source || null;
}

function publicEvidence(source) {
  if (!source?.excerpt) return null;
  return {
    id: source.id || source.evidence_id || null,
    excerpt: source.excerpt,
    page_number: source.page_number ?? null,
    char_start: source.char_start ?? null,
    char_end: source.char_end ?? null,
    source_locator: source.source_locator || null,
    confidence: source.confidence ?? null,
  };
}

function evidenceForFinding(finding, allEvidence) {
  const linked = (finding.item.evidence || []).map(sourceFromLink).find((source) => source?.excerpt);
  if (linked) return publicEvidence(linked);

  const directId = finding.item.source_evidence_id;
  if (directId) {
    const direct = allEvidence.find((source) => source.id === directId);
    if (direct) return publicEvidence(direct);
  }

  const findingText = textFor(finding.type, finding.item);
  const ranked = allEvidence
    .map((source) => ({ source, score: score(tokens(findingText), source.excerpt) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  return publicEvidence(ranked[0]?.source);
}

export function answerContractQuestion({ question, clauses = [], obligations = [], deadlines = [], risks = [], evidence = [] }) {
  const normalizedQuestion = String(question || "").trim();
  if (normalizedQuestion.length < 3 || normalizedQuestion.length > 500) {
    throw Object.assign(new Error("Question must contain between 3 and 500 characters"), { code: "INVALID_ASSISTANT_QUESTION", status: 400 });
  }

  const queryTokens = tokens(normalizedQuestion);
  const findings = [
    ...clauses.map((item) => ({ type: "clause", item })),
    ...obligations.map((item) => ({ type: "obligation", item })),
    ...deadlines.map((item) => ({ type: "deadline", item })),
    ...risks.map((item) => ({ type: "risk", item })),
  ].map((finding) => ({ ...finding, score: score(queryTokens, textFor(finding.type, finding.item)) }))
    .filter((finding) => finding.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const grounded = findings.map((finding) => ({
    ...finding,
    evidence: evidenceForFinding(finding, evidence),
  })).filter((finding) => finding.evidence);

  if (!grounded.length) {
    return {
      established: false,
      answer: "The available contract intelligence does not establish an evidence-backed answer to this question.",
      findings: [],
      evidence: [],
      source: "structured_intelligence",
      intelligenceConsumption: 0,
    };
  }

  const uniqueEvidence = [];
  const evidenceKeys = new Set();
  for (const finding of grounded) {
    const key = finding.evidence.id || `${finding.evidence.source_locator}:${finding.evidence.excerpt}`;
    if (!evidenceKeys.has(key)) {
      evidenceKeys.add(key);
      uniqueEvidence.push(finding.evidence);
    }
  }

  return {
    established: true,
    answer: grounded.map((finding) => summarize(finding.type, finding.item)).filter(Boolean).join(" "),
    findings: grounded.map(({ type, item }) => ({
      type,
      id: item.id,
      label: item.title || item.description || item.timing_expression || item.clause_number || type,
    })),
    evidence: uniqueEvidence,
    source: "structured_intelligence",
    intelligenceConsumption: 0,
  };
}
