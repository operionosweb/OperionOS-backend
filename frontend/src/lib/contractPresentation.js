const CONTRACT_TYPE_LABELS = Object.freeze({
  AIRCRAFT_LEASE: "Aircraft Lease",
  MRO: "MRO",
  SUPPLIER: "Supplier",
  GROUND_HANDLING: "Ground Handling",
  AIRPORT_SERVICES: "Airport Services",
});

export const CONTRACT_TYPE_NOT_ESTABLISHED = "Contract type not established";

export function formatContractType(value) {
  if (!value || !String(value).trim()) return CONTRACT_TYPE_NOT_ESTABLISHED;

  const normalized = String(value).trim().toUpperCase().replaceAll(/[\s-]+/g, "_");
  if (CONTRACT_TYPE_LABELS[normalized]) return CONTRACT_TYPE_LABELS[normalized];

  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word === "MRO" ? word : `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

export function formatClassificationConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  return `${Math.round(confidence * 100)}% confidence`;
}

export function getContractClassificationPresentation(contract, profile = null) {
  const type = profile?.metadata?.contractType
    || profile?.classification?.type
    || contract?.contract_type;
  const confidence = profile?.classification?.confidence
    ?? contract?.contract_type_confidence;

  return {
    type: formatContractType(type),
    confidence: formatClassificationConfidence(confidence),
    isEstablished: Boolean(type && String(type).trim()),
  };
}
