import { monitorDeadlines } from "./deadlineMonitoringService.js";

const RECOMMENDATIONS = Object.freeze({
  automatic_renewal: "Review the notice window and record the authorized renewal or non-renewal decision before the contractual date.",
  ambiguous_deadline: "Have the contract owner review the cited timing language and record the confirmed interpretation.",
  broad_indemnity: "Review the cited indemnity scope and allocation with the authorized commercial and legal stakeholders.",
  cure_period_exposure: "Record the trigger date, responsible owner, and any cure-period actions with supporting evidence.",
  information_dependency: "Obtain and review the referenced schedule or annex before relying on this provision.",
  insurance_compliance_exposure: "Compare current insurance certificates and renewal evidence with the cited coverage and insured-party requirements.",
  missed_deadline_exposure: "Confirm the relevant trigger and responsible owner, then record completion evidence for the contractual deadline.",
  penalty_exposure: "Verify the stated trigger, amount, and applicable payment controls against the cited clause.",
  redelivery_condition_exposure: "Assign an operational owner and track each cited technical and records requirement against source evidence.",
  renewal_pricing_uncertainty: "Confirm the extension decision timeline and seek an authorized pricing agreement before relying on the option.",
  reserve_exposure: "Validate the usage basis and reimbursement records before estimating maintenance-reserve cash exposure.",
  short_notice_period: "Record the contractual trigger, calculate the applicable period, and confirm the responsible owner.",
  uncapped_liability: "Review the cited liability scope and any cap exceptions with the authorized commercial and legal stakeholders.",
});

export function recommendRiskAction(riskType) {
  return Object.hasOwn(RECOMMENDATIONS, riskType)
    ? RECOMMENDATIONS[riskType]
    : "Review the cited contractual evidence, confirm the applicable trigger and owner, and document the follow-up.";
}

function deadlineRiskDetails(deadline, monitoring) {
  switch (monitoring.status) {
    case "passed":
      return {
        risk_type: "overdue_deadline_exposure",
        title: "Contractual deadline date has passed",
        severity: monitoring.reviewRequired ? "low" : "medium",
        description: `The extracted contractual date ${deadline.absolute_date} is in the past; the available date alone does not establish whether the action was completed.`,
        rationale: "A passed contractual date warrants checking completion and evidence. This finding does not conclude that a breach occurred.",
        recommended_action: "Confirm whether the contractual action was completed by the extracted date and retain supporting evidence; do not infer breach from the date alone.",
      };
    case "due_today":
      return {
        risk_type: "upcoming_deadline_exposure",
        title: "Contractual deadline date is today",
        severity: monitoring.reviewRequired ? "low" : "medium",
        description: `The extracted contractual date ${deadline.absolute_date} is today; performance is not established by the date alone.`,
        rationale: "A date due today may require operational coordination. The available record does not establish completion or non-compliance.",
        recommended_action: "Confirm the responsible owner and whether the contractual action is due today; record supporting completion evidence.",
      };
    case "approaching":
      return {
        risk_type: "upcoming_deadline_exposure",
        title: "Contractual deadline is approaching",
        severity: monitoring.reviewRequired ? "low" : "medium",
        description: `The extracted contractual date ${deadline.absolute_date} is ${monitoring.daysRemaining} days away.`,
        rationale: "The date falls within the 30-calendar-day planning window. This is a timing alert, not a conclusion that an obligation will be missed.",
        recommended_action: "Confirm the responsible owner, check the cited contractual action, and record the plan and supporting evidence before the date.",
      };
    case "awaiting_condition":
      return {
        risk_type: "conditional_deadline_exposure",
        title: "Contractual timing depends on an unconfirmed condition",
        severity: "low",
        description: `The contractual timing is conditional on: ${deadline.condition}`,
        rationale: "The stored deadline depends on a condition whose occurrence is not established in the available contract intelligence.",
        recommended_action: "Confirm whether the stated condition has occurred using authorized evidence before calculating or acting on a dependent date.",
      };
    case "awaiting_trigger":
    case "unresolved":
    case "unverified_date":
      return {
        risk_type: "unresolved_lifecycle_requirement",
        title: "Contractual timing requires confirmation",
        severity: "low",
        description: deadline.absolute_date
          ? `The extracted date ${deadline.absolute_date} has not been established as a calculated contractual date.`
          : deadline.timing_expression || "The stored contractual timing has no established calendar date.",
        rationale: "The deadline is unresolved or unverified. No calendar status or missed obligation is inferred.",
        recommended_action: "Verify the cited timing against its source clause and establish any required trigger or anchor from authorized evidence before scheduling action.",
      };
    default:
      return null;
  }
}

function deadlineRecommendation(deadline, details, status) {
  const expression = `${deadline.deadline_type || ""} ${deadline.timing_expression || ""} ${deadline.anchor_reference || ""}`
    .replaceAll("_", " ")
    .toLowerCase();
  if (status === "passed") {
    if (/\b(expir|renew|extension|option|notice)\b/.test(expression)) {
      return "Confirm whether the lease extension or notice decision was completed by the extracted date and retain supporting evidence; the date alone does not establish that an option was missed.";
    }
    return details.recommended_action;
  }
  if (!["due_today", "approaching"].includes(status)) return details.recommended_action;
  if (/\b(redeliver|redelivery|return of aircraft)\b/.test(expression)) {
    return "Confirm the aircraft redelivery workstream owner and track the cited technical, maintenance, and records requirements before the contractual date.";
  }
  if (/\b(insurance|certificate of insurance|coverage)\b/.test(expression)) {
    return "Obtain current insurance certificates and compare coverage, insured parties, and renewal evidence with the cited contractual requirements before the date.";
  }
  if (/\b(payment|rent|invoice|reserve)\b/.test(expression)) {
    return "Confirm the payment owner, amount and contractual basis against the cited clause, then record payment evidence by the extracted date.";
  }
  if (/\b(expir|renew|extension|option|notice)\b/.test(expression)) {
    return "Review the aircraft lease expiry and any extension or notice decision, confirm the authorized owner, and record the decision before the contractual date.";
  }
  if (/\b(maintenance|inspection|technical records)\b/.test(expression)) {
    return "Confirm the responsible maintenance owner and track the cited technical or records requirement against source evidence before the date.";
  }
  return details.recommended_action;
}

export function deriveDeadlineRiskFindings({
  deadlines = [],
  obligations = [],
  existingRisks = [],
  asOf,
}) {
  const obligationById = new Map(obligations.map((obligation) => [obligation.id, obligation]));
  const monitoredDeadlines = monitorDeadlines(deadlines, { asOf });
  const activeRisks = existingRisks.map((risk) => ({ ...risk }));
  const risksByDeadlineId = new Map();

  for (const risk of activeRisks) {
    for (const deadlineId of risk.affected_deadline_ids || []) {
      if (!risksByDeadlineId.has(deadlineId)) risksByDeadlineId.set(deadlineId, []);
      risksByDeadlineId.get(deadlineId).push(risk);
    }
  }

  const derivedRisks = [];
  for (const deadline of monitoredDeadlines) {
    if (!deadline.source_evidence_id) continue;
    const details = deadlineRiskDetails(deadline, deadline.monitoring);
    if (!details) continue;

    const recommendation = deadlineRecommendation(deadline, details, deadline.monitoring.status)
      || recommendRiskAction(details.risk_type);
    const linkedRisks = risksByDeadlineId.get(deadline.id);
    if (linkedRisks?.length) {
      for (const linkedRisk of linkedRisks) {
        linkedRisk.deadline_monitoring = deadline.monitoring;
        linkedRisk.recommended_action ||= recommendation;
      }
      continue;
    }

    const obligation = obligationById.get(deadline.obligation_id);
    derivedRisks.push({
      id: `derived-deadline-${deadline.id}`,
      risk_category: "timing",
      ...details,
      recommended_action: recommendation,
      confidence: Number.isFinite(Number(deadline.confidence)) ? Number(deadline.confidence) : 0,
      probability: null,
      status: "requires_review",
      review_status: "requires_review",
      source_type: "multiple",
      source_evidence_id: deadline.source_evidence_id,
      source_references: [
        ...(deadline.source_clause_id ? [{ source_type: "clause", source_id: deadline.source_clause_id }] : []),
        ...(obligation ? [{ source_type: "obligation", source_id: obligation.id }] : []),
        { source_type: "deadline", source_id: deadline.id },
      ],
      affected_obligation_ids: obligation ? [obligation.id] : [],
      affected_deadline_ids: [deadline.id],
      condition: deadline.condition || deadline.trigger_expression || null,
      deadline_monitoring: deadline.monitoring,
      derived: true,
      financial_exposure: null,
      consequence: obligation?.consequence || null,
      rationale: `${details.rationale} Date monitoring does not establish performance, notice delivery, breach, or exercise of an option.`,
      metadata: {
        deterministic: true,
        read_time_derived: true,
        date_basis: deadline.absolute_date || null,
      },
    });
  }

  return [...activeRisks, ...derivedRisks];
}
