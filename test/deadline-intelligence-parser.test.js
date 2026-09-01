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