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