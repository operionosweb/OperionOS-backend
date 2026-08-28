import { DEMO_CONTRACT_INTELLIGENCE } from "./demoContractIntelligence";

export const DOCUMENT_SEARCH_TOPICS = ["termination", "notice period", "insurance", "service credits", "liquidated damages", "renewal", "maintenance", "default", "return", "delivery"];
export const DOCUMENT_SEARCH_MODES = ["All Intelligence", "Document Search", "Intelligence Search", "Exact Phrase", "Keyword", "Clause", "Evidence", "Structured Term"];

export const DEMO_DOCUMENT_CONTRACTS = Object.entries(DEMO_CONTRACT_INTELLIGENCE).map(([id, contract]) => ({ id, ...contract }));

export function normalizeDocumentSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9€]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildDocumentSearchIndex() {
  return DEMO_DOCUMENT_CONTRACTS.flatMap((contract) => contract.clauses.map((clause) => {
    const related = {
      obligations: contract.commitments.filter((item) => item.clauseId === clause.id),
      risks: contract.riskRecords.filter((item) => item.clauseId === clause.id),
      financial: contract.commercialTerms.filter((item) => item.clauseId === clause.id),
      compliance: contract.complianceRequirements.filter((item) => item.clauseId === clause.id),
      performance: contract.performanceCommitments.filter((item) => item.clauseId === clause.id),
      lifecycle: contract.lifecycle.filter((item) => item.clauseId === clause.id),
      actions: contract.recommendations.filter((item) => item.clauseId === clause.id),
    };
    const structured = [clause.title, clause.category, clause.summary, clause.obligation, clause.actor, clause.trigger, clause.timing, clause.consequence, ...Object.values(related).flat().map((item) => Object.values(item).join(" "))].join(" ");
    return {
      id: `${contract.id}-${clause.id}`,
      contractId: contract.id,
      contractTitle: contract.title,
      counterparty: contract.counterparty,
      contractType: contract.type,
      contractStatus: contract.risk,
      clauseId: clause.id,
      clause,
      related,
      haystack: normalizeDocumentSearch(`${contract.title} ${contract.counterparty} ${contract.type} ${clause.title} ${clause.category} ${clause.text} ${structured}`),
      documentText: normalizeDocumentSearch(`${clause.title} ${clause.category} ${clause.text}`),
      structuredText: normalizeDocumentSearch(structured),
    };
  }));
}

export function searchDocumentIndex(index, query, mode = "All Intelligence", domain = "All domains", confidence = "All confidence") {
  const activeQuery = String(query || "").trim();
  const normalizedQuery = normalizeDocumentSearch(activeQuery);
  const exact = mode === "Exact Phrase";
  const terms = normalizedQuery.split(" ").filter(Boolean);
  return index.filter((result) => {
    if (domain !== "All domains" && !result.related[domain.toLowerCase()]?.length) return false;
    if (confidence === "High confidence" && Number.parseInt(result.clause.confidence, 10) < 95) return false;
    if (!normalizedQuery) return true;
    const source = mode === "Document Search" || mode === "Exact Phrase" || mode === "Evidence" ? result.documentText : mode === "Intelligence Search" || mode === "Structured Term" ? result.structuredText : mode === "Clause" ? normalizeDocumentSearch(`${result.clause.title} ${result.clause.category}`) : result.haystack;
    return exact ? source.includes(normalizedQuery) : terms.every((term) => source.includes(term));
  }).map((result) => ({ ...result, matchType: !activeQuery ? "Topic-ready evidence" : mode === "Exact Phrase" ? "Exact phrase match" : mode === "Clause" ? "Clause title match" : mode === "Structured Term" || mode === "Intelligence Search" ? "Structured contract term match" : "Keyword match" }));
}

export function relatedDocumentLinks(result) {
  const links = [];
  if (result.related.obligations.length) links.push(["Obligation", "/demo/contracts/demo-aircraft-lease"]);
  if (result.related.risks.length) links.push(["Risk", "/demo?view=exposure"]);
  if (result.related.financial.length) links.push(["Financial", "/demo?view=economics"]);
  if (result.related.compliance.length) links.push(["Compliance", "/demo?view=compliance"]);
  if (result.related.performance.length) links.push(["Performance", "/demo?view=performance"]);
  if (result.related.lifecycle.length) links.push(["Lifecycle", "/demo?view=lifecycle"]);
  if (result.related.actions.length) links.push(["Action", "/demo?view=actions"]);
  return links;
}
