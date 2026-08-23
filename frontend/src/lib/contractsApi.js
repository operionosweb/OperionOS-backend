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

export function listContractDocuments(contractId, organizationId) {
  // GET /api/contracts/:id/documents -> { success, documents }
  return apiRequest(`/api/contracts/${contractId}/documents`, { organizationId });
}

export function listDocumentVersions(documentId, organizationId) {
  // GET /api/documents/:id/versions -> { success, versions }
  return apiRequest(`/api/documents/${documentId}/versions`, { organizationId });
}

export function getAnalysisRun(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id -> { success, analysisRun }
  return apiRequest(`/api/analysis-runs/${analysisRunId}`, { organizationId });
}

export function listAnalysisRunClauses(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id/clauses -> { success, clauses }
  return apiRequest(`/api/analysis-runs/${analysisRunId}/clauses`, { organizationId });
}

export function listAnalysisRunObligations(analysisRunId, organizationId) {
  // GET /api/analysis-runs/:id/obligations -> { success, obligations }
  return apiRequest(`/api/analysis-runs/${analysisRunId}/obligations`, { organizationId });
}

export function uploadContract({ file, title, contractId, organizationId }) {
  // POST /api/contracts/upload (multipart) -> { contractId, documentId, documentVersionId, analysisRunId, status, sha256, pageCount, textLength }
  return apiUpload("/api/contracts/upload", {
    file,
    fields: { title, contract_id: contractId || undefined },
    organizationId,
  });
}
