export const RISK_TAXONOMY_VERSION = "aviation-contract-risk-v1";

export const RISK_TAXONOMY = Object.freeze({
  financial: Object.freeze([
    "payment_exposure", "cost_escalation", "uncapped_financial_exposure",
    "indemnity_exposure", "penalty_exposure", "reserve_exposure",
  ]),
  operational: Object.freeze([
    "operational_constraint", "service_level_exposure", "turnaround_exposure",
    "maintenance_exposure", "availability_exposure", "operational_dependency",
  ]),
  compliance: Object.freeze([
    "regulatory_compliance", "reporting_compliance", "certification_exposure",
    "documentation_exposure",
  ]),
  timing: Object.freeze([
    "short_notice_period", "missed_deadline_exposure", "ambiguous_deadline",
    "trigger_dependency", "recurring_compliance",
  ]),
  liability: Object.freeze([
    "broad_indemnity", "third_party_liability", "uncapped_liability", "insurance_gap",
  ]),
  termination_default: Object.freeze([
    "termination_exposure", "default_exposure", "cure_period_exposure", "cross_default",
  ]),
  commercial: Object.freeze([
    "restrictive_terms", "unfavorable_renewal", "automatic_renewal",
    "pricing_exposure", "volume_commitment",
  ]),
  dependency: Object.freeze([
    "single_supplier_dependency", "third_party_dependency", "external_event_dependency",
  ]),
  data_information: Object.freeze([
    "reporting_dependency", "information_dependency", "recordkeeping_exposure",
  ]),
});

export const RISK_CATEGORIES = Object.freeze(Object.keys(RISK_TAXONOMY));
export const RISK_TYPES = Object.freeze(Object.values(RISK_TAXONOMY).flat());

export function isRiskType(category, riskType) {
  return RISK_TAXONOMY[category]?.includes(riskType) === true;
}