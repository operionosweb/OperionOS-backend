import assert from "node:assert/strict";
import test from "node:test";
import { createDemonstrationAircraft } from "../src/demo/globeIntelligenceData.js";
import { askMattFlight } from "../src/components/matt/mattFlightIntelligence.js";

test("Ask Matt wrapper returns only flight-grounded demo evidence in the shared normalized schema", () => {
  const flight = createDemonstrationAircraft()[0];
  const result = askMattFlight("What contract notice deadline applies?", flight);
  assert.equal(result.established, false);
  assert.equal(result.demonstration, true);
  assert.match(result.answer, /fictional scenario/);
  assert.ok(result.findings.some(({ type, id }) => type === "obligation" && id === flight.intelligence.contract.obligation.id));
  assert.ok(result.evidence.every(({ id, excerpt, source_locator, page_number }) => id && excerpt && source_locator && page_number === null));
  assert.ok(result.limitations.length > 0);
  assert.ok(result.reviewRecommendations.every((recommendation) => Array.isArray(recommendation) && recommendation[1] === null));
});

test("legal questions return conditional route candidates and sources without a legal conclusion", () => {
  const flight = createDemonstrationAircraft()[0];
  const result = askMattFlight("Which passenger laws apply?", flight);
  assert.equal(result.established, false);
  assert.match(result.answer, /conditional legal-scope candidates only/);
  assert.ok(result.findings.some(({ type }) => type === "legal_scope_candidate"));
  assert.ok(result.evidence.some(({ source_locator }) => source_locator.startsWith("https://")));
  assert.match(result.limitations.join(" "), /qualified counsel/);
});

test("unknown exposure remains unknown and missing flight context never falls back to another record", () => {
  const unknownFlight = createDemonstrationAircraft()[2];
  const unknown = askMattFlight("What is the financial exposure?", unknownFlight);
  assert.match(unknown.answer, /Unknown \/ unavailable/);
  assert.equal(unknown.evidence.length, 1);
  const missing = askMattFlight("Explain the contract", null);
  assert.equal(missing.established, false);
  assert.deepEqual(missing.findings, []);
  assert.deepEqual(missing.evidence, []);
});

test("delay hypotheticals do not overwrite flight facts and fuel cost is not inferred from general exposure", () => {
  const flight = createDemonstrationAircraft()[0];
  const delay = askMattFlight("What happens if this flight is delayed three hours?", flight);
  assert.match(delay.answer, /three-hour delay is your hypothetical/);
  assert.match(delay.answer, new RegExp(`${flight.delayMinutes} fictional delay minutes`));
  assert.match(delay.answer, /neither a contractual breach nor liability/);
  const fuel = askMattFlight("What is the extra fuel cost?", flight);
  assert.match(fuel.answer, /not quantified/);
  assert.match(fuel.answer, /cannot be presented as a fuel cost/);
});
