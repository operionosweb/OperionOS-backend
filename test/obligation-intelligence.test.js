import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeterministicObligationCandidate,
  createGatewayObligationProvider,
} from "../services/phase3/intelligence/deterministicObligationService.js";

test("deterministic preprocessing captures actor, action, object, frequency, and modality", () => {
  const candidate = buildDeterministicObligationCandidate({
    source_text: "The Lessee shall not operate the Aircraft outside the permitted territory monthly.",
  });

  assert.equal(candidate.actor, "Lessee");
  assert.equal(candidate.action, "operate");
  assert.match(candidate.object, /Aircraft/);
  assert.equal(candidate.frequency, "monthly");
  assert.equal(candidate.modality, "prohibited");
});

test("deterministic preprocessing preserves conditional triggers and timing", () => {
  const candidate = buildDeterministicObligationCandidate({
    source_text: "If the Aircraft remains out of service, the Lessee shall notify the Lessor within 30 days.",
  });

  assert.equal(candidate.actor, "Lessee");
  assert.equal(candidate.action, "notify");
  assert.match(candidate.condition, /^If the Aircraft remains out of service/);
  assert.equal(candidate.timing_expression, "within 30 days");
  assert.equal(candidate.modality, "conditional");
});

test("deterministic preprocessing recognizes explicit termination actions without noun overmatch", () => {
  const mandatory = buildDeterministicObligationCandidate({
    source_text: "The Lessee shall terminate the Agreement upon written notice.",
  });
  assert.equal(mandatory.actor, "Lessee");
  assert.equal(mandatory.action, "terminate");
  assert.match(mandatory.object, /^Agreement/);
  assert.equal(mandatory.modality, "mandatory");

  const discretionary = buildDeterministicObligationCandidate({
    source_text: "The Supplier may terminate the Services upon material breach.",
  });
  assert.equal(discretionary.actor, "Supplier");
  assert.equal(discretionary.action, "terminate");
  assert.match(discretionary.object, /^Services/);
  assert.equal(discretionary.modality, "discretionary");

  const finite = buildDeterministicObligationCandidate({
    source_text: "The Airline terminates the Agreement upon written notice.",
  });
  assert.equal(finite.action, "terminate");
  assert.equal(finite.object, "Agreement upon written notice");

  assert.equal(buildDeterministicObligationCandidate({
    source_text: "The Agreement contains termination provisions.",
  }), null);
  assert.equal(buildDeterministicObligationCandidate({
    source_text: "The parties acknowledge the termination date.",
  }), null);
});

test("deterministic preprocessing canonicalizes indemnifies without noun overmatch", () => {
  const candidate = buildDeterministicObligationCandidate({
    source_text: "The Airport indemnifies the Airline for all losses arising from negligent services.",
  });

  assert.equal(candidate.actor, "Airport");
  assert.equal(candidate.action, "indemnify");
  assert.match(candidate.object, /^Airline for all losses/);
  assert.equal(candidate.modality, "mandatory");

  for (const source_text of [
    "The Agreement contains indemnification provisions.",
    "The parties acknowledge the indemnity obligations.",
    "The indemnification obligations are described in Schedule 2.",
  ]) {
    assert.equal(buildDeterministicObligationCandidate({ source_text }), null);
  }
});

test("deterministic preprocessing recognizes explicit return actions without noun overmatch", () => {
  const mandatory = buildDeterministicObligationCandidate({
    source_text: "7. RETURN CONDITIONS\nOn the Expiration Date, the Lessee shall return the Aircraft to the Lessor.",
  });
  assert.equal(mandatory.actor, "Lessee");
  assert.equal(mandatory.action, "return");
  assert.match(mandatory.object, /^Aircraft/);
  assert.equal(mandatory.modality, "mandatory");

  const discretionary = buildDeterministicObligationCandidate({
    source_text: "The Lessee may return the Aircraft before lease expiry.",
  });
  assert.equal(discretionary.action, "return");
  assert.equal(discretionary.modality, "discretionary");

  for (const source_text of [
    "The Agreement records the return date.",
    "The parties acknowledge the return conditions.",
    "The return requirements appear in Schedule 4.",
  ]) {
    assert.equal(buildDeterministicObligationCandidate({ source_text }), null);
  }

  const existingReferenceObligation = buildDeterministicObligationCandidate({
    source_text: "The return requirements shall apply after redelivery.",
  });
  assert.notEqual(existingReferenceObligation?.action, "return");
});

test("deterministic preprocessing recognizes explicit extend actions without noun overmatch", () => {
  const discretionary = buildDeterministicObligationCandidate({
    source_text: "8.1 EXTENSION OPTION\nThe Lessee may extend the Term for 12 months by giving the Lessor not less than 180 days' written notice before the Expiration Date.",
  });
  assert.equal(discretionary.actor, "Lessee");
  assert.equal(discretionary.action, "extend");
  assert.match(discretionary.object, /^Term/);
  assert.equal(discretionary.modality, "discretionary");

  const mandatory = buildDeterministicObligationCandidate({
    source_text: "The Lessee shall extend the Term after receiving written approval.",
  });
  assert.equal(mandatory.action, "extend");
  assert.equal(mandatory.modality, "mandatory");

  for (const source_text of [
    "The Agreement records the extension period.",
    "The parties acknowledge the extension option.",
    "The extension notice appears in Schedule 5.",
  ]) {
    assert.equal(buildDeterministicObligationCandidate({ source_text }), null);
  }

  const existingReferenceObligation = buildDeterministicObligationCandidate({
    source_text: "The extension option shall apply after written notice.",
  });
  assert.notEqual(existingReferenceObligation?.action, "extend");
});

test("deterministic preprocessing recognizes finite provides notice obligations", () => {
  const candidate = buildDeterministicObligationCandidate({
    source_text: "6. RENEWAL NOTICE\nThe Agreement automatically renews for one year unless the Airline provides notice 90 days before expiry.",
  });

  assert.equal(candidate.actor, "Airline");
  assert.equal(candidate.action, "provide");
  assert.match(candidate.object, /^notice 90 days before expiry/i);
  assert.equal(candidate.modality, "conditional");
  assert.equal(candidate.condition, undefined);
  assert.match(candidate.description, /^the Airline provides notice 90 days before expiry/i);
  assert.equal(candidate.timing_expression, "before expiry");

  for (const source_text of [
    "The Agreement contains notice provisions.",
    "The notice requirements appear in Schedule 4.",
    "The parties acknowledge the notice period.",
    "The notice clause governs communications.",
  ]) {
    assert.equal(buildDeterministicObligationCandidate({ source_text }), null);
  }
});

test("Gateway obligation provider reports requests, budget, and cache metrics", async () => {
  const calls = [];
  const metrics = {};
  const provider = createGatewayObligationProvider({
    metrics,
    gateway: {
      async request(request) {
        calls.push(request);
        return {
          success: true,
          source: "provider",
          result: {
            description: "The Lessee shall pay rent.",
            obligation_type: "payment",
          },
          job: { estimatedIntelligence: 30, actualIntelligence: 30 },
        };
      },
    },
  });
  const result = await provider.analyzeStructured({ organization_id: "org-a", clause_text: "The Lessee shall pay rent." });

  assert.equal(result.output.obligation_type, "payment");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, "obligation_reasoning");
  assert.equal(metrics.requests, 1);
  assert.equal(metrics.estimatedIntelligence, 30);
  assert.equal(metrics.actualIntelligence, 30);
  assert.equal(metrics.cacheMisses, 1);
});