import assert from "node:assert/strict";
import test from "node:test";

import {
  BusinessCalendar,
  calculateDeadline,
  parseTemporalExpression,
} from "../services/phase3/intelligence/deadlineIntelligenceService.js";

test("absolute dates preserve source and ambiguous numeric dates are not guessed", () => {
  const explicit = parseTemporalExpression("Payment is due on 15 March 2027.");
  assert.equal(explicit.deadline_type, "absolute");
  assert.equal(explicit.absolute_date, "2027-03-15");
  assert.equal(explicit.timing_expression, "15 March 2027");

  const ambiguous = parseTemporalExpression("Payment is due on 03/04/2027.");
  assert.equal(ambiguous.deadline_type, "ambiguous");
  assert.equal(ambiguous.absolute_date, null);
});

test("relative business-day expressions preserve amount, calendar and anchor", () => {
  const result = parseTemporalExpression("within five Business Days after becoming aware of material damage");
  assert.equal(result.deadline_type, "relative");
  assert.equal(result.amount, 5);
  assert.equal(result.unit, "business_days");
  assert.equal(result.calendar_type, "business");
  assert.equal(result.direction, "after");
  assert.equal(result.anchor_reference, "awareness of material damage");
  assert.equal(result.absolute_date, null);
  assert.equal(result.status, "awaiting_trigger");
});

test("relative units and directions support weeks, months, years and before", () => {
  assert.equal(parseTemporalExpression("2 weeks after delivery").unit, "weeks");
  assert.equal(parseTemporalExpression("3 months following acceptance").unit, "months");
  assert.equal(parseTemporalExpression("one year from execution").unit, "years");
  assert.equal(parseTemporalExpression("10 days prior to redelivery").direction, "before");
});

test("explicit notice periods take precedence over term durations", () => {
  const mixed = parseTemporalExpression("The Lessee may extend the Term for 12 months by giving the Lessor not less than 180 days' written notice before the Expiration Date.");
  assert.equal(mixed.amount, 180);
  assert.equal(mixed.unit, "days");
  assert.equal(mixed.direction, "before");
  assert.equal(mixed.anchor_reference, "expiration date");
  assert.equal(mixed.status, "awaiting_trigger");
  assert.match(mixed.timing_expression, /180 days' written notice/i);
  assert.doesNotMatch(mixed.timing_expression, /12 months/i);

  const termOnly = parseTemporalExpression("The extension lasts for 12 months.");
  assert.equal(termOnly.amount, 12);
  assert.equal(termOnly.unit, "months");

  const noticeOnly = parseTemporalExpression("The Lessee shall give 90 days' notice before the Expiration Date.");
  assert.equal(noticeOnly.amount, 90);
  assert.equal(noticeOnly.unit, "days");
  assert.equal(noticeOnly.anchor_reference, "expiration date");
});

test("recurring aviation timing stores rules without generating occurrences", () => {
  for (const [text, frequency] of [
    ["Rent shall be paid monthly.", "monthly"],
    ["Reports are due quarterly.", "quarterly"],
    ["Insurance certificates shall be provided annually.", "annually"],
    ["Reserves accrue per flight hour.", "per_flight_hour"],
    ["Charges accrue per flight cycle.", "per_flight_cycle"],
  ]) {
    const result = parseTemporalExpression(text);
    assert.equal(result.deadline_type, "recurring");
    assert.equal(result.recurrence.frequency, frequency);
    assert.equal(result.absolute_date, null);
  }
  const businessDay = parseTemporalExpression("The Lessee shall pay Rent on the first Business Day of each month.");
  assert.deepEqual(businessDay.recurrence, { frequency: "monthly", ordinal: "first", calendar_type: "business" });
  assert.equal(businessDay.calendar_type, "business");
});

test("event-based and aviation-specific anchors remain awaiting triggers", () => {
  for (const text of ["Upon termination", "before redelivery", "following a C-check", "after regulatory action"]) {
    const result = parseTemporalExpression(text);
    assert.equal(result.deadline_type, "event_based");
    assert.equal(result.status, "awaiting_trigger");
    assert.equal(result.absolute_date, null);
  }
});

test("Expiration Date uses the existing unresolved named-event representation", () => {
  const onExpiration = parseTemporalExpression("The Lessee shall return the Aircraft on the Expiration Date.");
  assert.equal(onExpiration.deadline_type, "event_based");
  assert.equal(onExpiration.timing_expression, "on the Expiration Date");
  assert.equal(onExpiration.anchor_reference, "expiration date");
  assert.equal(onExpiration.trigger_expression, "expiration date");
  assert.equal(onExpiration.direction, "upon");
  assert.equal(onExpiration.computability, "relative_event");
  assert.equal(onExpiration.status, "awaiting_trigger");
  assert.equal(onExpiration.absolute_date, null);

  const priorToExpiration = parseTemporalExpression("The Lessee shall provide notice prior to the Expiration Date.");
  assert.equal(priorToExpiration.anchor_reference, "expiration date");
  assert.equal(priorToExpiration.direction, "before");

  for (const text of ["throughout the Term", "during the extension"]) {
    assert.equal(parseTemporalExpression(text).deadline_type, "non_computable");
  }
  const unrelatedExpiration = parseTemporalExpression("The report describes component expiration procedures.");
  assert.equal(unrelatedExpiration.deadline_type, "non_computable");
  assert.equal(unrelatedExpiration.anchor_reference, undefined);
});

test("explicit service failure timing uses the existing event representation", () => {
  for (const text of [
    "following a service failure",
    "following the service failure",
    "after the service failure",
  ]) {
    const result = parseTemporalExpression(text);
    assert.equal(result.deadline_type, "event_based");
    assert.equal(result.anchor_reference, "service failure");
    assert.equal(result.trigger_expression, "service failure");
    assert.equal(result.direction, "after");
    assert.equal(result.computability, "relative_event");
    assert.equal(result.status, "awaiting_trigger");
    assert.equal(result.absolute_date, null);
  }

  assert.equal(parseTemporalExpression("The agreement addresses service failure responsibilities."), null);
  assert.equal(parseTemporalExpression("The service provider reports failures."), null);
});

test("conditions remain separate from their attached deadline", () => {
  const result = parseTemporalExpression("If the Aircraft remains grounded for more than 30 days, the Lessee shall notify the Lessor within 5 days.");
  assert.equal(result.deadline_type, "conditional");
  assert.match(result.condition, /grounded for more than 30 days/i);
  assert.equal(result.amount, 5);
  assert.equal(result.trigger_expression, "condition becoming true");
});

test("ambiguous legal timing never becomes a numeric deadline", () => {
  for (const text of ["promptly", "immediately", "as soon as reasonably practicable"]) {
    const result = parseTemporalExpression(text);
    assert.equal(result.deadline_type, "ambiguous");
    assert.equal(result.computability, "ambiguous");
    assert.equal(result.absolute_date, null);
    assert.equal(result.amount, undefined);
  }
});

test("calendar calculation is auditable and refuses unavailable business calendars", () => {
  assert.deepEqual(
    calculateDeadline({ anchorDate: "2026-09-01", amount: 30, unit: "days" }),
    { date: "2026-10-01", method: "utc_calendar_arithmetic" }
  );
  assert.equal(
    calculateDeadline({ anchorDate: "2026-09-01", amount: 5, unit: "business_days" }).date,
    null
  );
  const calendar = new BusinessCalendar();
  assert.equal(
    calculateDeadline({ anchorDate: "2026-09-04", amount: 1, unit: "business_days", businessCalendar: calendar }).date,
    "2026-09-07"
  );
});

test("known effective-date anchors calculate while retaining the calculation basis", () => {
  const result = parseTemporalExpression("Within 30 days after the Effective Date.", { anchorDate: "2026-09-01" });
  assert.equal(result.absolute_date, "2026-10-01");
  assert.equal(result.status, "calculated");
  assert.equal(result.calculation.anchor_date, "2026-09-01");
  assert.equal(result.calculation.result, "2026-10-01");
});