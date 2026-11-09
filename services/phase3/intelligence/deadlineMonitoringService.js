const APPROACHING_WINDOW_DAYS = 30;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value) {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function utcDayNumber(value) {
  return Date.parse(`${value}T00:00:00.000Z`) / 86_400_000;
}

export function deriveDeadlineMonitoring(deadline, { asOf = new Date() } = {}) {
  const asOfDate = typeof asOf === "string" ? asOf : asOf.toISOString().slice(0, 10);
  if (!isValidDateOnly(asOfDate)) {
    throw new TypeError("asOf must be a valid UTC date or YYYY-MM-DD string");
  }

  const monitoring = {
    status: "not_established",
    daysRemaining: null,
    asOf: asOfDate,
    reviewRequired: deadline.review_status !== "verified",
  };

  if (deadline.review_status === "rejected") {
    monitoring.status = "excluded";
    return monitoring;
  }
  if (deadline.condition?.trim()) {
    monitoring.status = "awaiting_condition";
    return monitoring;
  }
  if (!deadline.absolute_date) {
    monitoring.status = deadline.trigger_expression || deadline.anchor_reference
      ? "awaiting_trigger"
      : deadline.computability === "ambiguous" || deadline.computability === "non_computable"
        ? "unresolved"
        : "not_established";
    return monitoring;
  }
  if (
    !isValidDateOnly(deadline.absolute_date)
    || deadline.status !== "calculated"
    || !["absolute", "calculable"].includes(deadline.computability)
  ) {
    monitoring.status = "unverified_date";
    return monitoring;
  }

  const daysRemaining = utcDayNumber(deadline.absolute_date) - utcDayNumber(asOfDate);
  monitoring.daysRemaining = daysRemaining;
  monitoring.status = daysRemaining < 0
    ? "passed"
    : daysRemaining === 0
      ? "due_today"
      : daysRemaining <= APPROACHING_WINDOW_DAYS
        ? "approaching"
        : "scheduled";
  return monitoring;
}

export function monitorDeadlines(deadlines, options) {
  return deadlines.map((deadline) => ({
    ...deadline,
    monitoring: deriveDeadlineMonitoring(deadline, options),
  }));
}
