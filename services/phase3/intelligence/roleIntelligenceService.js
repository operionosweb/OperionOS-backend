export const INTELLIGENCE_DOMAINS = Object.freeze([
  "CONTRACT", "FINANCIAL", "LEGAL", "OPERATIONAL", "COMPLIANCE", "SUPPLIER",
  "AIRCRAFT", "MAINTENANCE", "DEADLINES", "RISK", "COMMERCIAL", "STRATEGIC",
]);

const DEFAULT_SECTION_ORDER = Object.freeze([
  "overview", "relationships", "commercial-terms", "obligations", "deadlines",
  "financial-impact", "risks", "missing-terms", "actions", "evidence", "assistant", "clauses", "search",
]);

function profile({
  roleId,
  roleName,
  roleType = "ORGANIZATION",
  description,
  intelligenceDomains,
  prioritySignals,
  preferredInsights,
  preferredRisks,
  preferredAlerts,
  preferredRecommendations,
  preferredActions,
  preferredMetrics,
  preferredContractSections,
  preferredAiContext,
  notificationPreferences = [],
  summaryPrompt,
  alertPrefix,
  actionPrefix,
}) {
  return Object.freeze({
    roleId,
    roleName,
    roleType,
    description,
    intelligenceDomains: Object.freeze(intelligenceDomains),
    prioritySignals: Object.freeze(prioritySignals),
    preferredInsights: Object.freeze(preferredInsights),
    preferredRisks: Object.freeze(preferredRisks),
    preferredAlerts: Object.freeze(preferredAlerts),
    preferredRecommendations: Object.freeze(preferredRecommendations),
    preferredActions: Object.freeze(preferredActions),
    preferredMetrics: Object.freeze(preferredMetrics),
    preferredContractSections: Object.freeze(preferredContractSections),
    preferredAiContext: Object.freeze(preferredAiContext),
    notificationPreferences: Object.freeze(notificationPreferences),
    summaryPrompt,
    alertPrefix,
    actionPrefix,
  });
}

const PROFILES = Object.freeze({
  DEFAULT: profile({
    roleId: "DEFAULT", roleName: "Contract Intelligence", description: "Neutral evidence-backed contract intelligence.",
    intelligenceDomains: ["CONTRACT", "RISK", "DEADLINES"], prioritySignals: ["severity", "deadline", "missing_term"],
    preferredInsights: ["contract_summary", "key_risks", "key_obligations"], preferredRisks: ["material_contract_risk"],
    preferredAlerts: ["critical_deadline", "high_severity_risk"], preferredRecommendations: ["evidence_backed_action"],
    preferredActions: ["review", "assign_owner"], preferredMetrics: ["risk_count", "deadline_count"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["contract", "evidence", "risks", "obligations", "deadlines"],
    summaryPrompt: "What contract intelligence requires attention?", alertPrefix: "Contract attention", actionPrefix: "Contract action",
  }),
  EXECUTIVE: profile({
    roleId: "EXECUTIVE", roleName: "Executive", description: "Strategic exposure, continuity, and highest-impact decisions.",
    intelligenceDomains: ["STRATEGIC", "RISK", "FINANCIAL", "OPERATIONAL", "AIRCRAFT"], prioritySignals: ["critical", "business_continuity", "material_exposure", "renewal"],
    preferredInsights: ["strategic_exposure", "critical_risks", "business_continuity"], preferredRisks: ["termination", "renewal", "aircraft_availability"],
    preferredAlerts: ["strategic_continuity", "critical_exposure"], preferredRecommendations: ["executive_decision"],
    preferredActions: ["assess_continuity", "assign_executive_owner"], preferredMetrics: ["material_exposure", "critical_risk_count"],
    preferredContractSections: ["overview", "risks", "financial-impact", "deadlines", "actions", "relationships", "obligations", "commercial-terms", "missing-terms", "evidence", "assistant", "clauses", "search"],
    preferredAiContext: ["strategic impact", "financial exposure", "continuity", "critical deadlines"],
    summaryPrompt: "What requires an executive decision?", alertPrefix: "Strategic exposure", actionPrefix: "Executive review",
  }),
  CFO: profile({
    roleId: "CFO", roleName: "CFO", description: "Financial commitments, exposure, pricing, and cost uncertainty.",
    intelligenceDomains: ["FINANCIAL", "COMMERCIAL", "RISK", "DEADLINES"], prioritySignals: ["amount", "rent", "reserve", "escalation", "currency", "termination_cost"],
    preferredInsights: ["financial_exposure", "recurring_cost", "payment_obligation"], preferredRisks: ["financial", "pricing", "currency", "renewal"],
    preferredAlerts: ["payment_deadline", "financial_exposure"], preferredRecommendations: ["financial_review", "exposure_model"],
    preferredActions: ["validate_amount", "model_exposure"], preferredMetrics: ["contractual_commitment", "financial_exposure"],
    preferredContractSections: ["financial-impact", "commercial-terms", "overview", "risks", "deadlines", "obligations", "actions", "missing-terms", "relationships", "evidence", "assistant", "clauses", "search"],
    preferredAiContext: ["financial exposure", "recurring cost", "pricing", "currency", "termination cost"],
    summaryPrompt: "What financial exposure requires attention?", alertPrefix: "Financial exposure", actionPrefix: "Finance review",
  }),
  LEGAL: profile({
    roleId: "LEGAL", roleName: "Legal", description: "Contractual protections, obligations, compliance, and legal exposure.",
    intelligenceDomains: ["LEGAL", "CONTRACT", "COMPLIANCE", "RISK", "DEADLINES"], prioritySignals: ["liability", "indemnity", "termination", "notice", "missing_clause", "governing_law"],
    preferredInsights: ["contractual_risk", "missing_terms", "termination_rights"], preferredRisks: ["legal", "compliance", "liability", "termination"],
    preferredAlerts: ["notice_deadline", "compliance_gap"], preferredRecommendations: ["legal_review", "contractual_protection"],
    preferredActions: ["review_clause", "preserve_rights"], preferredMetrics: ["missing_term_count", "legal_risk_count"],
    preferredContractSections: ["risks", "clauses", "missing-terms", "obligations", "deadlines", "overview", "actions", "commercial-terms", "financial-impact", "relationships", "evidence", "assistant", "search"],
    preferredAiContext: ["contractual risk", "legal exposure", "compliance", "termination", "notice"],
    summaryPrompt: "What contractual or legal issues require attention?", alertPrefix: "Contractual deadline", actionPrefix: "Legal review",
  }),
  CONTRACT_MANAGER: profile({
    roleId: "CONTRACT_MANAGER", roleName: "Contract Manager", description: "Obligations, deadlines, renewals, and next actions.",
    intelligenceDomains: ["CONTRACT", "DEADLINES", "RISK", "COMPLIANCE"], prioritySignals: ["obligation", "deadline", "renewal", "notice", "owner", "missing_term"],
    preferredInsights: ["next_obligation", "upcoming_deadline", "missing_term"], preferredRisks: ["performance", "renewal", "notice"],
    preferredAlerts: ["action_due", "renewal_window"], preferredRecommendations: ["tracked_action", "counterparty_discussion"],
    preferredActions: ["assign_owner", "create_action", "issue_notice"], preferredMetrics: ["open_obligation_count", "deadline_count"],
    preferredContractSections: ["obligations", "deadlines", "actions", "overview", "risks", "missing-terms", "commercial-terms", "financial-impact", "relationships", "evidence", "assistant", "clauses", "search"],
    preferredAiContext: ["obligations", "deadlines", "actions", "renewal", "notice"],
    summaryPrompt: "What needs to be done next?", alertPrefix: "Action required", actionPrefix: "Contract management",
  }),
  OPERATIONS: profile({
    roleId: "OPERATIONS", roleName: "Operations", description: "Aircraft availability, maintenance, redelivery, and operational continuity.",
    intelligenceDomains: ["OPERATIONAL", "AIRCRAFT", "MAINTENANCE", "DEADLINES", "RISK"], prioritySignals: ["aircraft", "availability", "maintenance", "redelivery", "records", "airworthiness"],
    preferredInsights: ["operational_exposure", "aircraft_availability", "redelivery_readiness"], preferredRisks: ["operational", "maintenance", "redelivery", "records"],
    preferredAlerts: ["availability_impact", "maintenance_deadline"], preferredRecommendations: ["operational_mitigation", "redelivery_plan"],
    preferredActions: ["prepare_aircraft", "verify_records", "assign_technical_owner"], preferredMetrics: ["operational_risk_count", "redelivery_requirement_count"],
    preferredContractSections: ["relationships", "obligations", "deadlines", "risks", "overview", "actions", "commercial-terms", "financial-impact", "missing-terms", "evidence", "assistant", "clauses", "search"],
    preferredAiContext: ["aircraft availability", "maintenance", "redelivery", "operational deadline"],
    summaryPrompt: "What could affect aircraft operations?", alertPrefix: "Operational impact", actionPrefix: "Operations review",
  }),
  PROCUREMENT: profile({
    roleId: "PROCUREMENT", roleName: "Procurement", description: "Supplier commitments, pricing, renewal, and negotiation exposure.",
    intelligenceDomains: ["SUPPLIER", "COMMERCIAL", "FINANCIAL", "CONTRACT", "RISK"], prioritySignals: ["supplier", "pricing", "renewal", "service", "negotiation"],
    preferredInsights: ["supplier_obligation", "pricing_exposure", "negotiation_opportunity"], preferredRisks: ["supplier", "commercial", "renewal", "pricing"],
    preferredAlerts: ["renewal_pricing", "supplier_failure"], preferredRecommendations: ["supplier_review", "negotiation_preparation"],
    preferredActions: ["engage_supplier", "prepare_negotiation"], preferredMetrics: ["supplier_obligation_count", "renewal_exposure"],
    preferredContractSections: ["commercial-terms", "obligations", "deadlines", "risks", "actions", "overview", "financial-impact", "missing-terms", "relationships", "evidence", "assistant", "clauses", "search"],
    preferredAiContext: ["supplier", "pricing", "renewal", "commercial risk", "negotiation"],
    summaryPrompt: "What supplier or commercial issue requires attention?", alertPrefix: "Supplier exposure", actionPrefix: "Procurement review",
  }),
  ANALYST: profile({
    roleId: "ANALYST", roleName: "Analyst", description: "Broad evidence, exposure, and comparative intelligence.",
    intelligenceDomains: [...INTELLIGENCE_DOMAINS], prioritySignals: ["confidence", "evidence", "exposure", "trend"],
    preferredInsights: ["evidence", "exposure_analysis", "data_quality"], preferredRisks: ["all_supported_risks"],
    preferredAlerts: ["material_change", "data_gap"], preferredRecommendations: ["further_analysis"],
    preferredActions: ["investigate", "compare", "validate_evidence"], preferredMetrics: ["confidence", "coverage", "exposure"],
    preferredContractSections: ["overview", "risks", "financial-impact", "obligations", "deadlines", "evidence", "clauses", "commercial-terms", "missing-terms", "actions", "relationships", "assistant", "search"],
    preferredAiContext: ["evidence", "confidence", "exposure", "comparison"],
    summaryPrompt: "What evidence-backed patterns require further analysis?", alertPrefix: "Analytical signal", actionPrefix: "Analysis",
  }),
  VIEWER: profile({
    roleId: "VIEWER", roleName: "Viewer", description: "Neutral read-only Contract Intelligence.",
    intelligenceDomains: ["CONTRACT", "RISK", "DEADLINES"], prioritySignals: ["severity", "deadline"],
    preferredInsights: ["contract_summary", "key_risks"], preferredRisks: ["material_contract_risk"],
    preferredAlerts: ["critical_deadline"], preferredRecommendations: ["evidence_backed_action"],
    preferredActions: ["review"], preferredMetrics: ["risk_count", "deadline_count"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["contract", "evidence"],
    summaryPrompt: "What contract intelligence is established?", alertPrefix: "Contract attention", actionPrefix: "Review",
  }),
  OPERION_INTERNAL: profile({
    roleId: "OPERION_INTERNAL", roleName: "Operion Internal", roleType: "PLATFORM", description: "Internal platform, processing, product, and customer-support intelligence.",
    intelligenceDomains: ["STRATEGIC", "OPERATIONAL", "RISK", "COMMERCIAL"], prioritySignals: ["platform_health", "processing_failure", "pilot_issue", "quality"],
    preferredInsights: ["platform_health", "processing_status", "extraction_quality"], preferredRisks: ["platform", "operational", "customer_issue"],
    preferredAlerts: ["processing_failure", "quality_issue"], preferredRecommendations: ["operational_resolution"],
    preferredActions: ["investigate", "resolve", "support_customer"], preferredMetrics: ["processing_success", "quality", "usage"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["platform health", "processing quality", "customer issue"],
    summaryPrompt: "What internal operational intelligence requires attention?", alertPrefix: "Operion internal", actionPrefix: "Internal action",
  }),
  COMMERCIAL: profile({
    roleId: "COMMERCIAL", roleName: "Commercial", roleType: "PLATFORM", description: "Companies, opportunities, signals, contacts, and evidence-grounded outreach.",
    intelligenceDomains: ["COMMERCIAL", "STRATEGIC", "FINANCIAL", "CONTRACT", "RISK"], prioritySignals: ["opportunity", "signal", "fleet", "procurement", "renewal", "contact"],
    preferredInsights: ["priority_opportunities", "company_signals", "key_people"], preferredRisks: ["commercial", "supplier", "renewal"],
    preferredAlerts: ["recent_signal", "opportunity_action"], preferredRecommendations: ["role_specific_approach"],
    preferredActions: ["qualify_opportunity", "validate_signal", "prepare_outreach"], preferredMetrics: ["active_opportunities", "sourced_signals"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["company", "signal", "opportunity", "contact", "evidence"],
    summaryPrompt: "Who should Operion talk to, why now, and what should happen next?", alertPrefix: "Commercial signal", actionPrefix: "Commercial action",
  }),
  PRODUCT: profile({
    roleId: "PRODUCT", roleName: "Product", roleType: "PLATFORM", description: "Repeated customer pain, contract use cases, and product opportunities.",
    intelligenceDomains: ["CONTRACT", "OPERATIONAL", "STRATEGIC", "RISK", "COMMERCIAL"], prioritySignals: ["pain", "workflow", "repeated", "complexity", "use case"],
    preferredInsights: ["repeated_use_cases", "customer_pain", "product_opportunities"], preferredRisks: ["workflow_gap"],
    preferredAlerts: ["repeated_pain_signal"], preferredRecommendations: ["product_discovery"],
    preferredActions: ["validate_use_case", "research_workflow"], preferredMetrics: ["use_case_frequency"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["pain point", "use case", "workflow", "contract complexity"],
    summaryPrompt: "What customer pain or repeated use case should shape the product?", alertPrefix: "Product signal", actionPrefix: "Product discovery",
  }),
  CUSTOMER_SUCCESS: profile({
    roleId: "CUSTOMER_SUCCESS", roleName: "Customer Success", roleType: "PLATFORM", description: "Customer expansion, retention, adoption, and unresolved value signals.",
    intelligenceDomains: ["STRATEGIC", "OPERATIONAL", "CONTRACT", "RISK", "COMMERCIAL"], prioritySignals: ["customer", "retention", "expansion", "adoption", "renewal"],
    preferredInsights: ["expansion_signal", "retention_signal", "customer_value"], preferredRisks: ["retention", "adoption"],
    preferredAlerts: ["renewal_attention", "value_gap"], preferredRecommendations: ["customer_follow_up"],
    preferredActions: ["review_customer", "validate_expansion"], preferredMetrics: ["customer_opportunities"],
    preferredContractSections: DEFAULT_SECTION_ORDER, preferredAiContext: ["customer value", "adoption", "retention", "expansion"],
    summaryPrompt: "Which customer expansion or retention signal needs attention?", alertPrefix: "Customer signal", actionPrefix: "Customer success action",
  }),
});

const DOMAIN_KEYWORDS = Object.freeze({
  FINANCIAL: ["financial", "amount", "rent", "payment", "reserve", "price", "cost", "currency", "deposit", "fee"],
  LEGAL: ["legal", "liability", "indemn", "terminat", "default", "governing law", "jurisdiction", "notice"],
  OPERATIONAL: ["operational", "availability", "continuity", "return", "redelivery", "delivery", "ground"],
  COMPLIANCE: ["compliance", "insurance", "certificate", "regulatory", "airworthiness"],
  SUPPLIER: ["supplier", "vendor", "service provider", "counterparty"],
  AIRCRAFT: ["aircraft", "engine", "fleet", "airframe"],
  MAINTENANCE: ["maintenance", "repair", "shop visit", "records", "life limited"],
  DEADLINES: ["deadline", "date", "days", "notice period", "expiry", "expiration", "renewal"],
  RISK: ["risk", "exposure", "breach", "failure", "critical", "high"],
  COMMERCIAL: ["commercial", "pricing", "renewal", "negotiat", "supplier"],
  STRATEGIC: ["strategic", "continuity", "material", "fleet", "critical"],
  CONTRACT: ["contract", "clause", "obligation", "agreement", "term"],
});

function textOf(item) {
  return [item.title, item.description, item.rationale, item.consequence, item.risk_category,
    item.risk_type, item.obligation_type, item.timing_expression, item.action, item.reason,
    item.suggestedOwner, item.category].filter(Boolean).join(" ").toLowerCase();
}

export function classifyIntelligenceDomains(item) {
  const text = textOf(item);
  const domains = INTELLIGENCE_DOMAINS.filter((domain) => DOMAIN_KEYWORDS[domain].some((keyword) => text.includes(keyword)));
  return domains.length ? domains : ["CONTRACT"];
}

export function getRoleIntelligenceProfile(profileId) {
  const normalized = String(profileId || "").trim().toUpperCase();
  return PROFILES[normalized] || PROFILES.DEFAULT;
}

export function resolveUserIntelligenceContext({
  userId = null,
  organizationId = null,
  organizationRole = null,
  platformRoles = [],
  permissions = [],
  rbiProfileId = null,
} = {}) {
  const inferredProfile = rbiProfileId
    || (platformRoles.includes("SUPERADMIN") && !organizationId ? "OPERION_INTERNAL" : null)
    || (["CONTRACT_MANAGER", "ANALYST", "VIEWER"].includes(String(organizationRole || "").toUpperCase()) ? organizationRole : null);
  const rbiProfile = getRoleIntelligenceProfile(inferredProfile);
  return Object.freeze({
    userId,
    organizationId,
    platformRoles: Object.freeze([...platformRoles]),
    organizationRole,
    permissions: Object.freeze([...permissions]),
    rbiProfile,
  });
}

function severityScore(item) {
  return ({ critical: 40, high: 30, medium: 20, low: 10 })[String(item.severity || item.priority || "").toLowerCase()] || 0;
}

function prioritize(items, rbiProfile, kind) {
  return items.map((item, index) => {
    const domains = classifyIntelligenceDomains(item);
    const domainScore = domains.reduce((score, domain) => {
      const position = rbiProfile.intelligenceDomains.indexOf(domain);
      return score + (position < 0 ? 0 : (rbiProfile.intelligenceDomains.length - position) * 5);
    }, 0);
    const signalScore = rbiProfile.prioritySignals.filter((signal) => textOf(item).includes(signal.replaceAll("_", " "))).length * 4;
    return {
      item,
      index,
      score: severityScore(item) + domainScore + signalScore,
      domains,
      kind,
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item, score, domains }) => ({
      ...item,
      rbi: {
        profileId: rbiProfile.roleId,
        relevanceScore: score,
        domains,
        whyRelevant: `${domains.join(", ").toLowerCase()} intelligence aligned with ${rbiProfile.roleName} priorities`,
      },
    }));
}

function roleRecommendation(item, rbiProfile) {
  return {
    ...item,
    rolePresentation: {
      profileId: rbiProfile.roleId,
      headline: `${rbiProfile.actionPrefix}: ${item.title || "Evidence-backed contract action"}`,
      action: item.action,
    },
  };
}

function buildAlerts(risks, deadlines, rbiProfile) {
  const riskAlerts = risks.filter((item) => ["critical", "high"].includes(String(item.severity).toLowerCase())).slice(0, 5)
    .map((item) => ({ id: `risk:${item.id}`, sourceType: "risk", sourceId: item.id, severity: item.severity, title: item.title, evidence: item.evidence || [] }));
  const deadlineAlerts = deadlines.slice(0, 5).map((item) => ({
    id: `deadline:${item.id}`, sourceType: "deadline", sourceId: item.id, severity: item.status === "overdue" ? "critical" : "medium",
    title: item.timing_expression || item.original_expression || "Contract deadline", evidence: item.evidence || [],
  }));
  return prioritize([...riskAlerts, ...deadlineAlerts], rbiProfile, "alert").map((item) => ({
    ...item,
    rolePresentation: { profileId: rbiProfile.roleId, headline: `${rbiProfile.alertPrefix}: ${item.title}` },
  }));
}

export function buildRoleBasedIntelligence({
  context,
  risks = [],
  obligations = [],
  deadlines = [],
  recommendations = [],
  financialImpact = null,
} = {}) {
  const rbiProfile = context?.rbiProfile || PROFILES.DEFAULT;
  const prioritizedRisks = prioritize(risks, rbiProfile, "risk");
  const prioritizedObligations = prioritize(obligations, rbiProfile, "obligation");
  const prioritizedDeadlines = prioritize(deadlines, rbiProfile, "deadline");
  const prioritizedRecommendations = prioritize(recommendations, rbiProfile, "recommendation").map((item) => roleRecommendation(item, rbiProfile));
  const topFinding = prioritizedRisks[0] || prioritizedObligations[0] || prioritizedDeadlines[0] || null;

  return {
    profile: rbiProfile,
    summary: {
      question: rbiProfile.summaryPrompt,
      headline: topFinding?.title || topFinding?.description || topFinding?.timing_expression || "No evidence-backed priority established.",
      sourceFinding: topFinding ? { id: topFinding.id || null, evidence: topFinding.evidence || [] } : null,
    },
    risks: prioritizedRisks,
    obligations: prioritizedObligations,
    deadlines: prioritizedDeadlines,
    recommendations: prioritizedRecommendations,
    alerts: buildAlerts(prioritizedRisks, prioritizedDeadlines, rbiProfile),
    financialImpact,
    sectionOrder: [...rbiProfile.preferredContractSections],
    authorization: {
      organizationId: context?.organizationId || null,
      organizationRole: context?.organizationRole || null,
      permissions: [...(context?.permissions || [])],
      note: "RBI prioritizes only intelligence returned after RBAC authorization.",
    },
  };
}

export { PROFILES as ROLE_INTELLIGENCE_PROFILES };