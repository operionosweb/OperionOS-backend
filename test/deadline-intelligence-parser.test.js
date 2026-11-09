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

test("ISO dates and invalid numeric dates retain their actual computability", () => {
  assert.equal(parseTemporalExpression("Pay by 2028-02-29.").absolute_date, "2028-02-29");
  for (const expression of ["Pay by 2027-02-29.", "Pay by 31/02/2027.", "Pay by 2026-13-01."]) {
    const result = parseTemporalExpression(expression);
    assert.equal(result.absolute_date, null);
    assert.equal(result.computability, "ambiguous");
    assert.match(result.ambiguity, /Invalid calendar date/);
  }
});

test("dates inside relative notice anchors are not fabricated as notice due dates", () => {
  const result = parseTemporalExpression("Give 90 days' written notice before 15 March 2027.");
  assert.equal(result.deadline_type, "relative");
  assert.equal(result.amount, 90);
  assert.equal(result.direction, "before");
  assert.equal(result.anchor_reference, "15 march 2027");
  assert.equal(result.absolute_date, null);
  assert.equal(result.status, "awaiting_trigger");
  assert.match(result.timing_expression, /90 days' written notice before 15 March 2027/);
  const ambiguous = parseTemporalExpression("The period is 12 months; payment is due 15 March 2027.");
  assert.equal(ambiguous.computability, "ambiguous");
  assert.equal(ambiguous.absolute_date, null);
});

test("calculation refuses invalid anchors, lossy time arithmetic and unstated month-end conventions", () => {
  for (const anchorDate of ["not-a-date", "2027-02-29", "2027-13-01"]) {
    assert.match(calculateDeadline({ anchorDate, amount: 5, unit: "days" }).reason, /valid ISO/);
  }
  for (const amount of [-1, 0.5, NaN, Infinity]) {
    assert.equal(calculateDeadline({ anchorDate: "2027-01-01", amount, unit: "days" }).date, null);
  }
  assert.equal(calculateDeadline({ anchorDate: "2027-01-01", amount: 3, unit: "hours" }).date, null);
  assert.match(calculateDeadline({ anchorDate: "2027-01-31", amount: 1, unit: "months" }).reason, /contractual date convention/);
  assert.match(calculateDeadline({ anchorDate: "2028-02-29", amount: 1, unit: "years" }).reason, /contractual date convention/);
  assert.equal(calculateDeadline({ anchorDate: "2027-01-15", amount: 1, unit: "months" }).date, "2027-02-15");
  assert.match(calculateDeadline({ anchorDate: "9999-12-31", amount: 1, unit: "days" }).reason, /four-digit calendar range/);
  assert.match(calculateDeadline({ anchorDate: "2027-01-15", amount: Number.MAX_SAFE_INTEGER, unit: "years" }).reason, /supported calendar range/);
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

test("calendar-day and unqualified day expressions retain deterministic calendar arithmetic", () => {
  const calendarDays = parseTemporalExpression(
    "The Lessee shall give notice within 10 calendar days after the Expiration Date.",
    { anchorDate: "2031-12-31" }
  );
  assert.equal(calendarDays.calendar_type, "calendar");
  assert.equal(calendarDays.absolute_date, "2032-01-10");
  assert.equal(calendarDays.status, "calculated");

  const unspecifiedDays = parseTemporalExpression(
    "The Lessee shall give notice within 10 days after the Expiration Date.",
    { anchorDate: "2031-12-31" }
  );
  assert.equal(unspecifiedDays.calendar_type, "calendar");
  assert.equal(unspecifiedDays.absolute_date, "2032-01-10");
  assert.equal(unspecifiedDays.status, "calculated");
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

  const fifthBusinessDay = parseTemporalExpression("The Lessee shall pay rent on the fifth business day of each month.");
  assert.deepEqual(fifthBusinessDay.recurrence, { frequency: "monthly", ordinal: "fifth", calendar_type: "business" });
  assert.match(fifthBusinessDay.timing_expression, /fifth business day/i);
  assert.equal(fifthBusinessDay.absolute_date, null);
});

test("event-based and aviation-specific anchors remain awaiting triggers", () => {
  for (const text of ["Upon termination", "before redelivery", "following a C-check", "after regulatory action", "on the Delivery Date"]) {
    const result = parseTemporalExpression(text);
    assert.equal(result.deadline_type, "event_based");
    assert.equal(result.status, "awaiting_trigger");
    assert.equal(result.absolute_date, null);
  }
});

test("a defined delivery date is only calculated when its source date is supplied", () => {
  const unresolved = parseTemporalExpression("The Lessor shall deliver the Aircraft on the Delivery Date.");
  assert.equal(unresolved.deadline_type, "event_based");
  assert.equal(unresolved.absolute_date, null);

  const resolved = parseTemporalExpression("The Lessor shall deliver the Aircraft on the Delivery Date.", { anchorDate: "2027-06-15" });
  assert.equal(resolved.deadline_type, "absolute");
  assert.equal(resolved.absolute_date, "2027-06-15");
  assert.equal(resolved.status, "calculated");
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
    assert.equal(parseTemporalExpression(text), null);
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