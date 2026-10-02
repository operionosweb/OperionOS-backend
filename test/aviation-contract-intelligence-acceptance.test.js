import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createContractIntelligencePipeline } from "../services/phase3/analysis/contractIntelligencePipeline.js";
import { screenDeterministicRiskCandidates } from "../services/phase3/intelligence/contractRiskIntelligenceService.js";
import { parseTemporalExpression } from "../services/phase3/intelligence/deadlineIntelligenceService.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";
import { buildDeterministicObligationCandidate } from "../services/phase3/intelligence/deterministicObligationService.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

const expectedClause = (title, category, evidenceText) => ({ sourceClause: title, title, category, evidenceText });
const expectedObligation = (sourceClause, actor, action, objectIncludes, evidenceText, additional = {}) => ({ sourceClause, actor, action, objectIncludes, evidenceText, ...additional });
const expectedDeadline = (sourceClause, deadlineType, timingIncludes, status, evidenceText) => ({ sourceClause, deadlineType, timingIncludes, status, evidenceText });
const expectedRisk = (sourceClause, riskType, severity, evidenceText) => ({ sourceClause, riskType, severity, evidenceText });

const CORPUS = [
  {
    name: "Aircraft Lease",
    contractClass: "AIRCRAFT_LEASE",
    fixture: "test/fixtures/synthetic-aircraft-lease.txt",
    format: "pdf",
    expected: {
      clauses: [
        expectedClause("Preamble", "general", "SYNTHETIC AIRCRAFT LEASE AGREEMENT"),
        expectedClause("AIRCRAFT", "general", "Aircraft Registration"),
        expectedClause("TERM", "general", "Effective Date"),
        expectedClause("RENT", "commercial/payment", "monthly rent"),
        expectedClause("SECURITY", "commercial/payment", "security deposit"),
        expectedClause("MAINTENANCE RESERVES", "commercial/payment", "maintenance reserve"),
        expectedClause("MAINTENANCE AND AIRWORTHINESS", "maintenance", "airworthy condition"),
        expectedClause("INSURANCE", "insurance", "hull all risks insurance"),
        expectedClause("TECHNICAL RECORDS", "maintenance", "shop visit"),
        expectedClause("RETURN CONDITIONS", "delivery/redelivery", "return the Aircraft"),
        expectedClause("TERMINATION AND NOTICE", "termination/default", "Event of Default"),
        expectedClause("EXTENSION OPTION", "renewal/notice", "180 days"),
        expectedClause("COMPLIANCE", "compliance/sanctions", "aviation laws"),
        expectedClause("GOVERNING LAW", "governing law/dispute resolution", "England and Wales"),
      ],
      obligations: [
        expectedObligation("RENT", "Lessee", "pay", "monthly rent", "monthly rent"),
        expectedObligation("SECURITY", "Lessee", "pay", "security deposit", "security deposit"),
        expectedObligation("MAINTENANCE RESERVES", "Lessee", "pay", "maintenance reserve", "maintenance reserve"),
        expectedObligation("MAINTENANCE AND AIRWORTHINESS", "Lessee", "maintain", "Aircraft", "maintain the Aircraft"),
        expectedObligation("INSURANCE", "Lessee", "maintain", "insurance", "hull all risks insurance"),
        expectedObligation("TECHNICAL RECORDS", "Lessee", "provide", "maintenance records", "shop visit"),
        expectedObligation("RETURN CONDITIONS", "Lessee", "return", "Aircraft", "return the Aircraft"),
        expectedObligation("TERMINATION AND NOTICE", "Lessor", "terminate", "Agreement", "may terminate", { modality: "discretionary" }),
        expectedObligation("EXTENSION OPTION", "Lessee", "extend", "Term", "extend the Term", { modality: "discretionary" }),
        expectedObligation("COMPLIANCE", "Lessee", "operate", "Aircraft", "operate the Aircraft"),
      ],
      deadlines: [
        expectedDeadline("RENT", "recurring", "first business day", "identified", "first business day"),
        expectedDeadline("SECURITY", "event_based", "before Delivery", "awaiting_trigger", "before Delivery"),
        expectedDeadline("MAINTENANCE RESERVES", "recurring", "monthly", "identified", "per flight hour monthly"),
        expectedDeadline("TECHNICAL RECORDS", "relative", "10 business days", "awaiting_trigger", "10 business days"),
        expectedDeadline("RETURN CONDITIONS", "event_based", "Expiration Date", "awaiting_trigger", "Expiration Date"),
        expectedDeadline("TERMINATION AND NOTICE", "relative", "5 business days", "awaiting_trigger", "5 business days"),
        expectedDeadline("EXTENSION OPTION", "relative", "180 days", "awaiting_trigger", "180 days"),
      ],
      risks: [
        expectedRisk("MAINTENANCE RESERVES", "reserve_exposure", "medium", "maintenance reserve"),
        expectedRisk("INSURANCE", "insurance_compliance_exposure", "high", "additional insureds"),
        expectedRisk("RETURN CONDITIONS", "redelivery_condition_exposure", "high", "technical records"),
        expectedRisk("TERMINATION AND NOTICE", "cure_period_exposure", "high", "Event of Default"),
        expectedRisk("EXTENSION OPTION", "renewal_pricing_uncertainty", "medium", "agreed by the parties"),
      ],
    },
  },
  {
    name: "MRO Agreement",
    contractClass: "MRO",
    fixture: "test/fixtures/aviation-acceptance/mro-agreement.txt",
    format: "docx",
    expected: {
      clauses: [
        expectedClause("MRO AGREEMENT", "general", "MRO AGREEMENT"),
        expectedClause("MAINTENANCE SERVICES", "maintenance", "overhaul Engine"),
        expectedClause("PAYMENT", "commercial/payment", "fixed shop visit fee"),
        expectedClause("MAINTENANCE RECORDS", "maintenance", "shop visit records"),
        expectedClause("LIABILITY AND INDEMNITY", "liability/indemnity", "indemnifies"),
        expectedClause("DELAY PENALTIES", "commercial/payment", "liquidated damages"),
        expectedClause("REGULATORY COMPLIANCE", "compliance/sanctions", "EASA"),
      ],
      obligations: [
        expectedObligation("MAINTENANCE SERVICES", "MRO Provider", "overhaul", "Engine", "overhaul Engine"),
        expectedObligation("PAYMENT", "Airline", "pay", "fixed shop visit fee", "USD 80,000"),
        expectedObligation("MAINTENANCE RECORDS", "MRO Provider", "provide", "shop visit records", "shop visit records"),
        expectedObligation("LIABILITY AND INDEMNITY", "MRO Provider", "indemnify", "Airline", "all losses"),
        expectedObligation("REGULATORY COMPLIANCE", "MRO Provider", "comply", "EASA requirements", "EASA requirements"),
      ],
      deadlines: [
        expectedDeadline("MAINTENANCE SERVICES", "relative", "30 days", "awaiting_trigger", "30 days"),
        expectedDeadline("PAYMENT", "absolute", "15 March 2027", "calculated", "15 March 2027"),
        expectedDeadline("MAINTENANCE RECORDS", "relative", "5 business days", "awaiting_trigger", "5 business days"),
        expectedDeadline("REGULATORY COMPLIANCE", "recurring", "annually", "identified", "annually"),
      ],
      risks: [
        expectedRisk("MAINTENANCE RECORDS", "short_notice_period", "medium", "5 business days"),
        expectedRisk("LIABILITY AND INDEMNITY", "broad_indemnity", "high", "all losses"),
        expectedRisk("DELAY PENALTIES", "penalty_exposure", "high", "EUR 100,000"),
        expectedRisk("REGULATORY COMPLIANCE", "recurring_compliance", "low", "EASA requirements"),
      ],
    },
  },
  {
    name: "Supplier Agreement",
    contractClass: "SUPPLIER",
    fixture: "test/fixtures/aviation-acceptance/supplier-agreement.txt",
    format: "pdf",
    expected: {
      clauses: [
        expectedClause("AVIATION COMPONENT SUPPLIER AGREEMENT", "general", "SUPPLIER AGREEMENT"),
        expectedClause("COMPONENT DELIVERY", "delivery/redelivery", "deliver the component"),
        expectedClause("PAYMENT", "commercial/payment", "pay the invoice"),
        expectedClause("COMPONENT INSPECTION", "maintenance", "inspect the component"),
        expectedClause("LIABILITY", "liability/indemnity", "capped at EUR 1 million"),
        expectedClause("DELIVERY PENALTY", "commercial/payment", "EUR 120,000"),
        expectedClause("TERMINATION", "termination/default", "payment default"),
      ],
      obligations: [
        expectedObligation("COMPONENT DELIVERY", "Supplier", "deliver", "component", "deliver the component"),
        expectedObligation("PAYMENT", "Airline", "pay", "invoice", "pay the invoice"),
        expectedObligation("COMPONENT INSPECTION", "Manufacturer", "inspect", "component", "inspect the component"),
        expectedObligation("TERMINATION", "Supplier", "terminate", "Agreement", "may terminate", { modality: "discretionary" }),
      ],
      deadlines: [
        expectedDeadline("COMPONENT DELIVERY", "relative", "10 days", "awaiting_trigger", "10 days"),
        expectedDeadline("PAYMENT", "recurring", "first Business Day", "identified", "first Business Day"),
        expectedDeadline("COMPONENT INSPECTION", "relative", "500 flight cycles", "awaiting_date", "500 flight cycles"),
        expectedDeadline("TERMINATION", "relative", "10 days", "awaiting_date", "10 days"),
      ],
      risks: [
        expectedRisk("LIABILITY", "uncapped_liability", "high", "except for fraud"),
        expectedRisk("DELIVERY PENALTY", "penalty_exposure", "high", "EUR 120,000"),
        expectedRisk("TERMINATION", "cure_period_exposure", "high", "uncured payment default"),
      ],
    },
  },
  {
    name: "Ground Handling Agreement",
    contractClass: "GROUND_HANDLING",
    fixture: "test/fixtures/aviation-acceptance/ground-handling-agreement.txt",
    format: "docx",
    expected: {
      clauses: [
        expectedClause("GROUND HANDLING AGREEMENT", "general", "GROUND HANDLING AGREEMENT"),
        expectedClause("SERVICE LEVELS", "operations/service levels", "turnaround availability"),
        expectedClause("OPERATIONAL REPORTING", "operations/service levels", "service failures"),
        expectedClause("SERVICE PENALTIES", "commercial/payment", "liquidated damages"),
        expectedClause("INDEMNITY", "liability/indemnity", "indemnifies"),
        expectedClause("SAFETY COMPLIANCE", "compliance/sanctions", "safety requirements"),
        expectedClause("TERMINATION", "termination/default", "operational default"),
      ],
      obligations: [
        expectedObligation("SERVICE LEVELS", "Ground Handler", "operate", "ramp services", "ramp services"),
        expectedObligation("OPERATIONAL REPORTING", "Ground Handler", "report", "service failures", "service failures"),
        expectedObligation("SERVICE PENALTIES", "Ground Handler", "pay", "liquidated damages", "liquidated damages"),
        expectedObligation("INDEMNITY", "Ground Handler", "indemnify", "Airline", "all losses"),
        expectedObligation("SAFETY COMPLIANCE", "Ground Handler", "comply", "safety requirements", "safety requirements"),
        expectedObligation("TERMINATION", "Airline", "terminate", "Agreement", "may terminate", { modality: "discretionary" }),
      ],
      deadlines: [
        expectedDeadline("SERVICE LEVELS", "recurring", "monthly", "identified", "monthly"),
        expectedDeadline("OPERATIONAL REPORTING", "relative", "2 hours", "awaiting_trigger", "2 hours"),
        expectedDeadline("SERVICE PENALTIES", "event_based", "following a service failure", "awaiting_trigger", "service failure"),
        expectedDeadline("SAFETY COMPLIANCE", "recurring", "quarterly", "identified", "quarterly"),
        expectedDeadline("TERMINATION", "relative", "10 days", "awaiting_date", "10 days"),
      ],
      risks: [
        expectedRisk("OPERATIONAL REPORTING", "short_notice_period", "high", "2 hours"),
        expectedRisk("SERVICE PENALTIES", "penalty_exposure", "high", "EUR 100,000"),
        expectedRisk("INDEMNITY", "broad_indemnity", "high", "all losses"),
        expectedRisk("SAFETY COMPLIANCE", "recurring_compliance", "low", "safety requirements"),
        expectedRisk("TERMINATION", "cure_period_exposure", "high", "uncured operational default"),
      ],
    },
  },
  {
    name: "Airport Services Agreement",
    contractClass: "AIRPORT_SERVICES",
    fixture: "test/fixtures/aviation-acceptance/airport-services-agreement.txt",
    format: "pdf",
    expected: {
      clauses: [
        expectedClause("AIRPORT SERVICES AGREEMENT", "general", "AIRPORT SERVICES AGREEMENT"),
        expectedClause("AIRPORT CHARGES", "commercial/payment", "airport charges"),
        expectedClause("RUNWAY SERVICES", "operations/service levels", "runway services"),
        expectedClause("OPERATIONAL NOTICE", "renewal/notice", "notify the Airline"),
        expectedClause("INSURANCE", "insurance", "aviation liability insurance"),
        expectedClause("LIABILITY AND INDEMNITY", "liability/indemnity", "indemnifies"),
        expectedClause("RENEWAL NOTICE", "renewal/notice", "automatically renews"),
      ],
      obligations: [
        expectedObligation("AIRPORT CHARGES", "Airline", "pay", "airport charges", "airport charges"),
        expectedObligation("RUNWAY SERVICES", "Airport", "provide", "runway services", "runway services"),
        expectedObligation("OPERATIONAL NOTICE", "Airport", "notify", "Airline", "notify the Airline", { modality: "conditional" }),
        expectedObligation("INSURANCE", "Airline", "maintain", "insurance", "liability insurance"),
        expectedObligation("LIABILITY AND INDEMNITY", "Airport", "indemnify", "Airline", "all losses"),
        expectedObligation("RENEWAL NOTICE", "Airline", "provide", "notice", "provides notice", { modality: "conditional" }),
      ],
      deadlines: [
        expectedDeadline("AIRPORT CHARGES", "absolute", "20 April 2027", "calculated", "20 April 2027"),
        expectedDeadline("RUNWAY SERVICES", "recurring", "daily", "identified", "daily"),
        expectedDeadline("OPERATIONAL NOTICE", "conditional", "5 days", "awaiting_date", "5 days"),
        expectedDeadline("INSURANCE", "recurring", "annually", "identified", "annually"),
        expectedDeadline("RENEWAL NOTICE", "relative", "90 days", "awaiting_trigger", "90 days"),
      ],
      risks: [
        expectedRisk("OPERATIONAL NOTICE", "short_notice_period", "medium", "5 days"),
        expectedRisk("INSURANCE", "insurance_compliance_exposure", "high", "not less than"),
        expectedRisk("LIABILITY AND INDEMNITY", "broad_indemnity", "high", "all losses"),
        expectedRisk("RENEWAL NOTICE", "automatic_renewal", "medium", "90 days"),
      ],
    },
  },
];

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function percentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function score(expected, actual, matches) {
  const available = new Set(actual.map((_, index) => index));
  const pairs = [];
  for (const expectation of expected) {
    const matchIndex = [...available].find((index) => matches(expectation, actual[index]));
    if (matchIndex === undefined) continue;
    available.delete(matchIndex);
    pairs.push({ expected: expectation, actual: actual[matchIndex] });
  }
  const truePositive = pairs.length;
  const falsePositive = actual.length - truePositive;
  const falseNegative = expected.length - truePositive;
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 1;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const matchedExpected = new Set(pairs.map((pair) => pair.expected));
  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
    pairs,
    missing: expected.filter((expectation) => !matchedExpected.has(expectation)),
    unexpected: [...available].map((index) => actual[index]),
  };
}

function clauseTitle(record, clausesById) {
  return clausesById.get(record.clause_id || record.source_clause_id)?.title || "";
}

function sourceEvidence(record) {
  return (record.evidence || []).map((item) => item.source || item).filter(Boolean);
}

function evidenceIsCorrect(pair, clausesByTitle) {
  const sourceClause = clausesByTitle.get(normalize(pair.expected.sourceClause));
  if (!sourceClause) return false;
  const expectedEvidence = sourceClause.evidence?.[0];
  if (!expectedEvidence) return false;
  const evidence = pair.actual === sourceClause ? sourceClause.evidence : sourceEvidence(pair.actual);
  const linked = evidence.some((item) => (item.id || item.evidence_id) === expectedEvidence.id);
  const exactOffsets = expectedEvidence.excerpt === expectedEvidence.fullText.slice(expectedEvidence.char_start, expectedEvidence.char_end);
  const expectedLocatorPrefix = expectedEvidence.format === "pdf" ? "page:1:char:" : "document:char:";
  return linked
    && exactOffsets
    && expectedEvidence.source_locator.startsWith(expectedLocatorPrefix)
    && normalize(expectedEvidence.excerpt).includes(normalize(pair.expected.evidenceText));
}

function buildSource(text, format, identifiers) {
  const pageId = crypto.randomUUID();
  return {
    ...identifiers,
    text,
    pageBoundaries: format === "pdf" ? "explicit" : "derived_unavailable",
    pages: format === "pdf" ? [{ id: pageId, page_number: 1, char_start: 0, char_end: text.length, text }] : [],
    sourceLocator: (start, end) => format === "pdf" ? `page:1:char:${start}-${end}` : `document:char:${start}-${end}`,
  };
}

async function runThroughPipeline(corpusEntry) {
  const text = await fs.readFile(path.join(ROOT, corpusEntry.fixture), "utf8");
  const identifiers = {
    organizationId: ORGANIZATION_ID,
    contractId: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentVersionId: crypto.randomUUID(),
    analysisRunId: crypto.randomUUID(),
  };
  const source = buildSource(text, corpusEntry.format, identifiers);
  let analysisRun = { id: identifiers.analysisRunId, organization_id: ORGANIZATION_ID, contract_id: identifiers.contractId, document_version_id: identifiers.documentVersionId, status: "queued" };
  const state = { clauses: [], richClauses: [], obligations: [], deadlines: [], risks: [], evidence: [], profile: null };

  const pipeline = createContractIntelligencePipeline({
    analysisRunRepository: {
      getById: async () => analysisRun,
      updateStatus: async (update) => {
        analysisRun = { ...analysisRun, status: update.status };
        return analysisRun;
      },
    },
    sourceService: { load: async () => source },
    clauseStage: async () => {
      const plan = segmentDeterministicClauses(source);
      state.evidence = plan.map((clause) => ({ ...clause.evidence, id: crypto.randomUUID(), clause_id: clause.id, fullText: text, format: corpusEntry.format }));
      state.clauses = plan.map(({ evidence: _evidence, ...clause }, index) => ({ ...clause, source_evidence_id: state.evidence[index].id }));
      state.richClauses = state.clauses.map((clause, index) => ({ ...clause, evidence: [state.evidence[index]] }));
      return {
        clauses: state.clauses,
        evidence: state.evidence,
        clauseEvidence: state.clauses.map((clause, index) => ({ clause_id: clause.id, evidence_id: state.evidence[index].id })),
      };
    },
    obligationService: {
      runStage: async () => {
        state.obligations = state.richClauses.flatMap((clause) => {
          const candidate = buildDeterministicObligationCandidate(clause);
          if (!candidate) return [];
          const evidence = clause.evidence[0];
          return [{
            id: crypto.randomUUID(),
            ...candidate,
            clause_id: clause.id,
            source_clause_id: clause.id,
            source_evidence_id: evidence.id,
            evidence: [{ evidence_id: evidence.id, is_primary: true, source: evidence }],
          }];
        });
        return { obligations: state.obligations };
      },
    },
    deadlineService: {
      runStage: async () => {
        state.deadlines = state.obligations.flatMap((obligation) => {
          const clause = state.clauses.find((candidate) => candidate.id === obligation.clause_id);
          const interpretation = parseTemporalExpression(obligation.description, { condition: obligation.condition, clauseText: clause?.source_text });
          if (!interpretation) return [];
          return [{
            id: crypto.randomUUID(),
            ...interpretation,
            original_expression: interpretation.timing_expression,
            obligation_id: obligation.id,
            clause_id: obligation.clause_id,
            source_clause_id: obligation.clause_id,
            source_evidence_id: obligation.source_evidence_id,
            evidence: obligation.evidence,
          }];
        });
        return { deadlines: state.deadlines };
      },
    },
    riskService: {
      runStage: async () => {
        state.risks = screenDeterministicRiskCandidates({ clauses: state.richClauses, obligations: state.obligations, deadlines: state.deadlines })
          .map((risk) => ({ id: crypto.randomUUID(), ...risk }));
        return { risks: state.risks };
      },
    },
    profileRepository: {
      getByRun: async () => state.profile,
      listClauseSources: async () => state.richClauses,
      persist: async ({ profile }) => {
        state.profile = profile;
        return profile;
      },
    },
    searchRepository: { replaceForRun: async ({ chunks }) => chunks },
    aviationRelationshipRepository: { materializeContractRelationships: async () => [] },
  });

  const result = await pipeline.run({ organizationId: ORGANIZATION_ID, analysisRunId: identifiers.analysisRunId });
  assert.equal(result.status, "completed");
  return state;
}

function evaluate(corpusEntry, state) {
  const clausesById = new Map(state.richClauses.map((clause) => [clause.id, clause]));
  const clausesByTitle = new Map(state.richClauses.map((clause) => [normalize(clause.title), clause]));
  const clauseMetrics = score(corpusEntry.expected.clauses, state.richClauses, (expected, actual) => normalize(expected.title) === normalize(actual.title) && expected.category === actual.category);
  const obligationMetrics = score(corpusEntry.expected.obligations, state.obligations, (expected, actual) => {
    return normalize(expected.sourceClause) === normalize(clauseTitle(actual, clausesById))
      && normalize(expected.actor) === normalize(actual.actor)
      && normalize(expected.action) === normalize(actual.action)
      && normalize(actual.object).includes(normalize(expected.objectIncludes))
      && (!expected.modality || expected.modality === actual.modality)
      && (!expected.timingIncludes || normalize(actual.timing_expression).includes(normalize(expected.timingIncludes)));
  });
  const deadlineMetrics = score(corpusEntry.expected.deadlines, state.deadlines, (expected, actual) => {
    return normalize(expected.sourceClause) === normalize(clauseTitle(actual, clausesById))
      && expected.deadlineType === actual.deadline_type
      && normalize(actual.timing_expression).includes(normalize(expected.timingIncludes))
      && expected.status === actual.status;
  });
  const riskMetrics = score(corpusEntry.expected.risks, state.risks, (expected, actual) => {
    const sourceTitles = actual.source_clause_ids.map((clauseId) => normalize(clausesById.get(clauseId)?.title));
    return sourceTitles.includes(normalize(expected.sourceClause))
      && expected.riskType === actual.risk_type
      && expected.severity === actual.severity;
  });

  const layers = { clauses: clauseMetrics, obligations: obligationMetrics, deadlines: deadlineMetrics, risks: riskMetrics };
  for (const metrics of Object.values(layers)) {
    metrics.correctEvidence = metrics.pairs.filter((pair) => evidenceIsCorrect(pair, clausesByTitle)).length;
    metrics.evidenceExpected = metrics.truePositive;
    metrics.evidenceAccuracy = metrics.evidenceExpected ? metrics.correctEvidence / metrics.evidenceExpected : 1;
    metrics.incorrectEvidence = metrics.pairs.filter((pair) => !evidenceIsCorrect(pair, clausesByTitle));
  }
  const correctEvidence = Object.values(layers).reduce((total, metrics) => total + metrics.correctEvidence, 0);
  const evidenceExpected = Object.values(layers).reduce((total, metrics) => total + metrics.evidenceExpected, 0);
  return {
    name: corpusEntry.name,
    contractClass: corpusEntry.contractClass,
    actualContractClass: state.profile.classification.type,
    classificationCorrect: state.profile.classification.type === corpusEntry.contractClass,
    layers,
    evidenceAccuracy: correctEvidence / evidenceExpected,
  };
}

function aggregate(results) {
  const totals = {};
  for (const layer of ["clauses", "obligations", "deadlines", "risks"]) {
    const counts = results.reduce((sum, result) => {
      const metrics = result.layers[layer];
      sum.truePositive += metrics.truePositive;
      sum.falsePositive += metrics.falsePositive;
      sum.falseNegative += metrics.falseNegative;
      sum.correctEvidence += metrics.correctEvidence;
      sum.evidenceExpected += metrics.evidenceExpected;
      return sum;
    }, { truePositive: 0, falsePositive: 0, falseNegative: 0, correctEvidence: 0, evidenceExpected: 0 });
    const precision = counts.truePositive / (counts.truePositive + counts.falsePositive);
    const recall = counts.truePositive / (counts.truePositive + counts.falseNegative);
    totals[layer] = { ...counts, precision, recall, f1: (2 * precision * recall) / (precision + recall), evidenceAccuracy: counts.correctEvidence / counts.evidenceExpected };
  }
  const correctEvidence = Object.values(totals).reduce((total, metrics) => total + metrics.correctEvidence, 0);
  const evidenceExpected = Object.values(totals).reduce((total, metrics) => total + metrics.evidenceExpected, 0);
  return { layers: totals, evidenceAccuracy: correctEvidence / evidenceExpected };
}

function report(results, overall) {
  const rows = results.map((result) => ({
    contract: result.name,
    classification: result.classificationCorrect ? "correct" : `incorrect (${result.actualContractClass})`,
    clauses: percentage(result.layers.clauses.f1),
    obligations: percentage(result.layers.obligations.f1),
    deadlines: percentage(result.layers.deadlines.f1),
    risks: percentage(result.layers.risks.f1),
    evidence: percentage(result.evidenceAccuracy),
  }));
  rows.push({
    contract: "OVERALL",
    classification: `${results.filter((result) => result.classificationCorrect).length}/${results.length}`,
    clauses: percentage(overall.layers.clauses.f1),
    obligations: percentage(overall.layers.obligations.f1),
    deadlines: percentage(overall.layers.deadlines.f1),
    risks: percentage(overall.layers.risks.f1),
    evidence: percentage(overall.evidenceAccuracy),
  });
  console.log("\nAVIATION CONTRACT INTELLIGENCE ACCEPTANCE\n");
  console.table(rows);
  for (const result of results) {
    console.log(`\n${result.name} (${result.contractClass}; classified ${result.actualContractClass})`);
    console.table(Object.entries(result.layers).map(([layer, metrics]) => ({
      layer,
      precision: percentage(metrics.precision),
      recall: percentage(metrics.recall),
      f1: percentage(metrics.f1),
      evidence: percentage(metrics.evidenceAccuracy),
      correct: metrics.truePositive,
      missing: metrics.falseNegative,
      incorrect: metrics.falsePositive,
      incorrectEvidence: metrics.incorrectEvidence.length,
    })));
    for (const [layer, metrics] of Object.entries(result.layers)) {
      if (metrics.missing.length) console.log(`${layer} missing: ${metrics.missing.map((item) => expectedLabel(layer, item)).join(" | ")}`);
      if (metrics.unexpected.length) console.log(`${layer} incorrect/unexpected: ${metrics.unexpected.map((item) => actualLabel(layer, item, new Map())).join(" | ")}`);
      if (metrics.incorrectEvidence.length) console.log(`${layer} incorrect evidence: ${metrics.incorrectEvidence.map((pair) => expectedLabel(layer, pair.expected)).join(" | ")}`);
    }
  }
  console.log("Matching: one-to-one title/category; source-clause plus actor/action/object; temporal type/expression/status; risk type/severity. Evidence requires the linked source ID, exact offsets, expected excerpt, and format-appropriate locator.");
}

function expectedLabel(layer, item) {
  if (layer === "clauses") return `${item.sourceClause} [${item.category}]`;
  if (layer === "obligations") return `${item.sourceClause}: ${item.actor} ${item.action} ${item.objectIncludes}`;
  if (layer === "deadlines") return `${item.sourceClause}: ${item.deadlineType} ${item.timingIncludes}`;
  return `${item.sourceClause}: ${item.riskType} ${item.severity}`;
}

function actualLabel(layer, item) {
  if (layer === "clauses") return `${item.title} [${item.category}]`;
  if (layer === "obligations") return `${item.actor || "?"} ${item.action || "?"} ${item.object || "?"}`;
  if (layer === "deadlines") return `${item.deadline_type} ${item.timing_expression}`;
  return `${item.risk_type} ${item.severity}`;
}

const ACCEPTANCE_BASELINE = {
  classifications: [true, false, true, true, true],
  clauses: { truePositive: 40, falsePositive: 2, falseNegative: 2 },
  obligations: { truePositive: 30, falsePositive: 3, falseNegative: 1 },
  deadlines: { truePositive: 25, falsePositive: 1, falseNegative: 0 },
  risks: { truePositive: 21, falsePositive: 1, falseNegative: 0 },
};

test("representative aviation corpus measures the existing deterministic pipeline", async () => {
  const results = [];
  for (const corpusEntry of CORPUS) {
    const state = await runThroughPipeline(corpusEntry);
    results.push(evaluate(corpusEntry, state));
  }
  const overall = aggregate(results);
  report(results, overall);

  assert.equal(results.length, 5);
  assert.ok(Object.values(overall.layers).every((metrics) => Number.isFinite(metrics.f1)));
  assert.ok(Number.isFinite(overall.evidenceAccuracy));
  assert.deepEqual(results.map((result) => result.classificationCorrect), ACCEPTANCE_BASELINE.classifications);
  for (const layer of ["clauses", "obligations", "deadlines", "risks"]) {
    assert.deepEqual(
      {
        truePositive: overall.layers[layer].truePositive,
        falsePositive: overall.layers[layer].falsePositive,
        falseNegative: overall.layers[layer].falseNegative,
      },
      ACCEPTANCE_BASELINE[layer]
    );
  }
});