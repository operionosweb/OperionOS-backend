import assert from "node:assert/strict";
import test from "node:test";

import { deriveDeadlineMonitoring, monitorDeadlines } from "../services/phase3/intelligence/deadlineMonitoringService.js";

const BASE_DEADLINE = Object.freeze({
  absolute_date: "2026-07-01",
  status: "calculated",
  computability: "calculable",
  condition: null,
  review_status: "verified",
});

test("calculated absolute dates are classified on UTC day boundaries", () => {
  assert.deepEqual(deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "2026-07-01" }), {
    status: "due_today",
    daysRemaining: 0,
    asOf: "2026-07-01",
    reviewRequired: false,
  });
  assert.equal(deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "2026-07-02" }).status, "passed");
  assert.equal(deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "2026-06-30" }).daysRemaining, 1);
});

test("approaching window is 30 calendar days and dates beyond it stay scheduled", () => {
  assert.equal(deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "2026-06-01" }).status, "approaching");
  assert.equal(deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "2026-05-31" }).status, "scheduled");
});

test("conditions and unresolved timing are not classified as overdue", () => {
  assert.equal(deriveDeadlineMonitoring({
    ...BASE_DEADLINE,
    condition: "if the aircraft is accepted",
  }, { asOf: "2026-07-02" }).status, "awaiting_condition");

  assert.equal(deriveDeadlineMonitoring({
    ...BASE_DEADLINE,
    absolute_date: null,
    status: "awaiting_trigger",
    computability: "relative_event",
    trigger_expression: "expiration date",
  }, { asOf: "2026-07-02" }).status, "awaiting_trigger");

  assert.equal(deriveDeadlineMonitoring({
    ...BASE_DEADLINE,
    absolute_date: "2026-07-02",
    status: "identified",
  }, { asOf: "2026-07-02" }).status, "unverified_date");
});

test("invalid dates fail closed and rejected dates are excluded", () => {
  assert.equal(deriveDeadlineMonitoring({
    ...BASE_DEADLINE,
    absolute_date: "2026-02-30",
  }, { asOf: "2026-07-01" }).status, "unverified_date");
  assert.equal(deriveDeadlineMonitoring({
    ...BASE_DEADLINE,
    review_status: "rejected",
  }, { asOf: "2026-07-01" }).status, "excluded");
  assert.throws(() => deriveDeadlineMonitoring(BASE_DEADLINE, { asOf: "not-a-date" }), TypeError);
});

test("monitorDeadlines returns derived status without mutating persisted deadline data", () => {
  const deadline = { ...BASE_DEADLINE, id: "deadline-1" };
  const monitored = monitorDeadlines([deadline], { asOf: "2026-06-30" });

  assert.equal(monitored[0].monitoring.daysRemaining, 1);
  assert.equal(deadline.monitoring, undefined);
});
