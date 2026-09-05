import { apiRequest, apiUpload } from "./apiClient";

/**
 * Every function here maps to a real, existing backend route.
 * See routes/contractRoutes.js, routes/documentRoutes.js, routes/analysisRunRoutes.js.
 * No endpoint, field, or response shape below is invented.
 */

export function listContracts(organizationId) {
  // GET /api/contracts -> { success, total, contracts }
  return apiRequest("/api/contracts", { organizationId });
}

export function getContract(contractId, organizationId) {
  // GET /api/contracts/:id -> { success, contract }
  return apiRequest(`/api/contracts/${contractId}`, { organizationId });
}

export function getContractProcessingStatus(contractId, organizationId) {
  return apiRequest(`/api/contracts/${contractId}/processing-status`, { organizationId });
}

export function listContractDocuments(contractId, organizationId) {
  // GET /api/contracts/:id/documents -> { success, documents }
  return apiRequest(`/api/contracts/${contractId}/documents`, { organizationId });
}

export function listDocumentVersions(documentId, organizationId) {
  // GET /api/documents/:id/versions -> { success, versions }
  return apiRequest(`/api/documents/${documentId}/versions`, { organizationId });
}

export function getDocumentStructure(documentId, organizationId) {
  return apiRequest(`/api/documents/${documentId}/structure`, { organizationId });
}

export function getAnalysisRun(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id -> { success, analysisRun }
  return apiRequest(`/api/analysis-runs/${analysisRunId}`, { organizationId });
}

export function processContractIntelligence(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/process`, { method: "POST", organizationId });
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

export function searchContractIntelligence(analysisRunId, organizationId, query, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest(`/api/analysis-runs/${analysisRunId}/search?${params}`, { organizationId });
}

export function listAnalysisRunClauses(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id/clauses -> { success, clauses }
  return apiRequest(`/api/analysis-runs/${analysisRunId}/clauses`, { organizationId });
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

export function listAnalysisRunEvidence(analysisRunId, organizationId) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/evidence`, { organizationId });
}

export function askContractAssistant(analysisRunId, organizationId, question) {
  return apiRequest(`/api/analysis-runs/${analysisRunId}/assistant`, {
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
