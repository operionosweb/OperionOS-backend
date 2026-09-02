import { apiRequest } from "./apiClient";

export function getAviationStatus(organizationId) {
  return apiRequest("/api/aviation/status", { organizationId });
}

export function listAircraft(organizationId, { companyOnly = false } = {}) {
  return apiRequest(`/api/aviation/aircraft${companyOnly ? "?scope=company" : ""}`, { organizationId });
}

export function getAircraftIntelligence(aircraftId, organizationId) {
  return apiRequest(`/api/aviation/aircraft/${aircraftId}/intelligence`, { organizationId });
}

export function getAviationWeather(organizationId, bounds) {
  const query = bounds ? `?bounds=${encodeURIComponent(bounds)}` : "";
  return apiRequest(`/api/aviation/weather${query}`, { organizationId });
}