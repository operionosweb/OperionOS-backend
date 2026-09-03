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
  assert.deepEqual(profile.aircraftIdentifiers.map((item) => [item.type, item.value]), [
    ["AIRCRAFT_REGISTRATION", "G-SYN1"],
    ["AIRCRAFT_MSN", "98765"],
  ]);
  assert.ok(profile.evidenceClaims.every((claim) => claim.evidence));
  assert.ok(profile.summary.executiveSummary.includes("G-SYN1"));
});

test("unsupported metadata remains null and is reported as not established", () => {
  const clauses = segmentDeterministicClauses(source("1. SERVICES\nThe Supplier may provide services upon request."));
  const profile = buildContractProfile({ clauses });

  assert.equal(profile.metadata.contractNumber, null);
  assert.equal(profile.metadata.effectiveDate, null);
  assert.equal(profile.metadata.expirationDate, null);
  assert.equal(profile.metadata.governingLaw, null);
  assert.equal(profile.metadata.currency, null);
  assert.equal(profile.aircraftIdentifiers.length, 0);
  assert.ok(profile.summary.unusualOrMissingTerms.some((item) => item.field === "contractNumber"));
});

test("recommendations retain potential language, evidence, and legal disclaimer", () => {
  const clauses = segmentDeterministicClauses(source("1. MAINTENANCE\nThe Lessee shall maintain the Aircraft."));
  const profile = buildContractProfile({
    clauses,
    risks: [{ id: "risk-1", title: "Maintenance records exposure", evidence: [{ evidenceId: "evidence-1" }] }],
  });

  assert.match(profile.recommendations[0].title, /^Potential /);
  assert.deepEqual(profile.recommendations[0].evidence, [{ evidenceId: "evidence-1" }]);
  assert.match(profile.recommendations[0].disclaimer, /not legal advice/i);
});

test("profiling rejects empty source instead of inventing a contract", () => {
  assert.throws(
    () => buildContractProfile({ clauses: [] }),
    (error) => error.code === "SOURCE_TEXT_UNAVAILABLE"
  );
});