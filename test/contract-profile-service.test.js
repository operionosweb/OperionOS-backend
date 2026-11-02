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

function profileFor(text) {
  return buildContractProfile({ clauses: segmentDeterministicClauses(source(text)) });
}

test("invalid ISO metadata dates are not accepted as contractual calendar facts", () => {
  const profile = profileFor("AIRCRAFT LEASE AGREEMENT\n1. Dates\nEffective Date: 2027-02-29\nExpiration Date: 2030-13-01");
  assert.equal(profile.metadata.effectiveDate, null);
  assert.equal(profile.metadata.expirationDate, null);
});

test("synthetic aviation lease produces evidence-grounded metadata and classification", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "synthetic-aircraft-lease.txt"), "utf8");
  const clauses = segmentDeterministicClauses(source(text));
  const profile = buildContractProfile({ clauses });

  assert.equal(profile.metadata.name, "SYNTHETIC AIRCRAFT LEASE AGREEMENT");
  assert.equal(profile.metadata.contractNumber, "SYN-LEASE-2026-001");
  assert.equal(profile.metadata.contractType, "AIRCRAFT_LEASE");
  assert.equal(profile.classification.status, "confirmed");
  assert.equal(profile.classification.confidence, 1);
  assert.ok(profile.classification.evidence.some((item) => /^aircraft lease$/i.test(item.evidenceText)));
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

test("MRO fixture is classified from explicit MRO evidence rather than incidental redelivery language", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "aviation-acceptance", "mro-agreement.txt"), "utf8");
  const profile = profileFor(text);

  assert.equal(profile.classification.type, "MRO");
  assert.equal(profile.classification.status, "confirmed");
  assert.ok(profile.classification.evidence.some((item) => item.evidenceText === "mro agreement"));
  assert.equal(profile.metadata.leaseIntelligence, null);
  assert.ok(profile.summary.unusualOrMissingTerms.every(({ field, what }) => (
    !["rent", "redelivery", "maintenanceReserves", "escalation", "security"].includes(field)
      && !/lease/i.test(what)
  )));
  assert.doesNotMatch(profile.summary.executiveSummary, /aircraft lease checklist/i);
});

test("engine maintenance and ground handling use their specific agreement evidence", () => {
  const engineProfile = profileFor(`ENGINE MAINTENANCE AGREEMENT
The provider will complete an engine shop visit and return the serviceable engine.`);
  assert.equal(engineProfile.classification.type, "ENGINE_MAINTENANCE");
  assert.equal(engineProfile.classification.status, "confirmed");

  const groundHandlingProfile = profileFor(`GROUND HANDLING AGREEMENT
The handler will provide ramp services and return the Aircraft to service after redelivery.`);
  assert.equal(groundHandlingProfile.classification.type, "GROUND_HANDLING");
  assert.equal(groundHandlingProfile.classification.status, "confirmed");
});

test("generic redelivery evidence remains uncertain and does not trigger lease-only profile content", () => {
  const clauses = segmentDeterministicClauses(source(`The Aircraft shall be returned in airworthy condition after redelivery.`));
  const profile = buildContractProfile({
    clauses,
    risks: [{
      id: "risk-redelivery",
      risk_type: "redelivery_condition_exposure",
      title: "Aircraft redelivery conditions",
      evidence: [{ evidenceId: "evidence-redelivery" }],
    }],
  });

  assert.equal(profile.classification.type, "OTHER");
  assert.equal(profile.classification.status, "requires_review");
  assert.equal(profile.classification.confidence, 0);
  assert.deepEqual(profile.classification.candidates.map(({ type }) => type), ["AIRCRAFT_LEASE"]);
  assert.equal(profile.metadata.leaseIntelligence, null);
  assert.ok(profile.summary.unusualOrMissingTerms.every(({ field }) => !["rent", "redelivery", "maintenanceReserves"].includes(field)));
  assert.ok(profile.summary.unusualOrMissingTerms.every(({ what }) => !/lease/i.test(what)));
  assert.match(profile.summary.executiveSummary, /type requires human review/i);
  assert.ok(profile.recommendations.every((item) => item.suggestedOwner !== "LEASE_RETURN_TECHNICAL"));
  assert.ok(profile.recommendations.every((item) => !/lease return|redelivery compliance plan/i.test(item.action)));
});

test("conflicting agreement types require review and generic roles do not strengthen decisive evidence", () => {
  const tied = profileFor("AIRCRAFT LEASE AGREEMENT\nMRO AGREEMENT");
  assert.equal(tied.classification.type, "OTHER");
  assert.equal(tied.classification.status, "requires_review");
  assert.equal(tied.classification.confidence, 0.5);
  assert.deepEqual(tied.classification.candidates.map(({ type }) => type), ["AIRCRAFT_LEASE", "MRO"]);
  assert.ok(tied.classification.candidates.every((candidate) => candidate.evidence.length > 0));

  const nearTied = profileFor("AIRCRAFT LEASE AGREEMENT\nLESSOR\nMRO AGREEMENT");
  assert.equal(nearTied.classification.type, "OTHER");
  assert.equal(nearTied.classification.status, "requires_review");
  assert.equal(nearTied.classification.confidence, 0.5);
  assert.deepEqual(nearTied.classification.candidates.map(({ type, decisiveScore }) => [type, decisiveScore]), [
    ["AIRCRAFT_LEASE", 1],
    ["MRO", 1],
  ]);
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

test("unconfirmed maintenance recommendations retain evidence and disclaimer without lease ownership", () => {
  const clauses = segmentDeterministicClauses(source("1. MAINTENANCE\nThe Lessee shall maintain the Aircraft."));
  const profile = buildContractProfile({
    clauses,
    risks: [{ id: "risk-1", title: "Maintenance records exposure", evidence: [{ evidenceId: "evidence-1" }] }],
  });

  assert.match(profile.recommendations[0].title, /^Address /);
  assert.equal(profile.classification.status, "requires_review");
  assert.equal(profile.recommendations[0].suggestedOwner, "CONTRACT_OWNER");
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

for (const text of [
  "The lessee will keep the premises clean.",
  "The lessor shall maintain the commercial property.",
  "The tenant must return the premises in good condition.",
  "Monthly rent is payable for the premises.",
  "Redelivery is due on termination.",
  "PROPERTY LEASE AGREEMENT\nThe lessor and lessee agree monthly rent and redelivery of the premises.",
  "The lessee maintains office premises at an aircraft maintenance facility.",
  "The aircraft leaseholder will rent commercial premises.",
]) {
  test(`generic property evidence cannot confirm an aircraft lease: ${text.split("\n")[0]}`, () => {
    const profile = buildContractProfile({
      clauses: segmentDeterministicClauses(source(text)),
      risks: [{ title: "Return and maintenance conditions", risk_type: "redelivery_condition_exposure" }],
    });

    assert.equal(profile.classification.type, "OTHER");
    assert.equal(profile.classification.status, "requires_review");
    assert.equal(profile.metadata.leaseIntelligence, null);
    assert.ok(profile.recommendations.every((item) => item.suggestedOwner !== "LEASE_RETURN_TECHNICAL"));
    // Raw citations can mention aircraft without establishing an aircraft-specific recommendation.
    assert.doesNotMatch(JSON.stringify(profile.recommendations.map(({ evidence, ...interpretation }) => interpretation)), /aircraft|lease return|redelivery compliance plan/i);
    assert.ok(profile.summary.unusualOrMissingTerms.every(({ what }) => !/aircraft|lease|redelivery/i.test(what)));
  });
}

for (const title of ["AIRCRAFT LEASE AGREEMENT", "AIRCRAFT-LEASE AGREEMENT", "LEASE OF THE AIRCRAFT"]) {
  test(`explicit aircraft leasing remains confirmed: ${title}`, () => {
    const profile = profileFor(`${title}\nThe lessee shall return the Aircraft in airworthy condition.`);
    assert.equal(profile.classification.type, "AIRCRAFT_LEASE");
    assert.equal(profile.classification.status, "confirmed");
    assert.ok(profile.metadata.leaseIntelligence);
  });
}

for (const title of [
  "AVIATION HULL INSURANCE AGREEMENT",
  "AIRCRAFT HULL INSURANCE POLICY",
  "AVIATION HULL ALL RISKS INSURANCE CONTRACT",
  "AIRCRAFT HULL-ALL-RISKS POLICY",
]) {
  test(`aviation insurance alias retains corroborated classification: ${title}`, () => {
    const profile = profileFor(`${title}\nThe insured value is USD 5000000.`);
    assert.equal(profile.classification.type, "INSURANCE");
    assert.equal(profile.classification.status, "confirmed");
    assert.equal(profile.metadata.leaseIntelligence, null);
    assert.ok(profile.classification.evidence.some(({ evidenceText }) => /insured value/i.test(evidenceText)));
  });
}

for (const title of [
  "POWER BY THE HOUR AGREEMENT",
  "POWER-BY-THE-HOUR AGREEMENT",
  "POWER-BY-HOUR AGREEMENT",
  "POWER BY HOUR CONTRACT",
  "PBH AGREEMENT",
  "PBH CONTRACT",
]) {
  test(`PBH alias remains confirmed: ${title}`, () => {
    const profile = profileFor(`${title}\nThe flight-hour rate is USD 20.`);
    assert.equal(profile.classification.type, "POWER_BY_HOUR");
    assert.equal(profile.classification.status, "confirmed");
    assert.equal(profile.metadata.leaseIntelligence, null);
  });
}

for (const text of [
  "The insured value is USD 5000000.",
  "MARINE HULL INSURANCE AGREEMENT\nThe insured value is USD 5000000.",
  "AVIATION HULL INSURANCE AGREEMENT",
  "The flight-hour rate is USD 20.",
  "PBH AGREEMENT",
  "XAPBH AGREEMENT\nThe flight-hour rate is USD 20.",
  "AVIATION SUPPLIER AGREEMENT\nThe insured value is USD 5000000 and the flight-hour rate is USD 20.",
]) {
  test(`supporting terms or uncorroborated abbreviations cannot confirm insurance or PBH: ${text.split("\n")[0]}`, () => {
    const profile = profileFor(text);
    assert.ok(!["INSURANCE", "POWER_BY_HOUR"].includes(profile.classification.type));
    if (profile.classification.type === "OTHER") assert.equal(profile.classification.status, "requires_review");
  });
}

test("uncertain rent escalation keeps evidence and neutral wording in both recommendation surfaces", () => {
  const profile = profileFor("Monthly rent shall increase by 2% on each anniversary.");
  assert.equal(profile.classification.status, "requires_review");
  assert.equal(profile.metadata.leaseIntelligence, null);
  const recommendation = profile.recommendations.find(({ title }) => title === "Monitor contractual rent escalation");
  assert.ok(recommendation);
  assert.doesNotMatch(recommendation.reason, /the lease contains/i);
  assert.match(recommendation.reason, /cited text contains an express rent adjustment mechanism/i);
  assert.ok(recommendation.evidence[0].evidenceText);
  assert.deepEqual(profile.metadata.executiveSynthesis.recommendedActions, profile.recommendations);
});

test("confirmed aircraft lease retains its evidence-backed escalation assertion", () => {
  const profile = profileFor("AIRCRAFT LEASE AGREEMENT\nMonthly rent shall increase by 2% on each anniversary.");
  assert.equal(profile.classification.status, "confirmed");
  assert.equal(profile.recommendations.find(({ title }) => title === "Monitor contractual rent escalation").reason,
    "The lease contains an express rent adjustment mechanism.");
});

for (const title of ["AIRCRAFT LEASE AGREEMENT\nMRO AGREEMENT", "GROUND HANDLING AGREEMENT"]) {
  test(`non-lease and conflicting profiles keep escalation wording neutral: ${title.split("\n")[0]}`, () => {
    const profile = profileFor(`${title}\nMonthly rent shall increase by 2% on each anniversary.`);
    assert.equal(profile.metadata.leaseIntelligence, null);
    const recommendation = profile.recommendations.find(({ title }) => title === "Monitor contractual rent escalation");
    assert.equal(recommendation.reason, "The cited text contains an express rent adjustment mechanism.");
    assert.doesNotMatch(JSON.stringify(profile.metadata.executiveSynthesis.recommendedActions), /the lease contains/i);
  });
}