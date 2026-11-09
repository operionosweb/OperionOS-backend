import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { buildAviationEventImpact } from "../services/phase3/intelligence/aviationEventImpactService.js";
import { readAnalysisRunAviationEventImpact } from "../routes/analysisRunRoutes.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const CONTRACT_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const AIRCRAFT_ID = "55555555-5555-4555-8555-555555555555";
const RELATIONSHIP_ID = "66666666-6666-4666-8666-666666666666";
const EVIDENCE_ID = "77777777-7777-4777-8777-777777777777";

const assetRelationship = {
  id: RELATIONSHIP_ID,
  aircraft_id: AIRCRAFT_ID,
  registration: "G-SYN38",
  serial_number: "MSN-38001",
  aircraft_type: "A320",
  relationship_type: "leased_under",
  confidence: 0.96,
  source_identifier: "AIRCRAFT_REGISTRATION:G-SYN38",
  evidence_id: EVIDENCE_ID,
  excerpt: "Aircraft Registration: G-SYN38",
  source_locator: "page:1",
};

const event = {
  assetId: AIRCRAFT_ID,
  category: "shop_visit",
  summary: "Reported engine shop visit",
  eventDate: "2026-11-07",
  sourceExcerpt: "Work order records the engine shop visit start.",
  sourceLocator: "work-order:WO-38",
};

test("shop visit maps only exact source clauses to same-clause obligations and intelligence", () => {
  const result = buildAviationEventImpact({
    contractId: CONTRACT_ID,
    analysisRunId: RUN_ID,
    event,
    assetRelationship,
    clauses: [
      { id: "clause-maintenance", clause_number: "9", title: "Technical records", source_text: "Following each engine shop visit, the Lessor shall receive maintenance records." },
      { id: "clause-rent", clause_number: "3", title: "Rent", source_text: "Monthly rent is payable on the first business day." },
    ],
    evidence: [{ id: "clause-evidence", clause_id: "clause-maintenance", excerpt: "Following each engine shop visit, the Lessor shall receive maintenance records.", source_locator: "page:12", review_status: "verified" }],
    obligations: [{ id: "obligation-1", clause_id: "clause-maintenance", obligation_type: "maintenance", description: "Provide shop visit records." }],
    deadlines: [{ id: "deadline-1", source_clause_id: "clause-maintenance", timing_expression: "within five business days" }],
    risks: [{ id: "risk-1", clause_id: "clause-maintenance", title: "Records delivery exposure", severity: "medium", affected_obligation_ids: ["obligation-1"] }],
    financialImpact: { impacts: [{ id: "financial-1", sourceClauseId: "clause-maintenance", category: "maintenance_reserve", description: "Engine reserve", baseAmount: 85, currency: "USD", resultLabel: "$85.00" }] },
    recommendations: [{ id: "recommendation-1", risk_id: "risk-1", action: "Reconcile the cited shop visit records.", is_current: true }],
  });

  assert.equal(result.outcome, "potential_contract_terms_identified");
  assert.equal(result.reviewStatus, "requires_human_review");
  assert.equal(result.event.verificationStatus, "unverified");
  assert.equal(result.asset.contractRelationship.evidence.id, EVIDENCE_ID);
  assert.equal(result.potentialImpacts.length, 1);
  assert.equal(result.potentialImpacts[0].clause.id, "clause-maintenance");
  assert.deepEqual(result.potentialImpacts[0].obligations.map((item) => item.id), ["obligation-1"]);
  assert.deepEqual(result.potentialImpacts[0].deadlines.map((item) => item.id), ["deadline-1"]);
  assert.deepEqual(result.potentialImpacts[0].risks.map((item) => item.id), ["risk-1"]);
  assert.deepEqual(result.potentialImpacts[0].financialImpacts.map((item) => item.id), ["financial-1"]);
  assert.deepEqual(result.potentialImpacts[0].recommendations.map((item) => item.id), ["recommendation-1"]);
  assert.match(result.limitations.join(" "), /does not establish causation, contractual effect, liability, payment, or breach/);
  assert.match(result.limitations.join(" "), /transient and does not create or alter event/);
});

test("AOG, redelivery and supplier disruption map only their supported contractual terms", () => {
  const clauses = [
    { id: "aog", title: "Aircraft availability", source_text: "The service level addresses aircraft downtime and availability." },
    { id: "return", title: "Redelivery", source_text: "At redelivery, the Aircraft shall be returned with complete technical records." },
    { id: "supplier", title: "Provider obligations", source_text: "The supplier shall report any delay and pay liquidated damages for service-level failure." },
    { id: "generic", title: "Governing law", source_text: "This agreement is governed by English law." },
  ];

  const assessment = (category) => buildAviationEventImpact({
    contractId: CONTRACT_ID,
    analysisRunId: RUN_ID,
    event: { ...event, category },
    assetRelationship,
    clauses,
  });

  assert.deepEqual(assessment("aog").potentialImpacts.map((item) => item.clause.id), ["aog"]);
  assert.deepEqual(assessment("redelivery").potentialImpacts.map((item) => item.clause.id), ["return"]);
  assert.deepEqual(assessment("supplier_disruption").potentialImpacts.map((item) => item.clause.id), ["supplier"]);
  assert.deepEqual(assessment("insurance_event").potentialImpacts, []);
  assert.equal(assessment("insurance_event").outcome, "no_contract_terms_matched");
});

test("event input, contract relationship, and relationship evidence fail closed", () => {
  assert.throws(() => buildAviationEventImpact({ event: { ...event, category: "flight_delay" } }), { code: "AVIATION_EVENT_CATEGORY_INVALID" });
  assert.throws(() => buildAviationEventImpact({ event: { ...event, eventDate: "2026-02-30" } }), { code: "AVIATION_EVENT_DATE_INVALID" });
  assert.throws(() => buildAviationEventImpact({ event: { ...event, sourceExcerpt: "" } }), { code: "AVIATION_EVENT_SOURCE_REQUIRED" });
  assert.throws(() => buildAviationEventImpact({ event, assetRelationship: null }), { code: "AVIATION_ASSET_CONTRACT_RELATIONSHIP_NOT_FOUND" });
  assert.throws(() => buildAviationEventImpact({ event, assetRelationship: { ...assetRelationship, evidence_id: null } }), { code: "AVIATION_ASSET_LINK_EVIDENCE_UNAVAILABLE" });
});

function routeDependencies({ run = { id: RUN_ID, organization_id: ORGANIZATION_ID, contract_id: CONTRACT_ID, document_version_id: DOCUMENT_VERSION_ID, status: "completed" }, relationships = [assetRelationship] } = {}) {
  const calls = [];
  return {
    calls,
    analysisRunRepository: { async getById(id, organizationId) {
      calls.push(["run", id, organizationId]);
      return run;
    } },
    documentVersionResolver: async (id, organizationId) => ({
      id,
      document_id: "88888888-8888-4888-8888-888888888888",
      organization_id: organizationId,
    }),
    readers: {
      async aircraftRelationships(scope) { calls.push(["aircraftRelationships", scope]); return relationships; },
      async clauses(scope) { calls.push(["clauses", scope]); return [{ id: "clause-1", title: "Shop visit", source_text: "The lessee shall provide shop visit records." }]; },
      async evidence(scope) { calls.push(["evidence", scope]); return []; },
      async obligations(scope) { calls.push(["obligations", scope]); return []; },
      async deadlines(scope) { calls.push(["deadlines", scope]); return []; },
      async riskAssessment(scope) { calls.push(["riskAssessment", scope]); return { applicable: false, recommendations: [] }; },
      async risks(scope) { calls.push(["risks", scope]); return []; },
      async financialImpact(scope) { calls.push(["financialImpact", scope]); return { impacts: [] }; },
    },
  };
}

test("event impact route resolves the completed run and relationship under authenticated tenant scope", async () => {
  const dependencies = routeDependencies();
  const result = await readAnalysisRunAviationEventImpact({
    organizationId: ORGANIZATION_ID,
    analysisRunId: RUN_ID,
    event,
    ...dependencies,
  });

  assert.equal(result.contractId, CONTRACT_ID);
  assert.equal(result.potentialImpacts[0].clause.id, "clause-1");
  const relationshipCall = dependencies.calls.find(([name]) => name === "aircraftRelationships");
  assert.deepEqual(relationshipCall[1], { organizationId: ORGANIZATION_ID, contractId: CONTRACT_ID });
  assert.ok(dependencies.calls.filter(([, scope]) => scope && typeof scope === "object")
    .every(([, scope]) => scope.organizationId === ORGANIZATION_ID));
});

test("event review rejects cross-tenant runs, uncompleted runs, and assets not linked to the contract", async () => {
  const hiddenRun = routeDependencies({ run: null });
  await assert.rejects(
    () => readAnalysisRunAviationEventImpact({ organizationId: ORGANIZATION_ID, analysisRunId: RUN_ID, event, ...hiddenRun }),
    { code: "ANALYSIS_RUN_NOT_FOUND" }
  );
  assert.equal(hiddenRun.calls.some(([name]) => name === "aircraftRelationships"), false);

  const processingRun = routeDependencies({ run: { id: RUN_ID, organization_id: ORGANIZATION_ID, contract_id: CONTRACT_ID, document_version_id: DOCUMENT_VERSION_ID, status: "processing" } });
  await assert.rejects(
    () => readAnalysisRunAviationEventImpact({ organizationId: ORGANIZATION_ID, analysisRunId: RUN_ID, event, ...processingRun }),
    { code: "ANALYSIS_NOT_COMPLETED" }
  );
  assert.equal(processingRun.calls.some(([name]) => name === "aircraftRelationships"), false);

  const noLink = routeDependencies({ relationships: [] });
  await assert.rejects(
    () => readAnalysisRunAviationEventImpact({ organizationId: ORGANIZATION_ID, analysisRunId: RUN_ID, event, ...noLink }),
    { code: "AVIATION_ASSET_CONTRACT_RELATIONSHIP_NOT_FOUND" }
  );
  assert.equal(noLink.calls.some(([name]) => name === "clauses"), false);
});

test("event endpoint remains inside existing contract-read authorization and performs no event writes", async () => {
  const source = await fs.readFile(new URL("../routes/analysisRunRoutes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\([\s\S]*authenticateUser,[\s\S]*requireOrganizationMembership,[\s\S]*requireOrganizationPermission\("contract:read"\)/);
  assert.match(source, /router\.post\("\/:id\/aviation-event-impact"/);
  assert.match(source, /readAnalysisRunAviationEventImpact\(\{[\s\S]*organizationId: req\.organization\.id/);
  assert.doesNotMatch(source, /insert into (?:public\.)?aviation_events/i);
});

test("Contract Workspace places the event review beside aircraft relationships and uses the scoped API", async () => {
  const [workspace, panel, api] = await Promise.all([
    fs.readFile(new URL("../frontend/src/routes/ContractWorkspace.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/components/intelligence/AviationEventImpactPanel.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../frontend/src/lib/contractsApi.js", import.meta.url), "utf8"),
  ]);
  const relationshipsIndex = workspace.indexOf('<Reveal id="relationships"');
  const financialIndex = workspace.indexOf('<Reveal id="financial-impact"');

  assert.ok(workspace.indexOf("<AviationEventImpactPanel") > relationshipsIndex);
  assert.ok(workspace.indexOf("<AviationEventImpactPanel") < financialIndex);
  assert.match(workspace, /relationships=\{relationships\}/);
  assert.match(workspace, /assetIdentificationReview\.status === "requires_review"/);
  assert.match(workspace, /No aircraft relationship or event impact was inferred/);
  assert.match(panel, /reviewAviationEventImpact\(analysisRunId, organizationId/);
  assert.match(panel, /event unverified/i);
  assert.match(panel, /View source clause/);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/aviation-event-impact/);
});
