import { apiRequest, apiUpload } from "./apiClient";

/**
 * Every function here maps to a real, existing backend route.
 * See routes/contractRoutes.js, routes/documentRoutes.js, routes/analysisRunRoutes.js.
 * No endpoint, field, or response shape below is invented.
 */

export function listContracts(organizationId, { signal } = {}) {
  // GET /api/contracts -> { success, total, contracts }
  return apiRequest("/api/contracts", { organizationId, signal });
}

export function getAviationContractPortfolioIntelligence(organizationId) {
  return apiRequest("/api/portfolio/aviation-intelligence", { organizationId });
}

export function getAviationExternalRiskIntelligence(organizationId, { contractId, analysisRunId } = {}) {
  const params = new URLSearchParams();
  if (contractId) params.set("contractId", contractId);
  if (analysisRunId) params.set("analysisRunId", analysisRunId);
  const search = params.toString();
  const query = search ? `?${search}` : "";
  return apiRequest(`/api/portfolio/aviation-external-risk${query}`, { organizationId, cache: "no-store" });
}

export function refreshAviationExternalObservations(organizationId) {
  return apiRequest("/api/portfolio/aviation-external-risk/refresh", {
    method: "POST",
    organizationId,
    body: {},
  });
}

export function calculateAviationFxReferenceSensitivity(organizationId, {
  contractId,
  analysisRunId,
  assessmentId,
  scenarioQuotePerEur,
  scenarios,
}) {
  return apiRequest(`/api/portfolio/aviation-external-risk/${encodeURIComponent(contractId)}/fx-sensitivity`, {
    method: "POST",
    organizationId,
    body: { analysisRunId, assessmentId, scenarioQuotePerEur, scenarios },
  });
}

export function calculateAviationInterestRateScenarios(organizationId, {
  contractId,
  analysisRunId,
  assessmentId,
  principalAmount,
  scenarios,
}) {
  return apiRequest(`/api/portfolio/aviation-external-risk/${encodeURIComponent(contractId)}/interest-sensitivity`, {
    method: "POST",
    organizationId,
    body: { analysisRunId, assessmentId, principalAmount, scenarios },
  });
}

export function calculateAviationIndexationScenarios(organizationId, { contractId, analysisRunId, assessmentId, scenarios }) {
  return apiRequest(`/api/portfolio/aviation-external-risk/${encodeURIComponent(contractId)}/indexation-sensitivity`, {
    method: "POST", organizationId, body: { analysisRunId, assessmentId, scenarios },
  });
}

export function getContract(contractId, organizationId) {
  // GET /api/contracts/:id -> { success, contract }
  return apiRequest(`/api/contracts/${contractId}`, { organizationId });
}

export function getContractProcessingStatus(contractId, organizationId) {
  return apiRequest(`/api/contracts/${contractId}/processing-status`, { organizationId });
}

export function listContractDocuments(contractId, organizationId, { signal } = {}) {
  // GET /api/contracts/:id/documents -> { success, documents }
  return apiRequest(`/api/contracts/${contractId}/documents`, { organizationId, signal });
}

export function listDocumentVersions(documentId, organizationId, { signal } = {}) {
  // GET /api/documents/:id/versions -> { success, versions }
  return apiRequest(`/api/documents/${documentId}/versions`, { organizationId, signal });
}

export function getDocumentStructure(documentId, organizationId) {
  return apiRequest(`/api/documents/${documentId}/structure`, { organizationId });
}

export function getAnalysisRun(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id -> { success, analysisRun }
  return apiRequest(`/api/analysis-runs/${analysisRunId}`, { organizationId });
}

export function processContractIntelligence(analysisRunId, organizationId, options) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/process`, { method: "POST", organizationId, body: options });
}

export function getAnalysisRunProfile(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/profile`, { organizationId });
}

export function listAnalysisRunRelationships(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/relationships`, { organizationId });
}

export function getAnalysisRunFinancialImpact(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/financial-impact`, { organizationId });
}

export function reviewAviationEventImpact(analysisRunId, organizationId, event) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/aviation-event-impact`, {
    method: "POST",
    organizationId,
    body: { event },
  });
}

export function getAnalysisRunRoleIntelligence(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/role-intelligence`, { organizationId });
}

export function searchContractIntelligence(analysisRunId, organizationId, query, limit = 20, { signal } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest(`/api/analysis-runs/${analysisRunId}/search?${params}`, { organizationId, signal });
}

export function listAnalysisRunClauses(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id/clauses -> { success, clauses }
  return apiRequest(`/api/analysis-runs/${analysisRunId}/clauses`, { organizationId });
}

export function compareAnalysisRuns(sourceAAnalysisRunId, sourceBAnalysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${sourceAAnalysisRunId}/compare/${sourceBAnalysisRunId}`, { organizationId });
}

export function analyzeClauses(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/clauses/analyze`, {
    method: "POST",
    organizationId,
  });
}

export function listAnalysisRunObligations(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id/obligations -> { success, obligations }
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations`, { organizationId });
}

export function getObligationFulfilment(analysisRunId, obligationId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations/${obligationId}/fulfilment`, { organizationId });
}

export function assessObligationFulfilment(analysisRunId, obligationId, organizationId, assessment) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations/${obligationId}/fulfilment`, {
    method: "POST",
    organizationId,
    body: assessment,
  });
}

export function getObligationEstimate(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations/estimate`, { organizationId });
}

export function analyzeObligations(analysisRunId, organizationId, confirmation = false) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations/analyze`, {
    method: "POST",
    organizationId,
    body: { confirmation },
  });
}

export function listAnalysisRunDeadlines(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/deadlines`, { organizationId });
}

export function analyzeDeadlines(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/deadlines/analyze`, {
    method: "POST",
    organizationId,
  });
}

export function listAnalysisRunRisks(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/risks`, { organizationId });
}

export function getAviationLeaseRiskAssessment(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/aviation-lease-risk-assessment`, { organizationId });
}

export function getAviationOutcomeHistory(analysisRunId, organizationId) {
  return apiRequest(`/api/aviation-outcomes/${analysisRunId}`, { organizationId });
}

export function recordAviationOutcome(analysisRunId, organizationId, outcome) {
  return apiRequest(`/api/aviation-outcomes/${analysisRunId}/outcomes`, {
    method: "POST",
    organizationId,
    body: outcome,
  });
}

export function snapshotAviationUtilisationForecast(analysisRunId, organizationId, metric) {
  return apiRequest(`/api/aviation-outcomes/${analysisRunId}/forecast-snapshots`, {
    method: "POST",
    organizationId,
    body: { metric },
  });
}

export function getAviationForecastBacktest(analysisRunId, organizationId) {
  return apiRequest(`/api/aviation-outcomes/${analysisRunId}/backtest`, { organizationId });
}

export function decideAviationLeaseRecommendation(analysisRunId, recommendationKey, organizationId, decision) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/aviation-lease-recommendations/${recommendationKey}/decision`, {
    method: "POST",
    organizationId,
    body: decision,
  });
}

export function listAnalysisRunEvidence(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/evidence`, { organizationId });
}

export function askContractAssistant(analysisRunId, organizationId, question, { signal } = {}) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/assistant`, {
    method: "POST",
    organizationId,
    body: { question },
    signal,
  });
}

export function askPortfolioContractAssistant(organizationId, question) {
  return apiRequest("/api/analysis-runs/portfolio-assistant", {
    method: "POST",
    organizationId,
    body: { question },
  });
}

export function getRiskEstimate(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/risks/estimate`, { organizationId });
}

export function analyzeRisks(analysisRunId, organizationId, { useAIFallback = false, confirmation = false } = {}) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/risks/analyze`, {
    method: "POST",
    organizationId,
    body: { useAIFallback, confirmation },
  });
}

export function analyzeContractClauses({ contractId, documentVersionId, organizationId, confirmation = false }) {
  return apiRequest(`/api/contracts/${contractId}/analyze`, {
    method: "POST",
    organizationId,
    body: { document_version_id: documentVersionId, confirmation },
  });
}

export function uploadContract({ file, title, contractId, organizationId }) {
  // POST /api/contracts/upload (multipart) -> { contractId, documentId, documentVersionId, analysisRunId, status, sha256, pageCount, textLength }
  return apiUpload("/api/contracts/upload", {
    file,
    fields: { title, contract_id: contractId || undefined },
    organizationId,
  });
}
