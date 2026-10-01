import { apiRequest } from "./apiClient";

const base = "/api/intelligence";

export const getCommercialAccess = () => apiRequest(`${base}/access`);
export const getCommercialDashboard = () => apiRequest(`${base}/dashboard`);
export const listCommercialCompanies = () => apiRequest(`${base}/companies`);
export const getCommercialCompany = (id) => apiRequest(`${base}/companies/${id}`);
export const createCommercialCompany = (body) => apiRequest(`${base}/companies`, { method: "POST", body });
export const listCommercialPeople = (companyId = "") => apiRequest(`${base}/people${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`);
export const createCommercialPerson = (body) => apiRequest(`${base}/people`, { method: "POST", body });
export const listCommercialSignals = (companyId = "") => apiRequest(`${base}/signals${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`);
export const createCommercialSignal = (body) => apiRequest(`${base}/signals`, { method: "POST", body });
export const listCommercialOpportunities = () => apiRequest(`${base}/opportunities`);
export const getCommercialOpportunity = (id) => apiRequest(`${base}/opportunities/${id}`);
export const createCommercialOpportunity = (body) => apiRequest(`${base}/opportunities`, { method: "POST", body });
export const updateCommercialOpportunity = (id, body) => apiRequest(`${base}/opportunities/${id}`, { method: "PATCH", body });
export const reasonCommercialOpportunity = (id) => apiRequest(`${base}/opportunities/${id}/reason`, { method: "POST" });
export const createCommercialSource = (body) => apiRequest(`${base}/sources`, { method: "POST", body });
export const linkCommercialSource = (sourceId, body) => apiRequest(`${base}/sources/${sourceId}/link`, { method: "POST", body });