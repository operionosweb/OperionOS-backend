export const CLAUSE_CATEGORIES = Object.freeze([
  "commercial/payment",
  "pricing/escalation",
  "maintenance",
  "delivery/redelivery",
  "insurance",
  "liability/indemnity",
  "termination/default",
  "compliance/sanctions",
  "operations/service levels",
  "confidentiality/data protection",
  "renewal/notice",
  "governing law/dispute resolution",
  "general",
]);

export const RISK_CATEGORIES = Object.freeze([
  "liability",
  "indemnity",
  "insurance",
  "payment/commercial",
  "maintenance/operational",
  "delivery/redelivery",
  "termination/default",
  "compliance/sanctions",
  "data protection/confidentiality",
  "service-level/performance",
  "missing protection",
]);

export const DEADLINE_TYPES = Object.freeze([
  "fixed_date",
  "relative_deadline",
  "notice_period",
  "renewal_date",
  "expiry_date",
  "payment_deadline",
  "delivery_date",
  "redelivery_date",
  "maintenance_deadline",
  "inspection_deadline",
  "cure_period",
]);

export const RECOMMENDATION_TYPES = Object.freeze([
  "review",
  "renegotiate",
  "clarify",
  "assign_owner",
  "monitor_deadline",
  "confirm_compliance",
  "escalate",
]);

export const ANALYSIS_RUN_STATES = Object.freeze([
  "queued",
  "processing",
  "extracting",
  "analysing",
  "indexing",
  "completed",
  "failed",
  "cancelled",
  "requires_review",
]);

export const REVIEW_STATUSES = Object.freeze([
  "pending",
  "verified",
  "requires_review",
  "rejected",
]);

export const SEVERITIES = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

export const PRIORITIES = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

export const SUPPORT_TYPES = Object.freeze([
  "supports",
  "contradicts",
  "context",
]);

export function isOneOf(value, values) {
  return values.includes(value);
}
