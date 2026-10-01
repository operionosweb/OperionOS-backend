import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildContractProfile } from "../services/phase3/intelligence/contractProfileService.js";
import { segmentDeterministicClauses } from "../services/phase3/intelligence/deterministicClauseService.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const organizationId = "11111111-1111-4111-8111-111111111111";

function source(text) {
  return {
    text,
    organizationId,
    contractId: "22222222-2222-4222-8222-222222222222",
    documentId: "33333333-3333-4333-8333-333333333333",
    documentVersionId: "44444444-4444-4444-8444-444444444444",
    analysisRunId: "55555555-5555-4555-8555-555555555555",
    pageBoundaries: "derived_unavailable",
    sourceLocator: (start, end) => `document:char:${start}-${end}`,
  };
}

test("synthetic aviation lease produces evidence-grounded metadata and classification", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "synthetic-aircraft-lease.txt"), "utf8");
  const clauses = segmentDeterministicClauses(source(text));
  const profile = buildContractProfile({ clauses });

  assert.equal(profile.metadata.name, "SYNTHETIC AIRCRAFT LEASE AGREEMENT");
  assert.equal(profile.metadata.contractNumber, "SYN-LEASE-2026-001");
  assert.equal(profile.metadata.contractType, "AIRCRAFT_LEASE");
  assert.equal(profile.metadata.effectiveDate, "2026-01-01");
  assert.equal(profile.metadata.expirationDate, "2031-12-31");
  assert.equal(profile.metadata.governingLaw, "England and Wales");
  assert.equal(profile.metadata.currency, "USD");
  assert.deepEqual(profile.metadata.parties.map((party) => party.role), ["LESSOR", "LESSEE"]);
  assert.deepEqual(profile.metadata.parties.map((party) => party.name), ["Northstar Aviation Leasing Ltd.", "Example Airways Ltd."]);
  assert.deepEqual(profile.aircraftIdentifiers.map((item) => [item.type, item.value]), [
    ["AIRCRAFT_REGISTRATION", "G-SYN1"],
    ["AIRCRAFT_MSN", "98765"],
    ["ENGINE_IDENTIFIER", "ESN-445566"],
  ]);
  assert.equal(profile.metadata.executionDate, null);
  assert.equal(profile.metadata.commencementDate, "2026-01-15");
  assert.equal(profile.metadata.jurisdiction, "England and Wales");
  assert.equal(profile.asset.manufacturer.value, "Airbus");
  assert.equal(profile.asset.model.value, "A320-214");
  assert.equal(profile.commercialTerms.baseRent.amount, 250000);
  assert.equal(profile.commercialTerms.baseRent.frequency, "monthly");
  assert.equal(profile.commercialTerms.securityDeposit.amount, 750000);
  assert.equal(profile.commercialTerms.maintenanceReserves[0].rate.amount, 300);
  assert.equal(profile.commercialTerms.maintenanceReserves[0].rate.unit, "flight_hour");
  assert.equal(profile.redelivery.returnLocation.value, "London Heathrow Airport");
  assert.ok(profile.redelivery.requirements.some((item) => item.category === "llp"));
  assert.equal(profile.insurance.requirements[0].minimumCoverage.amount, 45000000);
  assert.ok(profile.defaultTermination.events.some((item) => item.type === "payment_default"));
  assert.equal(profile.renewalExtension.options[0].noticePeriod.amount, 180);
  assert.ok(profile.recommendations.every((item) => item.action !== "Review the cited clause and confirm the responsible operational owner."));
  assert.ok(profile.evidenceClaims.every((claim) => claim.evidence));
  assert.ok(profile.summary.executiveSummary.includes("G-SYN1"));
  assert.equal(profile.metadata.executiveSynthesis.contractAtAGlance.keyFinancialCommitment.amount, 250000);
  assert.ok(profile.metadata.executiveSynthesis.recommendedActions.length > 0);
  assert.ok(profile.summary.keyCommercialTerms.every((item) => item.evidence?.evidenceText));
  assert.ok(profile.recommendations.every((item) => item.action && item.reason && item.suggestedOwner && item.priority));
});

test("unsupported metadata remains null and is reported as not established", () => {
  const clauses = segmentDeterministicClauses(source("1. SERVICES\nThe Supplier may provide services upon request."));
  const profile = buildContractProfile({ clauses });

  assert.equal(profile.metadata.contractNumber, null);
  assert.equal(profile.metadata.effectiveDate, null);
  assert.equal(profile.metadata.executionDate, null);
  assert.equal(profile.metadata.commencementDate, null);
  assert.equal(profile.metadata.expirationDate, null);
  assert.equal(profile.metadata.governingLaw, null);
  assert.equal(profile.metadata.currency, null);
  assert.equal(profile.aircraftIdentifiers.length, 0);
  assert.ok(profile.summary.unusualOrMissingTerms.some((item) => item.field === "contractNumber"));
  assert.ok(profile.summary.unusualOrMissingTerms.every((item) => item.whyItMatters && item.recommendedReview));
});

test("recommendations retain potential language, evidence, and legal disclaimer", () => {
  const clauses = segmentDeterministicClauses(source("1. MAINTENANCE\nThe Lessee shall maintain the Aircraft."));
  const profile = buildContractProfile({
    clauses,
    risks: [{ id: "risk-1", title: "Maintenance records exposure", evidence: [{ evidenceId: "evidence-1" }] }],
  });

  assert.match(profile.recommendations[0].title, /^Address /);
  assert.equal(profile.recommendations[0].suggestedOwner, "LEASE_RETURN_TECHNICAL");
  assert.deepEqual(profile.recommendations[0].evidence, [{ evidenceId: "evidence-1" }]);
  assert.match(profile.recommendations[0].disclaimer, /not legal advice/i);
});

test("profiling rejects empty source instead of inventing a contract", () => {
  assert.throws(
    () => buildContractProfile({ clauses: [] }),
    (error) => error.code === "SOURCE_TEXT_UNAVAILABLE"
  );
});

test("party extraction excludes advisors and does not infer unnamed roles", () => {
  const clauses = segmentDeterministicClauses(source(`AIRCRAFT LEASE AGREEMENT
This Agreement is between Alpha Leasing Ltd. (the "Lessor") and Beta Air Ltd. (the "Lessee").
Gamma Law Firm acts as legal advisor. Delta Bank is the financing bank. The Owner shall receive notices.`));
  const profile = buildContractProfile({ clauses });

  assert.deepEqual(profile.metadata.parties.map((party) => party.name), ["Alpha Leasing Ltd.", "Beta Air Ltd."]);
  assert.equal(profile.metadata.parties.some((party) => /Gamma|Delta|Owner/.test(party.name)), false);
});

test("ambiguous commercial language remains unquantified and missing", () => {
  const clauses = segmentDeterministicClauses(source(`AIRCRAFT LEASE AGREEMENT
This Agreement is between Alpha Leasing Ltd. (the "Lessor") and Beta Air Ltd. (the "Lessee").
Rent may be adjusted from time to time. Maintenance contributions may apply under a separate schedule.`));
  const profile = buildContractProfile({ clauses });

  assert.equal(profile.commercialTerms.baseRent, null);
  assert.equal(profile.commercialTerms.rentEscalation, null);
  assert.equal(profile.commercialTerms.maintenanceReserves.length, 0);
  assert.ok(profile.summary.unusualOrMissingTerms.some((item) => item.field === "rent"));
  assert.ok(profile.summary.unusualOrMissingTerms.some((item) => item.field === "maintenanceReserves"));
  assert.doesNotMatch(JSON.stringify(profile), /\b(?:USD|EUR|GBP)\s*\d/);
});

test("aircraft lease profile is deterministic and keeps material findings evidence-linked", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "synthetic-aircraft-lease.txt"), "utf8");
  const clauses = segmentDeterministicClauses(source(text));
  const first = buildContractProfile({ clauses });
  const second = buildContractProfile({ clauses });

  assert.deepEqual(first, second);
  assert.ok(first.redelivery.requirements.every((item) => item.evidence?.evidenceText));
  assert.ok(first.insurance.requirements.every((item) => item.evidence?.evidenceText));
  assert.ok(first.commercialTerms.maintenanceReserves.every((item) => item.evidence?.evidenceText));
});