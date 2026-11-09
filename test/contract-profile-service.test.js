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
  assert.equal(profile.metadata.leaseIntelligence.asset.deliveryDate.value, "2026-01-15");
  assert.ok(text.includes(profile.metadata.leaseIntelligence.asset.deliveryDate.evidence.evidenceText));
  assert.equal(profile.metadata.factProvenance.commencementDate.status, "derived");
  assert.equal(profile.metadata.factProvenance.commencementDate.evidence.length, 2);
  assert.match(profile.metadata.factProvenance.commencementDate.evidence[0].evidenceText, /rent shall commence on the Delivery Date/i);
  assert.match(profile.metadata.factProvenance.commencementDate.evidence[1].evidenceText, /Delivery Date: 15 January 2026/i);
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
  assert.equal(profile.commercialTerms.maintenanceReserves[0].paymentFrequency, "monthly");
  assert.match(profile.commercialTerms.maintenanceReserves[0].reimbursementMechanics, /paid invoices and complete shop visit records/i);
  assert.match(profile.commercialTerms.maintenanceReserves[0].endOfLeaseTreatment, /remain with the Lessor at the end of the Term/i);
  for (const evidence of [
    profile.commercialTerms.maintenanceReserves[0].paymentFrequencyEvidence,
    profile.commercialTerms.maintenanceReserves[0].reimbursementEvidence,
    profile.commercialTerms.maintenanceReserves[0].endOfLeaseTreatmentEvidence,
  ]) {
    assert.ok(evidence.evidenceText);
    assert.ok(text.includes(evidence.evidenceText));
  }
  assert.equal(profile.redelivery.returnLocation.value, "London Heathrow Airport");
  assert.ok(profile.redelivery.requirements.some((item) => item.category === "llp"));
  assert.equal(profile.insurance.requirements[0].minimumCoverage.amount, 45000000);
  const liabilityRequirement = profile.insurance.requirements.find((item) => item.category === "liability");
  assert.equal(liabilityRequirement.minimumCoverage, null);
  assert.match(liabilityRequirement.evidence.evidenceText, /aviation liability insurance/i);
  assert.ok(profile.insurance.requirements.some((item) => item.category === "certificate" && /renewal evidence/i.test(item.evidence.evidenceText)));
  assert.ok(profile.defaultTermination.events.some((item) => item.type === "payment_default"));
  assert.ok(profile.defaultTermination.events.every((item) => text.includes(item.evidence.evidenceText)));
  assert.ok(profile.defaultTermination.terminationRights.every((item) => text.includes(item.evidence.evidenceText)));
  assert.ok(profile.defaultTermination.remedies.every((item) => text.includes(item.evidence.evidenceText)));
  assert.equal(profile.renewalExtension.options[0].noticePeriod.amount, 180);
  const extensionRelationship = profile.metadata.leaseIntelligence.lifecycleRelationships[0];
  assert.equal(extensionRelationship.exerciseStatus, "not_established");
  assert.equal(extensionRelationship.noticeDeadline, null);
  assert.equal(extensionRelationship.noticePeriod.calendarType, null);
  assert.match(extensionRelationship.uncertainty, /No matching notice deadline/);
  assert.ok(profile.recommendations.some((item) => item.title === "Review the aircraft lease extension option"));
  assert.ok(profile.recommendations.every((item) => item.action !== "Review the cited clause and confirm the responsible operational owner."));
  assert.ok(profile.evidenceClaims.every((claim) => claim.evidence));
  assert.ok(profile.summary.executiveSummary.includes("G-SYN1"));
  assert.equal(profile.metadata.executiveSynthesis.contractAtAGlance.keyFinancialCommitment.amount, 250000);
  assert.ok(profile.metadata.executiveSynthesis.recommendedActions.length > 0);
  assert.ok(profile.summary.keyCommercialTerms.every((item) => item.evidence?.evidenceText));
  const redeliveryRecommendation = profile.recommendations.find((item) => item.title === "Create a redelivery compliance plan");
  assert.ok(redeliveryRecommendation.evidence.length > 0);
  assert.ok(redeliveryRecommendation.evidence.every((item) => text.includes(item.evidenceText)));
  assert.ok(profile.recommendations.every((item) => item.action && item.reason && item.suggestedOwner && item.priority));
});

test("conflicting aircraft identifiers are preserved for review and withheld from the asset profile", () => {
  const profile = profileFor([
    "AIRCRAFT LEASE AGREEMENT",
    "Aircraft Registration: G-SYN1",
    "Aircraft Registration: G-SYN2",
    "Aircraft MSN: 98765",
    "Aircraft MSN: 98766",
  ].join("\n"));

  assert.deepEqual(profile.aircraftIdentifiers
    .filter((identifier) => identifier.type === "AIRCRAFT_REGISTRATION")
    .map((identifier) => identifier.value), ["G-SYN1", "G-SYN2"]);
  assert.deepEqual(profile.aircraftIdentifiers
    .filter((identifier) => identifier.type === "AIRCRAFT_MSN")
    .map((identifier) => identifier.value), ["98765", "98766"]);
  assert.equal(profile.asset.registration, null);
  assert.equal(profile.asset.serialNumber, null);
  assert.equal(profile.metadata.assetIdentificationReview.status, "requires_review");
  assert.equal(profile.metadata.assetIdentificationReview.conflicts.length, 2);
  assert.deepEqual(
    profile.metadata.assetIdentificationReview.conflicts[0].candidates.map((candidate) => candidate.value),
    ["G-SYN1", "G-SYN2"]
  );
  assert.ok(profile.metadata.assetIdentificationReview.conflicts[0].candidates.every((candidate) => candidate.evidence.evidenceText));
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

test("lease expiry uses term-end evidence and does not infer expiry from a termination date", () => {
  const profile = profileFor(`AIRCRAFT LEASE AGREEMENT
Termination Date: 30 June 2027.
The Lease Term expires on 31 December 2031.`);
  const expirationClaim = profile.evidenceClaims.find((claim) => claim.field === "expirationDate");

  assert.equal(profile.metadata.expirationDate, "2031-12-31");
  assert.equal(expirationClaim.evidence.evidenceText, "Lease Term expires on 31 December 2031");

  const terminationOnlyProfile = profileFor(`AIRCRAFT LEASE AGREEMENT
Termination Date: 30 June 2027.`);
  assert.equal(terminationOnlyProfile.metadata.expirationDate, null);
});

test("conflicting lease expiry dates are withheld and retained as evidence candidates", () => {
  const profile = profileFor(`AIRCRAFT LEASE AGREEMENT
1. TERM
Expiration Date: 31 December 2031.
2. AMENDMENT
Expiry Date: 30 June 2032.`);

  assert.equal(profile.metadata.expirationDate, null);
  assert.equal(profile.metadata.factProvenance.expirationDate.status, "conflicting");
  assert.deepEqual(
    profile.metadata.factProvenance.expirationDate.candidates.map((candidate) => candidate.value),
    ["2031-12-31", "2032-06-30"]
  );
  assert.ok(profile.metadata.factProvenance.expirationDate.evidence.every((evidence) => evidence.evidenceText));
});

test("extension option is linked to its expiry and calculated notice deadline without implying exercise", () => {
  const clauses = segmentDeterministicClauses(source(`AIRCRAFT LEASE AGREEMENT
1. TERM
Expiration Date: 31 December 2031.
2. EXTENSION
The Lessee may extend the Term for 12 months by giving the Lessor 180 calendar days' written notice before the Expiration Date.`));
  const termClause = clauses.find((clause) => /Expiration Date:/i.test(clause.source_text));
  const extensionClause = clauses.find((clause) => /may extend the Term/i.test(clause.source_text));
  const profile = buildContractProfile({
    clauses,
    deadlines: [{
      id: "deadline-extension-notice",
      source_clause_id: extensionClause.id,
      anchor_reference: "expiration date",
      absolute_date: "2031-07-04",
      status: "calculated",
      metadata: {
        calculation: {
          anchor_date: "2031-12-31",
          offset: 180,
          unit: "days",
          direction: "before",
          method: "utc_calendar_arithmetic",
          result: "2031-07-04",
        },
      },
    }],
  });
  const relationship = profile.metadata.leaseIntelligence.lifecycleRelationships[0];
  const recommendation = profile.recommendations.find((item) => item.title === "Review the aircraft lease extension option");

  assert.equal(profile.metadata.expirationDate, "2031-12-31");
  assert.equal(relationship.status, "calculated");
  assert.equal(relationship.noticeDeadline, "2031-07-04");
  assert.equal(relationship.exerciseStatus, "not_established");
  assert.deepEqual(relationship.sourceReferences, [
    { type: "extension_option", clauseId: extensionClause.id },
    { type: "lease_expiry", clauseId: termClause.id },
    { type: "deadline", id: "deadline-extension-notice" },
  ]);
  assert.ok(relationship.evidence.some((item) => /may extend the Term/i.test(item.evidenceText)));
  assert.ok(relationship.evidence.some((item) => /Expiration Date: 31 December 2031/i.test(item.evidenceText)));
  assert.equal(recommendation.triggerDeadline, "2031-07-04");
  assert.match(recommendation.reason, /does not establish that the option has been exercised/i);
  assert.equal(recommendation.evidence.length, 2);
});

test("unqualified extension notice arithmetic stays reviewable and discloses its calendar-day basis", () => {
  const clauses = segmentDeterministicClauses(source(`AIRCRAFT LEASE AGREEMENT
1. TERM
Expiration Date: 31 December 2031.
2. EXTENSION
The Lessee may extend the Term for 12 months by giving the Lessor 180 days' written notice before the Expiration Date.`));
  const extensionClause = clauses.find((clause) => /may extend the Term/i.test(clause.source_text));
  const profile = buildContractProfile({
    clauses,
    deadlines: [{
      source_clause_id: extensionClause.id,
      anchor_reference: "expiration date",
      absolute_date: "2031-07-04",
      status: "calculated",
      metadata: { calculation: { method: "utc_calendar_arithmetic" } },
    }],
  });
  const relationship = profile.metadata.leaseIntelligence.lifecycleRelationships[0];

  assert.equal(relationship.status, "requires_review");
  assert.equal(relationship.noticeDeadline, "2031-07-04");
  assert.match(relationship.uncertainty, /without an explicit calendar-day basis/i);
});

test("multiple engine serial numbers remain distinct evidence-backed identifiers", () => {
  const profile = profileFor(`AIRCRAFT LEASE AGREEMENT
Aircraft MSN: 77881
Engine Serial Number: ESN-001
ESN: ESN-002`);

  assert.deepEqual(
    profile.aircraftIdentifiers.filter((identifier) => identifier.type === "ENGINE_IDENTIFIER").map((identifier) => identifier.value),
    ["ESN-001", "ESN-002"]
  );
  assert.ok(profile.aircraftIdentifiers.filter((identifier) => identifier.type === "ENGINE_IDENTIFIER")
    .every((identifier) => identifier.evidence?.evidenceText));
});

test("unconfirmed maintenance recommendations retain evidence and disclaimer without lease ownership", () => {
  const clauses = segmentDeterministicClauses(source("1. MAINTENANCE\nThe Lessee shall maintain the Aircraft and preserve complete technical records."));
  const clause = clauses.find((item) => item.source_text.includes("preserve complete technical records"));
  const profile = buildContractProfile({
    clauses,
    risks: [{
      id: "risk-1",
      title: "Maintenance records exposure",
      evidence: [{
        clauseId: clause.id,
        evidenceText: "preserve complete technical records",
        confidence: 0.92,
      }],
    }],
  });

  assert.match(profile.recommendations[0].title, /^Address /);
  assert.equal(profile.classification.status, "requires_review");
  assert.equal(profile.recommendations[0].suggestedOwner, "CONTRACT_OWNER");
  assert.equal(profile.recommendations[0].category, "operational_protection");
  assert.equal(profile.recommendations[0].evidence[0].clauseId, clause.id);
  assert.deepEqual(profile.recommendations[0].observedFacts, ["preserve complete technical records"]);
  assert.equal(profile.recommendations[0].evidenceSufficiency, "source_linked_unverified");
  assert.match(profile.recommendations[0].disclaimer, /not legal advice/i);
});

test("MRO and payment recommendations distinguish evidence, interpretation, impact, and missing inputs", () => {
  const clauses = segmentDeterministicClauses(source([
    "MRO AGREEMENT",
    "Provider shall complete each engine shop visit within 60 days after induction.",
    "Customer shall pay the stated maintenance reserve within 30 days of invoice.",
  ].join("\n")));
  const mroClause = clauses.find((item) => item.source_text.includes("complete each engine shop visit"));
  const paymentClause = clauses.find((item) => item.source_text.includes("pay the stated maintenance reserve"));
  const profile = buildContractProfile({
    clauses,
    risks: [
      {
        id: "mro-turnaround",
        title: "MRO turnaround exposure",
        risk_type: "mro_service_level",
        description: "The service-level deadline requires operational monitoring.",
        consequence: "A missed turnaround target may affect aircraft availability.",
        missing_information: ["The induction date has not been verified."],
        condition: "After shop visit induction",
        evidence: [{
          clauseId: mroClause.id,
          evidenceText: "complete each engine shop visit within 60 days",
          confidence: 0.62,
        }],
      },
      {
        id: "reserve-payment",
        title: "Maintenance reserve payment deadline",
        risk_type: "payment_obligation",
        condition: "Within 30 days of invoice",
        evidence: [{
          clauseId: paymentClause.id,
          evidenceText: "pay the stated maintenance reserve within 30 days of invoice",
          confidence: 0.97,
          reviewStatus: "verified",
        }],
      },
      {
        id: "maintenance-deadline",
        title: "Upcoming maintenance evidence deadline",
        condition: "Before the next scheduled shop visit",
        evidence: [{
          clauseId: mroClause.id,
          evidenceText: "complete each engine shop visit within 60 days",
          confidence: 0.91,
        }],
      },
      {
        id: "negotiation-position",
        title: "MRO service-level negotiation",
        recommendation: "Prepare a negotiation position to amend the service-level wording.",
        evidence: [{
          clauseId: mroClause.id,
          evidenceText: "complete each engine shop visit within 60 days",
          confidence: 0.91,
        }],
      },
    ],
  });
  const mroRecommendation = profile.recommendations.find((item) => item.riskId === "mro-turnaround");
  const paymentRecommendation = profile.recommendations.find((item) => item.riskId === "reserve-payment");
  const deadlineRecommendation = profile.recommendations.find((item) => item.riskId === "maintenance-deadline");
  const negotiationRecommendation = profile.recommendations.find((item) => item.riskId === "negotiation-position");

  assert.equal(mroRecommendation.category, "operational_protection");
  assert.equal(mroRecommendation.interpretation, "The service-level deadline requires operational monitoring.");
  assert.equal(mroRecommendation.potentialImpact, "A missed turnaround target may affect aircraft availability.");
  assert.ok(mroRecommendation.missingInformation.includes("The induction date has not been verified."));
  assert.equal(mroRecommendation.evidenceSufficiency, "low_confidence_review_required");
  assert.equal(mroRecommendation.evidenceConfidence, 0.62);
  assert.ok(mroRecommendation.missingInformation.some((item) => /surrounding contractual context/i.test(item)));
  assert.equal(paymentRecommendation.category, "commercial_protection");
  assert.equal(paymentRecommendation.evidenceSufficiency, "verified_source_support");
  assert.equal(paymentRecommendation.evidence[0].clauseId, paymentClause.id);
  assert.equal(deadlineRecommendation.category, "deadline_obligation_management");
  assert.equal(negotiationRecommendation.category, "negotiation_intelligence");
});

test("recommendations without an exact source clause and matching excerpt are withheld", () => {
  const clauses = segmentDeterministicClauses(source("GROUND HANDLING AGREEMENT\nProvider shall provide ramp services at the airport."));
  const clause = clauses[0];
  const profile = buildContractProfile({
    clauses,
    risks: [{
      id: "unsupported-risk",
      title: "Unsupported service exposure",
      evidence: [{ clauseId: "99999999-9999-4999-8999-999999999999", evidenceText: "Provider must meet a 20-minute turnaround." }],
    }, {
      id: "mismatched-excerpt",
      title: "Unsupported payment exposure",
      evidence: [{ clauseId: clause.id, evidenceText: "Customer shall pay a late charge." }],
    }, {
      id: "missing-evidence",
      title: "Uncited operational exposure",
    }],
  });

  assert.deepEqual(profile.recommendations, []);
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

test("rent escalation extraction retains an explicitly annual recurrence rule as evidence", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "synthetic-aircraft-lease.txt"), "utf8");
  const escalation = profileFor(text).commercialTerms.rentEscalation;

  assert.equal(escalation.ratePercent, 2.5);
  assert.equal(escalation.frequency, "annual");
  assert.match(escalation.recurrenceRule, /each anniversary of the Delivery Date/i);
  assert.match(escalation.evidence.evidenceText, /each anniversary.*increase by 2\.5 percent/i);
});

test("indexed escalation extraction preserves formula type and source sentence without inventing index values", () => {
  const examples = [
    ["Base Rent shall be adjusted annually by the Consumer Price Index (CPI).", "cpi_index"],
    ["Base Rent shall be adjusted annually by the SOFR interest rate.", "interest_rate_index"],
    ["Base Rent shall be adjusted annually by the foreign exchange rate.", "foreign_exchange_index"],
  ];
  for (const [sentence, formulaType] of examples) {
    const escalation = profileFor(`AIRCRAFT LEASE AGREEMENT\n${sentence}`).commercialTerms.rentEscalation;
    assert.equal(escalation.formulaType, formulaType);
    assert.equal(escalation.ratePercent, null);
    assert.equal(escalation.frequency, "annual");
    assert.equal(escalation.recurrenceRule, sentence);
    assert.equal(escalation.evidence.evidenceText, sentence);
  }
});

test("conflicting base rents and escalation mechanisms are preserved without selecting a value", () => {
  const profile = profileFor(`AIRCRAFT LEASE AGREEMENT
Monthly rent of USD 100,000 applies.
Monthly base rent of USD 125,000 applies.
Base Rent shall increase by 2 percent annually.
Base Rent shall increase by 3 percent annually.`);
  const terms = profile.commercialTerms;

  assert.equal(terms.baseRent, null);
  assert.equal(terms.rentEscalation.formulaType, "conflicting");
  assert.equal(terms.rentEscalation.ratePercent, null);
  assert.equal(terms.rentEscalation.evidence, null);
  assert.equal(terms.rentEscalation.evidenceCandidates.length, 2);
  assert.deepEqual(terms.financialTermConflicts.map((item) => item.field), ["base_rent", "rent_escalation"]);
  assert.equal(terms.financialTermConflicts[0].candidates.length, 2);
  assert.ok(terms.financialTermConflicts.every((item) => item.candidates.every((candidate) => candidate.evidence.evidenceText)));
});

test("aircraft lease profile extracts multiple reserve rates from the same clause", async () => {
  const text = await fs.readFile(path.join(root, "test", "fixtures", "aviation-acceptance", "lease-delivery-reserves-and-assignment.txt"), "utf8");
  const profile = profileFor(text);

  assert.deepEqual(profile.commercialTerms.maintenanceReserves.map((item) => [
    item.coveredComponent,
    item.rate.amount,
    item.rate.unit,
    item.paymentFrequency,
  ]), [
    ["airframe", 275, "flight_hour", "monthly"],
    ["engine", 85, "flight_cycle", "monthly"],
  ]);
  assert.ok(profile.commercialTerms.maintenanceReserves.every((item) => (
    item.evidence?.evidenceText
      && text.includes(item.evidence.evidenceText)
      && item.evidence.sourceLocation
  )));
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
    assert.doesNotMatch(JSON.stringify(profile.recommendations.map(({ evidence, observedFacts, ...interpretation }) => interpretation)), /aircraft|lease return|redelivery compliance plan/i);
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