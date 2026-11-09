import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { resolveContractWorkspaceAnalysisRunId } from "../frontend/src/lib/contractIntelligenceModel.js";

const read = (path) => fs.readFile(path, "utf8");

test("upload hands the created contract identity back to the portfolio workflow", async () => {
  const [upload, portfolio] = await Promise.all([
    read("frontend/src/components/demo/UploadContract.jsx"),
    read("frontend/src/routes/ContractPortfolio.jsx"),
  ]);
  assert.match(upload, /uploadContract\(\{ file, organizationId \}\)/);
  assert.match(upload, /onUploaded\?\.\(result\)/);
  assert.match(upload, /result\?\.status === "requires_ocr"/);
  assert.match(upload, /Contract analysis is blocked until extraction is complete/);
  assert.match(upload, /result\?\.status === "ready"/);
  assert.match(upload, /state === "uploading"/);
  assert.match(portfolio, /result\?\.contractId/);
  assert.match(portfolio, /navigate\(`\/demo\/contracts\/\$\{result\.contractId\}`\)/);
});

test("upload-created analysis selection is isolated per contract and used by deterministic contract processing", async () => {
  const [portfolio, workspace, analysis, api] = await Promise.all([
    read("frontend/src/routes/ContractPortfolio.jsx"),
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/routes/AnalysisView.jsx"),
    read("frontend/src/lib/contractsApi.js"),
  ]);
  assert.match(workspace, /operion\.activeAnalysisRunId\.\$\{contractId\}/);
  assert.match(portfolio, /localStorage\.setItem\(`operion\.activeAnalysisRunId\.\$\{result\.contractId\}`, result\.analysisRunId\)/);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/process/);
  assert.match(workspace, /processContractIntelligence\(analysisRun\.id, organizationId\)/);
  assert.match(workspace, /setLatestExtractionStatus\(selectedVersion\?\.extraction_status \|\| null\)/);
  assert.match(workspace, /latestExtractionStatus !== "completed"/);
  assert.match(workspace, /One or more pages could not be extracted/);
  assert.match(workspace, /analysisRun\.status !== "completed" && latestExtractionStatus === "completed"/);
  assert.match(analysis, /operion\.activeAnalysisRunId\.\$\{contractId\}/);
  assert.doesNotMatch(workspace, /getItem\("operion\.activeAnalysisRunId"\)/);
  assert.doesNotMatch(workspace, /ContractSpatialBridge/);
});

test("latest persisted document version overrides stale workspace analysis selection", async () => {
  const workspace = await read("frontend/src/routes/ContractWorkspace.jsx");
  const storedRunId = "55555555-5555-4555-8555-555555555555";

  assert.equal(resolveContractWorkspaceAnalysisRunId({
    hasLatestDocument: true,
    latestVersion: { analysis_run_id: "66666666-6666-4666-8666-666666666666" },
    storedRunId,
  }), "66666666-6666-4666-8666-666666666666");
  assert.equal(resolveContractWorkspaceAnalysisRunId({
    hasLatestDocument: true,
    latestVersion: { analysis_run_id: null },
    storedRunId,
  }), "");
  assert.equal(resolveContractWorkspaceAnalysisRunId({
    hasLatestDocument: true,
    latestVersion: undefined,
    storedRunId,
  }), "");
  assert.equal(resolveContractWorkspaceAnalysisRunId({
    hasLatestDocument: false,
    storedRunId,
  }), storedRunId);
  assert.match(workspace, /resolveContractWorkspaceAnalysisRunId\(\{\s*hasLatestDocument: true/);
  assert.match(workspace, /setErrorMessage\(error\.message \|\| "The selected document and version could not be verified\."\)/);
});

test("optional financial impact and transient status polling failures do not mask contract processing", async () => {
  const workspace = await read("frontend/src/routes/ContractWorkspace.jsx");

  assert.match(workspace, /getAnalysisRunFinancialImpact\(analysisRun\.id, organizationId\)\s*\.then\(\(result\) => \(\{ result, error: null \}\)\)\s*\.catch\(\(error\) => \(\{ result: null, error \}\)\)/);
  assert.match(workspace, /setFinancialImpactState\(financialImpactResult\.error \? "unavailable" : "ready"\)/);
  assert.match(workspace, /Processing status could not be refreshed\./);
  assert.match(workspace, /this status will retry automatically/);
  assert.match(workspace, /let cancelled = false;\s*const timer = window\.setInterval/);
  assert.match(workspace, /if \(cancelled\) return;\s*setAnalysisRun\(result\?\.analysisRun \|\| null\)/);
});

test("duplicate production uploads reopen the existing contract instead of triggering reanalysis", async () => {
  const [upload, productionUpload, workspace] = await Promise.all([
    read("frontend/src/components/demo/UploadContract.jsx"),
    read("frontend/src/routes/ProductionUpload.jsx"),
    read("frontend/src/routes/ContractWorkspace.jsx"),
  ]);

  assert.match(upload, /result\?\.duplicate\s*\?\s*"This document has already been uploaded\."/);
  assert.match(productionUpload, /if \(result\?\.contractId\)/);
  assert.match(productionUpload, /navigate\(`\/app\/contracts\/\$\{result\.contractId\}`\)/);
  assert.doesNotMatch(productionUpload, /if \(result\?\.duplicate\) return/);
  assert.match(workspace, /listDocumentVersions\(selectedDocument\.id, organizationId\)/);
});

test("contract workspace exposes the complete intelligence navigation", async () => {
  const workspace = await read("frontend/src/routes/ContractWorkspace.jsx");
  for (const [target, label] of [["overview", "Overview"], ["relationships", "Parties & Aircraft"], ["commercial-terms", "Commercial Terms"], ["obligations", "Obligations"], ["deadlines", "Key Dates"], ["financial-impact", "Financial Exposure"], ["risks", "Risks"], ["missing-terms", "Missing / Unclear"], ["actions", "Actions"], ["assistant", "Ask Matt"], ["clauses", "Clauses"]]) {
    assert.match(workspace, new RegExp(`(?:"${target}"|${target}): "${label}"`));
    assert.match(workspace, new RegExp(`id="${target}"`));
  }
  assert.match(workspace, /roleIntelligence\?\.sectionOrder/);
  assert.match(workspace, /Analyse contract/);
  assert.match(workspace, /Analyse obligations/);
  assert.match(workspace, /Build deadline intelligence/);
  assert.match(workspace, /formatDeadlineMonitoring\(deadline\.monitoring\)/);
  assert.match(workspace, /does not determine whether an obligation was performed/);
  assert.match(workspace, /"verified", "reviewed", "approved", "confirmed"/);
  assert.match(workspace, /Analyse contractual risks/);
  assert.match(workspace, /risk\.recommended_action \|\| risk\.metadata\?\.recommended_action/);
  assert.match(workspace, /Current deadline status:/);
  assert.match(workspace, /No active analysis run selected/);
  assert.match(workspace, /Key risks/);
  assert.match(workspace, /Key obligations/);
  assert.match(workspace, /Key deadlines/);
  assert.match(workspace, /Important clauses/);
  assert.match(workspace, /Lease lifecycle relationships/);
  assert.match(workspace, /Option exercise is not established by the available evidence/);
  assert.doesNotMatch(workspace, /risk score/i);
});

test("portfolio Q&A presents deterministic answers, evidence types, recommendations, and source links", async () => {
  const [workspace, panel, api] = await Promise.all([
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/components/intelligence/PortfolioContractAssistantPanel.jsx"),
    read("frontend/src/lib/contractsApi.js"),
  ]);
  assert.match(workspace, /<PortfolioContractAssistantPanel organizationId=\{organizationId\} \/>/);
  assert.match(api, /\/api\/analysis-runs\/portfolio-assistant/);
  assert.match(panel, /Deterministic evidence-grounded answer/);
  assert.match(panel, /Extracted contract text \(unverified\)/);
  assert.match(panel, /Existing risk assessment \(not a confirmed breach\)/);
  assert.match(panel, /human review required/i);
  assert.match(panel, /Open contract workspace/);
  assert.match(panel, /analysisRunId=\$\{encodeURIComponent\(citation\.analysisRunId\)\}/);
  assert.match(workspace, /requestedAnalysisRunId/);
  assert.match(workspace, /requestedAnalysisRun\.contract_id !== contractId/);
  assert.match(workspace, /requestedAnalysisRun\.document_version_id/);
});

test("contract recommendations retain evidence from the active run and link to that exact source version", async () => {
  const workspace = await read("frontend/src/routes/ContractWorkspace.jsx");
  assert.match(workspace, /function evidenceBackedRecommendations/);
  assert.match(workspace, /clausesById\.get\(source\.clauseId\)/);
  assert.match(workspace, /clauseText\.includes\(excerpt\)/);
  assert.match(workspace, /profileRunId === activeAnalysisRunId/);
  assert.match(workspace, /analysisRun\?\.document_version_id/);
  assert.match(workspace, /analysisRunId=\$\{encodeURIComponent\(activeAnalysisRunId\)\}#clause-/);
  assert.match(workspace, /Open cited source · version/);
  assert.match(workspace, /Source extraction is/);
  assert.match(workspace, /not probability/);
  assert.match(workspace, /Information still required/);
});

test("workspace evidence navigation uses canonical excerpts and source locators", async () => {
  const [workspace, evidencePanel, api, fulfilmentReview] = await Promise.all([
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/components/intelligence/EvidencePanel.jsx"),
    read("frontend/src/lib/contractsApi.js"),
    read("frontend/src/components/intelligence/ObligationFulfilmentReview.jsx"),
  ]);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/evidence/);
  assert.match(workspace, /listAnalysisRunEvidence/);
  assert.match(workspace, /Compare contract sources/);
  assert.match(workspace, /compareAnalysisRuns\(sourceAAnalysisRunId, sourceBAnalysisRunId, organizationId\)/);
  assert.match(workspace, /No linked page evidence is available for this clause/);
  assert.match(workspace, /Impact review:/);
  assert.match(workspace, /Financial assessment requiring review:/);
  assert.match(workspace, /Potentially affected deadline requiring confirmation:/);
  assert.match(workspace, /related intelligence has not been independently revalidated/);
  assert.match(api, /\/api\/analysis-runs\/\$\{sourceAAnalysisRunId\}\/compare\/\$\{sourceBAnalysisRunId\}/);
  assert.match(workspace, /EvidencePanel findingLabel=\{clause/);
  assert.match(workspace, /EvidencePanel findingLabel=\{obligation/);
  assert.match(workspace, /ObligationFulfilmentReview analysisRunId=\{activeAnalysisRunId\}/);
  assert.match(workspace, /ORGANIZATION_PERMISSIONS\.CONTRACT_WRITE/);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/obligations\/\$\{obligationId\}\/fulfilment/);
  assert.match(fulfilmentReview, /Missing evidence is not proof of non-fulfilment/);
  assert.match(fulfilmentReview, /Record append-only assessment/);
  assert.match(fulfilmentReview, /reviewer \{item\.reviewerUserId/);
  assert.match(fulfilmentReview, /Period matches/);
  assert.match(fulfilmentReview, /Disputed/);
  assert.match(fulfilmentReview, /contradicts/);
  assert.match(fulfilmentReview, /extraction confidence/);
  assert.match(fulfilmentReview, /uncertainty:/);
  assert.match(fulfilmentReview, /state === "loading"/);
  assert.match(fulfilmentReview, /state === "error"/);
  assert.match(fulfilmentReview, /No fulfilment assessment has been recorded/);
  assert.match(fulfilmentReview, /No separate-document evidence is available/);
  assert.match(workspace, /EvidencePanel findingLabel=\{deadline/);
  assert.match(evidencePanel, /source\.excerpt/);
  assert.match(evidencePanel, /source\.source_locator/);
  assert.match(evidencePanel, /Page \$\{source\.page_number\}/);
});

test("financial workspace connects contractual amounts to lifecycle dates and lease decisions", async () => {
  const [workspace, financialImpact] = await Promise.all([
    read("frontend/src/routes/ContractWorkspace.jsx"),
    read("frontend/src/components/intelligence/FinancialImpactSection.jsx"),
  ]);
  assert.match(workspace, /deadlines=\{deadlines\}/);
  assert.match(workspace, /leaseRiskAssessment=\{aviationLeaseAssessment\}/);
  assert.match(financialImpact, /Phase 29 date monitoring/);
  assert.match(financialImpact, /Date status does not establish payment or performance/);
  assert.match(financialImpact, /Phase 35 risk:/);
  assert.match(financialImpact, /Phase 36 action:/);
});

test("assistant interaction is analysis-run scoped and handles missing intelligence", async () => {
  const [assistant, api, service, matt] = await Promise.all([
    read("frontend/src/components/intelligence/ContractAssistantPanel.jsx"),
    read("frontend/src/lib/contractsApi.js"),
    read("services/phase3/intelligence/contractAssistantService.js"),
    read("frontend/src/routes/Matt.jsx"),
  ]);
  assert.match(api, /\/api\/analysis-runs\/\$\{analysisRunId\}\/assistant/);
  assert.match(api, /body: \{ question \}/);
  assert.match(assistant, /<MattExperience.*organizationId=\{organizationId\}.*analysisRunId=\{analysisRunId\}/);
  assert.match(assistant, /ORGANIZATION_PERMISSIONS\.CONTRACT_READ/);
  assert.match(matt, /askContractAssistant\(analysisRunId, organizationId, resolved, \{ signal: controller\.signal \}\)/);
  assert.match(matt, /Linked source evidence was supplied by the existing assistant/);
  assert.match(matt, /Not established\. Do not infer/);
  assert.match(matt, /decision support, not legal advice/);
  assert.match(service, /intelligenceConsumption: 0/);
  assert.match(service, /does not establish an evidence-backed answer/);
});
