import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createExternalAviationObservationRepository } from "../repositories/phase3/externalAviationObservationRepository.js";
import {
  deriveAviationExternalRiskIntelligence,
  deriveAviationFxReferenceSensitivity,
  deriveAviationFxScenarioComparisons,
  deriveAviationInterestRateScenarioComparisons,
  refreshAviationExternalObservations,
  readAviationExternalRiskIntelligence,
} from "../services/phase3/intelligence/aviationExternalRiskIntelligenceService.js";
import { createExternalAviationSignalService } from "../services/phase3/intelligence/externalAviationSignalService.js";
import portfolioRoutes from "../routes/portfolioRoutes.js";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/aviation-acceptance/phase58-external-risk.json", import.meta.url),
  "utf8",
));
const EIA_SERIES_ID = "EER_EPJK_PF4_RGC_DPG";

function providerResponse({ text = "", json = {}, ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async text() {
      return text;
    },
    async json() {
      return json;
    },
  };
}

test("collects verified ECB, New York Fed, and EIA observations without leaking API credentials", async () => {
  const requestedUrls = [];
  const eiaKey = "synthetic-test-key-not-a-credential";
  const service = createExternalAviationSignalService({
    now: () => new Date("2026-11-09T08:00:00.000Z"),
    ecbCurrencies: ["USD"],
    eiaApiKey: eiaKey,
    eiaTermsAccepted: true,
    async fetchImpl(url) {
      const requestUrl = String(url);
      requestedUrls.push(requestUrl);
      if (requestUrl.includes("api.eia.gov")) {
        return providerResponse({
          json: {
            series: [{
              series_id: EIA_SERIES_ID,
              units: "Dollars per Gallon",
              data: [["2026-11-06", 2.45], ["2026-11-13", 2.6], ["2026-11-06", "W"]],
            }],
          },
        });
      }
      if (requestUrl.includes("data-api.ecb.europa.eu")) {
        return providerResponse({
          text: [
            "TIME_PERIOD,OBS_VALUE,OBS_STATUS,CURRENCY,CURRENCY_DENOM,TITLE",
            '2026-11-06,1.1165,A,USD,EUR,"US dollar/Euro, ECB reference rate"',
            '2026-11-05,1.1200,A,USD,EUR,"US dollar/Euro, ECB reference rate"',
            '2026-11-07,1.1300,M,USD,EUR,"missing observation"',
          ].join("\n"),
        });
      }
      return providerResponse({
        json: {
          refRates: [
            { type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 },
            { type: "SOFR", effectiveDate: "2026-11-05", percentRate: 3.94 },
            { type: "EFFR", effectiveDate: "2026-11-06", percentRate: 3.9 },
          ],
        },
      });
    },
  });

  const result = await service.collectPublicObservations();
  assert.equal(result.observations.length, 5);
  assert.deepEqual(result.sources, {
    fuel: { status: "available", sourceId: "eia", reason: null },
    fx: { status: "available", sourceId: "ecb", reason: null },
    interest: { status: "available", sourceId: "nyfed", reason: null },
  });
  assert.ok(result.observations.every((item) => item.data_quality_status === "verified"));
  assert.ok(result.observations.every((item) => item.record_type === "published_observation"));
  assert.ok(result.observations.every((item) => item.publication_timestamp === null));
  assert.ok(result.observations.some((item) => item.indicator_id === "fuel.jet.us.gulf_coast" && item.value === 2.45));
  assert.ok(result.observations.some((item) => item.indicator_id === "fx.eur.usd" && item.is_historical));
  assert.ok(result.observations.some((item) => item.indicator_id === "interest.us.sofr" && item.is_historical));
  assert.ok(requestedUrls.some((url) => url.includes(`series_id=${EIA_SERIES_ID}`)));
  assert.ok(requestedUrls.every((url) => !url.includes("contract") && !url.includes("Synthetic")));
  assert.ok(!JSON.stringify(result).includes(eiaKey));
  assert.ok(result.observations.every((item) => !item.source_reference.includes(eiaKey)));
});

test("does not call EIA without an authorized key and reports partial source failures", async () => {
  const requestedUrls = [];
  const service = createExternalAviationSignalService({
    now: () => new Date("2026-11-09T08:00:00.000Z"),
    ecbCurrencies: ["USD", "GBP"],
    eiaApiKey: null,
    async fetchImpl(url) {
      const requestUrl = String(url);
      requestedUrls.push(requestUrl);
      if (requestUrl.includes("/D.USD.EUR.SP00.A?")) {
        return providerResponse({
          text: [
            "TIME_PERIOD,OBS_VALUE,OBS_STATUS,CURRENCY,CURRENCY_DENOM",
            "2026-11-06,1.1165,A,USD,EUR",
          ].join("\n"),
        });
      }
      if (requestUrl.includes("data-api.ecb.europa.eu")) return providerResponse({ ok: false, status: 503 });
      return providerResponse({ json: { refRates: [{ type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 }] } });
    },
  });

  const result = await service.collectPublicObservations();
  assert.equal(requestedUrls.length, 3);
  assert.ok(requestedUrls.every((url) => !url.includes("api.eia.gov")));
  assert.equal(result.sources.fuel.status, "unavailable");
  assert.equal(result.sources.fx.status, "partial");
  assert.equal(result.sources.interest.status, "available");
  assert.equal(result.observations.length, 2);
  assert.equal(result.sources.fx.failures.length, 1);
});

test("does not use a configured EIA key unless API terms acceptance is explicit", async () => {
  const requestedUrls = [];
  const service = createExternalAviationSignalService({
    now: () => new Date("2026-11-09T08:00:00.000Z"),
    ecbCurrencies: [],
    eiaApiKey: "synthetic-gated-key",
    eiaTermsAccepted: false,
    async fetchImpl(url) {
      requestedUrls.push(String(url));
      return providerResponse({ json: { refRates: [{ type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 }] } });
    },
  });
  const result = await service.collectPublicObservations();
  assert.ok(requestedUrls.every((url) => !url.includes("api.eia.gov")));
  assert.equal(result.sources.fuel.status, "unavailable");
  assert.match(result.sources.fuel.reason, /terms acceptance is not confirmed/);
});

test("source failure diagnostics do not disclose configured EIA credentials", async () => {
  const apiKey = "synthetic-private-key";
  const service = createExternalAviationSignalService({
    now: () => new Date("2026-11-09T08:00:00.000Z"),
    ecbCurrencies: [],
    eiaApiKey: apiKey,
    eiaTermsAccepted: true,
    async fetchImpl(url) {
      if (String(url).includes("api.eia.gov")) throw new Error(`Request failed for ${url}`);
      return providerResponse({
        json: { refRates: [{ type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 }] },
      });
    },
  });
  const result = await service.collectPublicObservations();
  assert.equal(result.sources.fuel.failures[0], "Source retrieval or validation failed.");
  assert.equal(JSON.stringify(result).includes(apiKey), false);
});

test("deduplicates identical ECB source rows and rejects conflicting values for one observation date", async () => {
  const csv = [
    "TIME_PERIOD,OBS_VALUE,OBS_STATUS,CURRENCY,CURRENCY_DENOM",
    "2026-11-06,1.1165,A,USD,EUR",
    "2026-11-06,1.1165,A,USD,EUR",
    "2026-11-05,1.1200,A,USD,EUR",
  ].join("\n");
  const options = {
    now: () => new Date("2026-11-09T08:00:00.000Z"),
    ecbCurrencies: ["USD"],
    async fetchImpl(url) {
      if (String(url).includes("data-api.ecb.europa.eu")) return providerResponse({ text: csv });
      return providerResponse({ json: { refRates: [{ type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 }] } });
    },
  };
  const duplicateResult = await createExternalAviationSignalService(options).collectPublicObservations();
  const fxRows = duplicateResult.observations.filter((item) => item.category === "fx");
  assert.equal(fxRows.length, 2);
  assert.deepEqual(fxRows.map((item) => item.observation_date), ["2026-11-05", "2026-11-06"]);

  const conflicting = createExternalAviationSignalService({
    ...options,
    async fetchImpl(url) {
      if (String(url).includes("data-api.ecb.europa.eu")) {
        return providerResponse({
          text: csv.replace("2026-11-06,1.1165,A,USD,EUR\n2026-11-06,1.1165,A,USD,EUR", "2026-11-06,1.1165,A,USD,EUR\n2026-11-06,1.1300,A,USD,EUR"),
        });
      }
      return providerResponse({ json: { refRates: [{ type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 }] } });
    },
  });
  const conflictResult = await conflicting.collectPublicObservations();
  assert.equal(conflictResult.sources.fx.status, "unavailable");
  assert.equal(conflictResult.observations.some((item) => item.category === "fx"), false);
  assert.deepEqual(conflictResult.sources.fx.failures, ["Source retrieval or validation failed."]);

  const conflictingInterest = createExternalAviationSignalService({
    now: options.now,
    ecbCurrencies: [],
    async fetchImpl() {
      return providerResponse({
        json: {
          refRates: [
            { type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.92 },
            { type: "SOFR", effectiveDate: "2026-11-06", percentRate: 3.95 },
          ],
        },
      });
    },
  });
  const interestResult = await conflictingInterest.collectPublicObservations();
  assert.equal(interestResult.sources.interest.status, "unavailable");
  assert.equal(interestResult.observations.length, 0);
});

test("refresh orchestration persists only verified public observations and reports idempotent inserts", async () => {
  const retrievedAt = "2026-11-09T08:00:00.000Z";
  const observation = {
    ...fixture.observations[2],
    retrieval_timestamp: retrievedAt,
    data_quality_status: "verified",
    record_type: "published_observation",
  };
  const inserts = [];
  const options = {
    signalService: {
      async collectPublicObservations() {
        return {
          retrievedAt,
          observations: [observation],
          sources: { fx: { status: "available", sourceId: "ecb", reason: null } },
          disclaimer: "Reference data only.",
        };
      },
    },
    repository: {
      async insertObservations(rows) {
        inserts.push(rows);
        return { inserted: inserts.length === 1 ? 1 : 0 };
      },
    },
  };

  const first = await refreshAviationExternalObservations(options);
  const retry = await refreshAviationExternalObservations(options);
  assert.deepEqual(first, {
    status: "completed",
    retrievedAt,
    receivedCount: 1,
    insertedCount: 1,
    duplicateCount: 0,
    sources: { fx: { status: "available", sourceId: "ecb", reason: null } },
    disclaimer: "Reference data only.",
  });
  assert.equal(retry.insertedCount, 0);
  assert.equal(retry.duplicateCount, 1);
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0][0].source_id, "ecb");

  await assert.rejects(() => refreshAviationExternalObservations({
    ...options,
    signalService: {
      async collectPublicObservations() {
        return {
          retrievedAt,
          observations: [{ ...observation, data_quality_status: "unverified" }],
          sources: {},
        };
      },
    },
  }), /unverified or invalid observation/);
});

test("public observation refresh route requires contract-write permission", () => {
  const layer = portfolioRoutes.stack.find((item) => item.route?.path === "/aviation-external-risk/refresh");
  assert.ok(layer);
  assert.equal(layer.route.methods.post, true);
  const permissionMiddleware = layer.route.stack[0].handle;
  const denied = {
    organization: { id: fixture.organizationId },
    auth: { organizationRole: "VIEWER" },
  };
  let deniedStatus;
  let deniedBody;
  permissionMiddleware(denied, {
    status(value) {
      deniedStatus = value;
      return this;
    },
    json(value) {
      deniedBody = value;
      return this;
    },
  }, () => assert.fail("viewer must not be allowed to refresh public observations"));
  assert.equal(deniedStatus, 403);
  assert.match(deniedBody.error, /Insufficient organization permissions/);

  let allowed = false;
  permissionMiddleware({
    organization: { id: fixture.organizationId },
    auth: { organizationRole: "CONTRACT_MANAGER" },
  }, {}, () => { allowed = true; });
  assert.equal(allowed, true);
});

test("FX scenario endpoint rejects malformed and oversized scenario sets before reading contract data", async () => {
  const layer = portfolioRoutes.stack.find((item) => item.route?.path === "/aviation-external-risk/:contractId/fx-sensitivity");
  assert.ok(layer);
  const handler = layer.route.stack.at(-1).handle;
  const invalidBodies = [
    { assessmentId: "assessment", scenarios: [] },
    { assessmentId: "assessment", scenarios: Array.from({ length: 5 }, (_, index) => ({
      label: `Scenario ${index + 1}`,
      scenarioQuotePerEur: 1.1,
    })) },
    { assessmentId: "assessment", scenarios: [{ label: "Zero", scenarioQuotePerEur: 0 }] },
    {
      assessmentId: "assessment",
      scenarioQuotePerEur: 1.1,
      scenarios: [{ label: "Mixed modes", scenarioQuotePerEur: 1.2 }],
    },
    { assessmentId: "assessment", scenarios: [{ label: "   ", scenarioQuotePerEur: 1.2 }] },
  ];

  for (const body of invalidBodies) {
    const response = {
      statusCode: null,
      payload: null,
      status(value) {
        this.statusCode = value;
        return this;
      },
      json(value) {
        this.payload = value;
        return this;
      },
    };
    await handler({ body, params: { contractId: fixture.provisions[1].contract_id } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.success, false);
  }
});

test("interest scenario endpoint rejects malformed inputs before reading contract data", async () => {
  const layer = portfolioRoutes.stack.find((item) => item.route?.path === "/aviation-external-risk/:contractId/interest-sensitivity");
  assert.ok(layer);
  const handler = layer.route.stack.at(-1).handle;
  const invalidBodies = [
    { assessmentId: "assessment", principalAmount: 10_000_000, scenarios: [] },
    { assessmentId: "assessment", principalAmount: 10_000_000, scenarios: Array.from({ length: 5 }, (_, index) => ({
      label: `Scenario ${index + 1}`,
      scenarioBenchmarkPercent: 4.5,
    })) },
    { assessmentId: "assessment", principalAmount: 0, scenarios: [{ label: "Zero principal", scenarioBenchmarkPercent: 4.5 }] },
    { assessmentId: "assessment", principalAmount: 10_000_000, scenarios: [{ label: "Negative", scenarioBenchmarkPercent: -0.1 }] },
    { assessmentId: "assessment", principalAmount: 10_000_000, scenarios: [{ label: "Too high", scenarioBenchmarkPercent: 100.1 }] },
    { assessmentId: "assessment", principalAmount: 10_000_000, scenarios: [{ label: "   ", scenarioBenchmarkPercent: 4.5 }] },
  ];

  for (const body of invalidBodies) {
    const response = {
      statusCode: null,
      payload: null,
      status(value) {
        this.statusCode = value;
        return this;
      },
      json(value) {
        this.payload = value;
        return this;
      },
    };
    await handler({ body, params: { contractId: fixture.provisions[2].contract_id } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.payload.success, false);
  }
});

test("connects only verified current-version aviation evidence to matching indicators", () => {
  const result = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: fixture.provisions,
    observations: fixture.observations,
    asOf: fixture.asOf,
  });
  const byContract = new Map(result.contractualAssessments.map((item) => [item.contractTitle, item]));

  const fuel = byContract.get("Synthetic Gulf Coast Lease");
  assert.equal(fuel.category, "fuel");
  assert.equal(fuel.status, "verified_contractual_relationship");
  assert.equal(fuel.observation.value, 2.45);
  assert.equal(fuel.calculation.status, "not_calculated");

  const fx = byContract.get("Synthetic USD Lease");
  assert.equal(fx.currency, "USD");
  assert.equal(fx.observation.use, "informational_only");
  assert.equal(fx.observation.sourceType, "official_publication");
  assert.match(fx.observation.geographicScope, /ECB euro reference-rate series/);
  assert.equal(fx.observation.validationStatus, "source_series_and_units_validated");
  assert.ok(fx.observation.retrievalTimestamp);
  assert.deepEqual(fx.contractualPayment, { amount: 1250000, currency: "USD", dueDate: "2026-12-01" });
  assert.equal(fx.calculation.status, "not_calculated");
  assert.ok(fx.calculation.missingInputs.includes("organisation reporting currency"));
  assert.ok(fx.calculation.missingInputs.includes("hedge status and treasury position"));

  const interest = byContract.get("Synthetic USD Financing");
  assert.equal(interest.benchmark, "SOFR");
  assert.equal(interest.observation.value, 3.92);
  assert.deepEqual(interest.contractualRateTerms, { spreadBasisPoints: 250, resetFrequency: "monthly" });
  assert.equal(interest.calculation.status, "not_calculated");
  assert.equal(interest.financingExposure.exposureClassification, "floating_rate");
  assert.ok(interest.financingExposure.missingInputs.includes("an explicit positive outstanding principal and currency"));

  const ambiguous = byContract.get("Synthetic Fuel Cost Clause");
  assert.equal(ambiguous.status, "requires_review");
  assert.equal(byContract.has("Synthetic Ambiguous Financing"), false);
  assert.equal(byContract.has("Synthetic EUR Lease"), false);
  assert.equal(byContract.get("Synthetic GBP Support Agreement").observation.freshnessStatus, "stale");
  assert.equal(byContract.get("Synthetic GBP Support Agreement").calculation.status, "not_calculated");
  assert.equal(result.portfolioAggregation.amounts.length, 0);
  assert.equal(result.portfolioAggregation.currencyConversion, "not_performed");
  assert.ok(result.recommendations.every((item) => item.evidence.reviewStatus === "verified"));
  assert.ok(result.observations.every((item) => item.publicationTimestamp === null));
});

test("classifies fixed and floating financing and calculates only explicit supported annualized run-rates", () => {
  const sourceProvision = fixture.provisions.find((provision) => provision.contract_title === "Synthetic USD Financing");
  const floatingExcerpt = "The outstanding principal is USD 10,000,000 as of 2026-11-06. Floating interest on the facility is based on SOFR plus 250 basis points and resets monthly. The interest rate shall not exceed 7.50% and shall not fall below 1.00% per annum.";
  const floatingProvision = { ...sourceProvision, excerpt: floatingExcerpt };
  const floating = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [floatingProvision],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];

  assert.equal(floating.category, "interest");
  assert.equal(floating.mechanism, "explicit_floating_reference_rate");
  assert.equal(floating.financingExposure.exposureClassification, "floating_rate");
  assert.equal(floating.financingExposure.status, "calculated");
  assert.equal(floating.financingExposure.terms.principalCurrency, "USD");
  assert.equal(floating.financingExposure.terms.spreadBasisPoints, 250);
  assert.equal(floating.financingExposure.terms.resetFrequency, "monthly");
  assert.equal(floating.financingExposure.terms.capRatePercent, 7.5);
  assert.equal(floating.financingExposure.terms.floorRatePercent, 1);
  assert.equal(floating.financingExposure.calculation.applicableRatePercent, 6.42);
  assert.equal(floating.financingExposure.calculation.annualizedInterestExpense.amount, 642000);
  assert.equal(floating.financingExposure.calculation.annualizedInterestExpense.currency, "USD");
  assert.equal(floating.financingExposure.calculation.principal.basis, "explicit_verified_clause_value");
  assert.equal(floating.observation.useAsContractualBenchmark, true);
  assert.match(floating.financingExposure.limitations.join(" "), /not accrued or payable interest/i);

  const fixedProvision = {
    ...sourceProvision,
    excerpt: "The outstanding principal is USD 8,000,000. The facility shall accrue at a fixed interest rate of 5.25% per annum for the term.",
  };
  const fixed = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [fixedProvision],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(fixed.financingExposure.exposureClassification, "fixed_rate");
  assert.equal(fixed.financingExposure.status, "calculated");
  assert.equal(fixed.financingExposure.calculation.annualizedInterestExpense.amount, 420000);
  assert.equal(fixed.observation, null);

  const missingPrincipal = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{
      ...floatingProvision,
      excerpt: floatingExcerpt.replace("The outstanding principal is USD 10,000,000 as of 2026-11-06. ", ""),
    }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(missingPrincipal.financingExposure.status, "not_calculated");
  assert.equal(missingPrincipal.financingExposure.calculation, null);
  assert.ok(missingPrincipal.financingExposure.missingInputs.includes("an explicit positive outstanding principal and currency"));

  const eurPrincipal = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{ ...floatingProvision, excerpt: floatingExcerpt.replace("USD 10,000,000", "EUR 10,000,000") }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(eurPrincipal.financingExposure.status, "not_calculated");
  assert.ok(eurPrincipal.financingExposure.missingInputs.includes("a USD principal matching the contractually named SOFR benchmark"));

  const otherBenchmark = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{ ...floatingProvision, excerpt: floatingExcerpt.replaceAll("SOFR", "EURIBOR") }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(otherBenchmark.benchmark, "EURIBOR");
  assert.equal(otherBenchmark.financingExposure.status, "not_calculated");
  assert.ok(otherBenchmark.financingExposure.missingInputs.some((input) => /EURIBOR/.test(input)));

  const stale = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [floatingProvision],
    observations: fixture.observations,
    asOf: "2026-12-01",
  }).contractualAssessments[0];
  assert.equal(stale.financingExposure.status, "not_calculated");
  assert.ok(stale.financingExposure.missingInputs.some((input) => /fresh verified New York Fed SOFR/.test(input)));
});

test("compares bounded SOFR assumptions with clause margin, cap, floor and auditable provenance", () => {
  const provision = {
    ...fixture.provisions.find((item) => item.contract_title === "Synthetic USD Financing"),
    excerpt: "The outstanding principal is USD 10,000,000. Floating interest on the facility is based on SOFR plus 250 basis points and resets monthly. The interest rate shall not exceed 7.50% and shall not fall below 1.00% per annum.",
  };
  const assessment = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  const originalAssessment = structuredClone(assessment);
  const scenarios = deriveAviationInterestRateScenarioComparisons(assessment, {
    principalAmount: 10_000_000,
    scenarios: [
      { label: "Moderate", scenarioBenchmarkPercent: 4.42 },
      { label: "Cap reached", scenarioBenchmarkPercent: 5.92 },
    ],
  }, fixture.organizationId);

  assert.equal(scenarios.length, 2);
  assert.equal(scenarios[0].status, "calculated");
  assert.equal(scenarios[0].principal.basis, "verified_clause_fact");
  assert.equal(scenarios[0].contractId, assessment.contractId);
  assert.equal(scenarios[0].documentVersionId, assessment.documentVersionId);
  assert.equal(scenarios[0].externalVariable.indicatorId, "interest.us.sofr");
  assert.equal(scenarios[0].baselineObservation.value, 3.92);
  assert.equal(scenarios[0].baselineResult.applicableRatePercent, 6.42);
  assert.equal(scenarios[0].baselineResult.annualizedInterestExpense.amount, 642000);
  assert.equal(scenarios[0].scenarioResult.applicableRatePercent, 6.92);
  assert.equal(scenarios[0].scenarioResult.annualizedInterestExpense.amount, 692000);
  assert.equal(scenarios[0].signedDifference.amount, 50000);
  assert.equal(scenarios[1].scenarioResult.applicableRatePercent, 7.5);
  assert.equal(scenarios[1].scenarioResult.annualizedInterestExpense.amount, 750000);
  assert.equal(scenarios[1].signedDifference.amount, 108000);
  assert.equal(scenarios[0].assumption.label, "User-entered SOFR assumption; not a forecast");
  assert.equal(scenarios[0].notForecast, true);
  assert.equal(scenarios[0].recommendation.status, "recommendation_only");
  assert.equal(scenarios[0].recommendation.performed, false);
  assert.ok(scenarios[0].evidenceReferences.some((item) => item.type === "contract_clause"
    && item.evidenceId === assessment.evidence.evidenceId));
  assert.ok(scenarios[0].evidenceReferences.some((item) => item.type === "external_observation"
    && item.evidenceId === assessment.observation.id));
  assert.equal(scenarios[0].exposureAssessment.contract.organizationId, fixture.organizationId);
  assert.equal(scenarios[0].exposureAssessment.result.financial.length, 3);
  assert.match(scenarios[0].limitations.join(" "), /user assumptions, not market observations or forecasts/i);
  assert.deepEqual(assessment, originalAssessment);

  const userPrincipal = deriveAviationInterestRateScenarioComparisons({
    ...assessment,
    financingExposure: {
      ...assessment.financingExposure,
      terms: { ...assessment.financingExposure.terms, principalAmount: null },
    },
  }, {
    principalAmount: 12_000_000,
    scenarios: [{ label: "Assumed balance", scenarioBenchmarkPercent: 4.42 }],
  }, fixture.organizationId)[0];
  assert.equal(userPrincipal.status, "calculated");
  assert.equal(userPrincipal.principal.basis, "user_supplied_assumption");
  assert.equal(userPrincipal.principal.evidenceId, null);
  assert.equal(userPrincipal.baselineResult.annualizedInterestExpense.amount, 770400);
  assert.ok(userPrincipal.exposureAssessment.calculationInputs.missingInformation
    .includes("Verified lender statement or contract evidence for current outstanding principal"));

  const stale = structuredClone(assessment);
  stale.observation.freshnessStatus = "stale";
  assert.equal(deriveAviationInterestRateScenarioComparisons(stale, {
    principalAmount: 10_000_000,
    scenarios: [{ label: "Stale", scenarioBenchmarkPercent: 4.42 }],
  }, fixture.organizationId)[0].status, "insufficient_evidence");

  const fixed = { ...assessment, mechanism: "explicit_fixed_interest_rate" };
  assert.equal(deriveAviationInterestRateScenarioComparisons(fixed, {
    principalAmount: 10_000_000,
    scenarios: [{ label: "Fixed rate must not reset", scenarioBenchmarkPercent: 4.42 }],
  }, fixture.organizationId)[0].status, "insufficient_evidence");
  assert.throws(() => deriveAviationInterestRateScenarioComparisons(assessment, {
    principalAmount: 10_000_000,
    scenarios: Array.from({ length: 5 }, (_, index) => ({
      label: `Scenario ${index + 1}`,
      scenarioBenchmarkPercent: 4.42,
    })),
  }, fixture.organizationId), /between one and four/);
  assert.throws(() => deriveAviationInterestRateScenarioComparisons(assessment, {
    principalAmount: 0,
    scenarios: [{ label: "Invalid principal", scenarioBenchmarkPercent: 4.42 }],
  }, fixture.organizationId), /principalAmount must be positive/);
  assert.throws(() => deriveAviationInterestRateScenarioComparisons(assessment, {
    principalAmount: 10_000_000,
    scenarios: [{ label: "Invalid rate", scenarioBenchmarkPercent: 101 }],
  }, fixture.organizationId), /percentage from 0 to 100/);
  assert.throws(() => deriveAviationInterestRateScenarioComparisons(assessment, {
    principalAmount: 10_000_000,
    scenarios: [{ label: "Wrong tenant", scenarioBenchmarkPercent: 4.42 }],
  }, "wrong-organization"), /valid organization scope/);
});

test("calculates fuel-price adjustments only from explicit current-version clause terms and a matching verified observation", () => {
  const clauseText = "Fuel surcharge shall be calculated weekly as 80% of the increase above the baseline of USD 2.00 per gallon in the U.S. Gulf Coast weekly kerosene-type jet fuel price, multiplied by 20,000 gallons per week, and the Lessee shall pay this adjustment.";
  const provision = { ...fixture.provisions[0], excerpt: clauseText };
  const assessment = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];

  assert.equal(assessment.category, "fuel");
  assert.equal(assessment.contractId, provision.contract_id);
  assert.equal(assessment.documentVersionId, provision.document_version_id);
  assert.equal(assessment.clauseId, provision.clause_id);
  assert.equal(assessment.fuelExposure.status, "calculated");
  assert.equal(assessment.fuelExposure.calculation.amount.value, 7200);
  assert.equal(assessment.fuelExposure.calculation.amount.currency, "USD");
  assert.equal(assessment.fuelExposure.calculation.amount.period, "week");
  assert.equal(assessment.fuelExposure.calculation.payingParty, "lessee_or_airline");
  assert.equal(assessment.observation.useAsContractualBenchmark, true);
  assert.equal(assessment.calculation.status, "calculated");
  assert.deepEqual(assessment.calculation.missingInputs, []);
  assert.ok(assessment.fuelExposure.calculation.currentPrice.evidenceId);
  assert.equal(assessment.fuelExposure.recommendation.supportingEvidenceIds[0], provision.evidence_id);
  assert.ok(assessment.fuelExposure.recommendation.supportingEvidenceIds.includes(assessment.observation.id));
  assert.match(assessment.fuelExposure.explanation, /not an annualized amount or forecast/);
  assert.equal(assessment.analysisRunId, provision.analysis_run_id);
  assert.equal(assessment.documentVersionId, provision.document_version_id);

  const incompleteTerms = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{ ...provision, excerpt: "The fuel surcharge uses the U.S. Gulf Coast jet fuel index." }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(incompleteTerms.fuelExposure.status, "not_calculated");
  assert.equal(incompleteTerms.fuelExposure.calculation, null);
  assert.ok(incompleteTerms.fuelExposure.missingInputs.includes("an explicit USD-per-gallon adjustment baseline"));
  assert.ok(incompleteTerms.fuelExposure.missingInputs.includes("an explicit gallon quantity per adjustment period"));

  const missingPayer = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{
      ...provision,
      excerpt: clauseText.replace(", and the Lessee shall pay this adjustment", ""),
    }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(missingPayer.fuelExposure.status, "not_calculated");
  assert.ok(missingPayer.fuelExposure.missingInputs.includes("the contractual party responsible for paying the adjustment"));

  const stale = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: fixture.observations,
    asOf: "2026-12-01",
  }).contractualAssessments[0];
  assert.equal(stale.fuelExposure.status, "not_calculated");
  assert.ok(stale.fuelExposure.missingInputs.some((input) => /fresh verified observation/.test(input)));

  const wrongMarketObservations = structuredClone(fixture.observations);
  wrongMarketObservations
    .filter((observation) => observation.indicator_id === "fuel.jet.us.gulf_coast")
    .forEach((observation) => {
      observation.market_applicability = "U.S. West Coast jet fuel spot price FOB";
    });
  const wrongMarket = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: wrongMarketObservations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(wrongMarket.fuelExposure.status, "not_calculated");
  assert.equal(wrongMarket.fuelExposure.calculation, null);

  const wrongCurrencyObservations = structuredClone(fixture.observations);
  wrongCurrencyObservations
    .filter((observation) => observation.indicator_id === "fuel.jet.us.gulf_coast")
    .forEach((observation) => {
      observation.currency = "EUR";
      observation.unit = "EUR per gallon";
    });
  const wrongCurrency = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: wrongCurrencyObservations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(wrongCurrency.fuelExposure.status, "not_calculated");
  assert.equal(wrongCurrency.fuelExposure.calculation, null);

  const belowBaselineObservations = structuredClone(fixture.observations);
  belowBaselineObservations[0].value = 1.9;
  const belowBaseline = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: belowBaselineObservations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  assert.equal(belowBaseline.fuelExposure.status, "calculated");
  assert.equal(belowBaseline.fuelExposure.calculation.amount.value, 0);
  assert.match(belowBaseline.fuelExposure.explanation, /No credit or price reduction is inferred/);
});

test("calculates a deterministic FX reference sensitivity only from a cited payment and current matching observation", () => {
  const assessment = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [fixture.provisions[1]],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  const result = deriveAviationFxReferenceSensitivity(assessment, 1.2, fixture.organizationId);

  assert.equal(result.status, "calculated");
  assert.equal(result.kind, "deterministic_fx_reference_sensitivity");
  assert.equal(result.notForecast, true);
  assert.equal(result.payment.amount, 1250000);
  assert.equal(result.payment.currency, "USD");
  assert.equal(result.payment.dueDate, "2026-12-01");
  assert.equal(result.contractId, assessment.contractId);
  assert.equal(result.documentVersionId, assessment.documentVersionId);
  assert.equal(result.clauseId, assessment.clauseId);
  assert.equal(result.evidence.evidenceId, assessment.evidence.evidenceId);
  assert.equal(result.referenceObservation.sourceId, "ecb");
  assert.equal(result.referenceObservation.observationDate, assessment.observation.observationDate);
  assert.equal(result.userAssumption.quotePerEur, 1.2);
  assert.equal(result.referenceEquivalent.amount, Number((1250000 / assessment.observation.value).toFixed(2)));
  assert.equal(result.scenarioEquivalent.amount, Number((1250000 / 1.2).toFixed(2)));
  assert.equal(result.changeInReferenceEquivalent.amount, Number(((1250000 / 1.2) - (1250000 / assessment.observation.value)).toFixed(2)));
  assert.match(result.limitations.join(" "), /not the organization's reporting-currency amount/i);
  assert.match(result.limitations.join(" "), /not persisted as a forecast snapshot/i);
  assert.equal(result.exposureAssessment.frameworkVersion, 1);
  assert.equal(result.exposureAssessment.category, "fx_reference_sensitivity");
  assert.equal(result.exposureAssessment.contract.organizationId, fixture.organizationId);
  assert.equal(result.exposureAssessment.obligation.linkStatus, "not_linked");
  assert.equal(result.exposureAssessment.result.financial.length, 3);
  assert.equal(result.exposureAssessment.severity.level, "not_scored");
  assert.equal(result.exposureAssessment.recommendation.supportingEvidence[0].evidenceId, assessment.evidence.evidenceId);
  assert.ok(result.exposureAssessment.recommendation.expectedBenefit);
  assert.equal(result.exposureAssessment.recommendation.actionState, "recommendation_only");
  assert.equal(result.exposureAssessment.recommendation.humanApprovalRequired, true);
  assert.equal(result.exposureAssessment.recommendation.performedAt, null);
  assert.equal(result.exposureAssessment.methodology.version, "phase64-fx-reference-sensitivity-v1");
  assert.equal(result.exposureAssessment.dataFreshness.status, assessment.observation.freshnessStatus);
  assert.equal(result.exposureAssessment.dataFreshness.latestObservationDate, assessment.observation.observationDate);
  assert.equal(result.exposureAssessment.evidence.external[0].sourceName, assessment.observation.sourceName);

  const stale = structuredClone(assessment);
  stale.observation.freshnessStatus = "stale";
  assert.equal(deriveAviationFxReferenceSensitivity(stale, 1.2, fixture.organizationId).status, "insufficient_evidence");
  const missingDate = structuredClone(assessment);
  missingDate.contractualPayment.dueDate = null;
  assert.equal(deriveAviationFxReferenceSensitivity(missingDate, 1.2, fixture.organizationId).status, "insufficient_evidence");
  const missingObservation = structuredClone(assessment);
  missingObservation.observation = null;
  assert.equal(deriveAviationFxReferenceSensitivity(missingObservation, 1.2, fixture.organizationId).status, "insufficient_evidence");
  const missingCitation = structuredClone(assessment);
  missingCitation.evidence.pageNumber = null;
  missingCitation.evidence.sourceLocator = null;
  assert.equal(deriveAviationFxReferenceSensitivity(missingCitation, 1.2, fixture.organizationId).status, "insufficient_evidence");
  assert.throws(() => deriveAviationFxReferenceSensitivity(assessment, 0, fixture.organizationId), /positive finite number/);
  assert.throws(() => deriveAviationFxReferenceSensitivity(assessment, "1.2", fixture.organizationId), /positive finite number/);
  assert.throws(() => deriveAviationFxReferenceSensitivity(assessment, 1.2, "wrong-organization"), /valid organization scope/);
});

test("compares bounded FX scenarios through the Phase 64 calculation with scoped provenance", () => {
  const assessment = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [fixture.provisions[1]],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments[0];
  const originalAssessment = structuredClone(assessment);
  const scenarios = deriveAviationFxScenarioComparisons(assessment, [
    { label: "Moderate adverse", scenarioQuotePerEur: 1.05 },
    { label: "Favourable", scenarioQuotePerEur: 1.15 },
  ], fixture.organizationId);

  assert.equal(scenarios.length, 2);
  assert.notEqual(scenarios[0].scenarioId, scenarios[1].scenarioId);
  assert.equal(scenarios[0].organizationId, fixture.organizationId);
  assert.equal(scenarios[0].contractId, assessment.contractId);
  assert.equal(scenarios[0].documentVersionId, assessment.documentVersionId);
  assert.equal(scenarios[0].obligationId, assessment.obligationId || null);
  assert.equal(scenarios[0].payment.amount, 1_250_000);
  assert.equal(scenarios[0].externalVariable.category, "fx");
  assert.equal(scenarios[0].externalVariable.indicatorId, assessment.observation.indicatorId);
  assert.equal(scenarios[0].baselineObservation.value, assessment.observation.value);
  assert.equal(scenarios[0].baselineObservation.unit, "USD per EUR");
  assert.equal(scenarios[0].baselineObservation.freshnessStatus, "current");
  assert.equal(scenarios[0].baselineObservation.sourceReference, assessment.observation.sourceReference);
  assert.equal(scenarios[0].baselineResult.amount, Number((1_250_000 / assessment.observation.value).toFixed(2)));
  assert.equal(scenarios[0].scenarioResult.amount, Number((1_250_000 / 1.05).toFixed(2)));
  assert.equal(scenarios[0].absoluteDifference.amount, Math.abs(scenarios[0].signedDifference.amount));
  assert.equal(scenarios[0].percentageDifference, scenarios[0].signedDifference.percent);
  assert.equal(scenarios[0].methodology.version, "phase64-fx-reference-sensitivity-v1");
  assert.equal(scenarios[0].notForecast, true);
  assert.equal(scenarios[0].recommendation.status, "recommendation_only");
  assert.equal(scenarios[0].recommendation.performed, false);
  assert.ok(scenarios[0].evidenceReferences.some((item) => item.type === "contract_clause"
    && item.evidenceId === assessment.evidence.evidenceId));
  assert.ok(scenarios[0].contractualImpactExplanation.includes("not a transaction forecast"));
  assert.equal(scenarios[0].createdAt, scenarios[1].createdAt);
  assert.deepEqual(assessment, originalAssessment);

  assert.throws(() => deriveAviationFxScenarioComparisons(assessment, [], fixture.organizationId), /between one and four/);
  assert.throws(() => deriveAviationFxScenarioComparisons(assessment, Array.from({ length: 5 }, (_, index) => ({
    label: `Scenario ${index + 1}`,
    scenarioQuotePerEur: 1.1,
  })), fixture.organizationId), /between one and four/);
  assert.throws(() => deriveAviationFxScenarioComparisons(assessment, [
    { label: "", scenarioQuotePerEur: 1.1 },
  ], fixture.organizationId), /requires a label/);
  assert.throws(() => deriveAviationFxScenarioComparisons(assessment, [
    { label: "Invalid rate", scenarioQuotePerEur: 0 },
  ], fixture.organizationId), /positive finite number/);
  assert.throws(() => deriveAviationFxScenarioComparisons(assessment, [
    { label: "Scoped", scenarioQuotePerEur: 1.1 },
  ], "wrong-organization"), /valid organization scope/);

  const stale = structuredClone(assessment);
  stale.observation.freshnessStatus = "stale";
  assert.equal(deriveAviationFxScenarioComparisons(stale, [
    { label: "Stale baseline", scenarioQuotePerEur: 1.1 },
  ], fixture.organizationId)[0].status, "insufficient_evidence");
});

test("reports historical observation coverage, cadence gaps, revisions, and source quality", () => {
  const observations = structuredClone(fixture.observations);
  const latestFuel = observations.find((item) => item.indicator_id === "fuel.jet.us.gulf_coast");
  observations.push({
    ...latestFuel,
    id: "revision-fuel-latest",
    value: 2.5,
    retrieval_timestamp: "2026-11-09T09:00:00.000Z",
    update_status: "revision",
  });
  observations.push({
    ...latestFuel,
    id: "unverified-chf",
    indicator_id: "fx.eur.chf",
    category: "fx",
    unit: "CHF per EUR",
    currency: "CHF",
    base_currency: "EUR",
    quote_currency: "CHF",
    source_reference: "https://data-api.ecb.europa.eu/service/data/EXR/D.CHF.EUR.SP00.A",
    data_quality_status: "unverified",
    source_id: "unverified-source",
  });
  observations.push({
    ...latestFuel,
    id: "inconsistent-gbp-unit",
    indicator_id: "fx.eur.gbp",
    unit: "unrecognized unit",
  });
  observations.push({
    ...fixture.observations.find((item) => item.indicator_id === "fx.eur.usd"),
    id: "inconsistent-cad-currency",
    indicator_id: "fx.eur.cad",
    unit: "CAD per EUR",
    currency: "USD",
    quote_currency: "CAD",
    source_reference: "https://data-api.ecb.europa.eu/service/data/EXR/D.CAD.EUR.SP00.A",
  });
  observations.push({
    ...latestFuel,
    id: "old-fuel-observation",
    observation_date: "2026-09-01",
  });

  const result = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: fixture.provisions,
    observations,
    asOf: fixture.asOf,
  });
  const coverage = new Map(result.historicalObservationCoverage.map((item) => [item.indicatorId, item]));
  const fuel = coverage.get("fuel.jet.us.gulf_coast");
  assert.equal(fuel.status, "partial_coverage");
  assert.equal(fuel.observationCount, 3);
  assert.equal(fuel.duplicateDateCount, 1);
  assert.equal(fuel.revisionRecordCount, 1);
  assert.equal(fuel.expectedPeriodicity, "weekly");
  assert.equal(fuel.gapsExceedingExpectedCadence.length, 1);
  assert.equal(fuel.gapsExceedingExpectedCadence[0].from, "2026-09-01");
  assert.equal(fuel.gapsExceedingExpectedCadence[0].to, "2026-10-30");
  assert.equal(coverage.get("fx.eur.chf").status, "unverified_source");
  assert.equal(coverage.get("fx.eur.chf").unverifiedRecordCount, 1);
  assert.equal(coverage.get("fx.eur.gbp").status, "inconsistent_units");
  assert.equal(coverage.get("fx.eur.gbp").inconsistentUnitCount, 1);
  assert.equal(coverage.get("fx.eur.cad").status, "inconsistent_currency");
  assert.equal(coverage.get("fx.eur.cad").inconsistentCurrencyCount, 1);
  assert.equal(coverage.get("fx.eur.nzd").status, "insufficient_history");
  assert.equal(fuel.intendedUse, "descriptive monitoring only; not statistical model eligibility");
  assert.equal(result.contractualAssessments.find((item) => item.contractTitle === "Synthetic Gulf Coast Lease").observation.value, 2.5);
});

test("fails closed for unverified, forecast, wrong-unit, malformed-date, wrong-currency, and unknown-source observations", () => {
  const mutations = [
    (item) => { item.data_quality_status = "unverified"; },
    (item) => { item.record_type = "forecast"; },
    (item) => { item.unit = "EUR per USD"; },
    (item) => { item.observation_date = "2026-02-30"; },
    (item) => { item.quote_currency = "EUR"; },
    (item) => { item.currency = null; },
    (item) => { item.source_id = "unknown"; },
    (item) => { item.source_reference = "https://data-api.ecb.europa.eu/service/data/EXR/D.GBP.EUR.SP00.A"; },
    (item) => { item.publication_timestamp = "not-a-timestamp"; },
    (item) => { item.retrieval_timestamp = null; },
    (item) => { item.update_status = "overwritten"; },
  ];
  for (const mutate of mutations) {
    const observations = [structuredClone(fixture.observations[2])];
    mutate(observations[0]);
    const result = deriveAviationExternalRiskIntelligence({
      organizationId: fixture.organizationId,
      provisions: [fixture.provisions[1]],
      observations,
      asOf: fixture.asOf,
    });
    assert.equal(result.contractualAssessments[0].observation, null);
  }
});

test("rejects cross-organization provisions and excludes unverified or non-aviation findings", () => {
  const crossTenant = structuredClone(fixture.provisions[0]);
  crossTenant.organization_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.throws(() => deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [crossTenant],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }), /cross-organization/);

  const unverified = structuredClone(fixture.provisions[0]);
  unverified.evidence_review_status = "pending";
  const nonAviation = structuredClone(fixture.provisions[0]);
  nonAviation.classification.type = "OTHER";
  const result = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [unverified, nonAviation],
    observations: fixture.observations,
    asOf: fixture.asOf,
  });
  assert.equal(result.contractualAssessments.length, 0);
});

test("keeps historical observations append-only and queries provision evidence in organization scope", async () => {
  const calls = [];
  const repository = createExternalAviationObservationRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: 2, rows: [] };
    },
  });
  const observations = fixture.observations.slice(0, 2);
  const insertResult = await repository.insertObservations(observations);
  assert.equal(insertResult.inserted, 2);
  assert.match(calls[0].sql, /on conflict do nothing/i);
  assert.doesNotMatch(calls[0].sql, /do update/i);
  assert.match(calls[0].sql, /then 'revision' else 'recorded'/i);
  assert.equal(calls[0].values.length, observations.length * 16);

  await repository.listVerifiedContractProvisions(fixture.organizationId, {
    contractId: fixture.provisions[0].contract_id,
    analysisRunId: fixture.provisions[0].analysis_run_id,
  });
  assert.equal(calls[1].values[0], fixture.organizationId);
  assert.equal(calls[1].values[2], fixture.provisions[0].contract_id);
  assert.equal(calls[1].values[3], fixture.provisions[0].analysis_run_id);
  assert.match(calls[1].sql, /clause\.document_version_id = run\.document_version_id/);
  assert.match(calls[1].sql, /evidence\.document_version_id = clause\.document_version_id/);
  assert.match(calls[1].sql, /evidence\.analysis_run_id = clause\.analysis_run_id/);
  assert.match(calls[1].sql, /evidence\.review_status = 'verified'/);
  assert.match(calls[1].sql, /run\.organization_id = \$1/);
  assert.match(calls[1].sql, /left join lateral/i);
  assert.match(calls[1].sql, /obligation\.document_version_id = clause\.document_version_id/);
  assert.match(calls[1].sql, /obligation\.analysis_run_id = clause\.analysis_run_id/);
  assert.match(calls[1].sql, /obligation\.obligation_type = 'payment'/);
  assert.match(calls[1].sql, /obligation\.review_status = 'verified'/);
  assert.match(calls[1].sql, /obligation_link\.support_type = 'supports'/);
  assert.match(calls[1].sql, /obligation_source\.review_status = 'verified'/);

  await repository.listRecentObservations();
  assert.deepEqual(calls[2].values[0], [
    "fuel.jet.us.gulf_coast",
    "fx.eur.usd",
    "fx.eur.gbp",
    "fx.eur.chf",
    "fx.eur.jpy",
    "fx.eur.cad",
    "fx.eur.aud",
    "fx.eur.cny",
    "fx.eur.dkk",
    "fx.eur.hkd",
    "fx.eur.nok",
    "fx.eur.nzd",
    "fx.eur.sek",
    "fx.eur.sgd",
    "interest.us.sofr",
    "inflation.us.cpi.cuur0000sa0",
    "inflation.ea20.hicp.cp00.i15",
  ]);
  assert.match(calls[2].sql, /row_number\(\) over\s*\(\s*partition by indicator_id/i);
  assert.match(calls[2].sql, /observation_rank <= 501/i);
  assert.match(calls[2].sql, /indicator_record_count/i);
});

test("derives only recent distinct-date FX movement and keeps both source observations", () => {
  const current = fixture.observations.find((item) => item.indicator_id === "fx.eur.usd");
  assert.ok(current);
  const provision = fixture.provisions.find((item) => /USD/i.test(item.excerpt));
  assert.ok(provision);
  const previous = {
    ...current,
    id: "synthetic-prior-ecb-usd",
    value: 1.12,
    observation_date: "2026-11-05",
    retrieval_timestamp: "2026-11-06T08:00:00.000Z",
  };
  const result = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: [...fixture.observations.filter((item) => item.indicator_id !== "fx.eur.usd"), previous, current],
    asOf: fixture.asOf,
  });
  const fx = result.contractualAssessments.find((item) => item.category === "fx");
  assert.equal(fx.observation.movement.status, "comparable");
  assert.equal(fx.observation.movement.fromValue, 1.12);
  assert.equal(fx.observation.movement.toValue, Number(current.value));
  assert.equal(fx.observation.movement.fromObservationId, previous.id);
  assert.equal(fx.observation.movement.toObservationId, current.id);

  const staleComparison = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: [
      { ...previous, observation_date: "2026-10-20" },
      current,
    ],
    asOf: fixture.asOf,
  });
  const staleFx = staleComparison.contractualAssessments.find((item) => item.category === "fx");
  assert.equal(staleFx.observation.movement.status, "insufficient_history");
});

test("links only verified same-version obligations and supporting evidence", () => {
  const source = fixture.provisions.find((item) => /USD/i.test(item.excerpt));
  const provision = {
    ...source,
    obligation_id: "verified-payment-obligation",
    obligation_description: "Pay the cited USD amount by the stated date",
    obligation_review_status: "verified",
    obligation_evidence_id: "verified-obligation-evidence",
    obligation_page_number: 8,
    obligation_source_locator: "Payment obligation",
    obligation_excerpt: "The Lessee shall pay USD 1,250,000 on 2026-12-01.",
    obligation_evidence_review_status: "verified",
  };
  const result = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [provision],
    observations: fixture.observations,
    asOf: fixture.asOf,
  });
  const fx = result.contractualAssessments.find((item) => item.category === "fx");
  assert.equal(fx.obligationId, provision.obligation_id);
  assert.equal(fx.obligationReviewStatus, "verified");
  assert.equal(fx.obligationEvidence.evidenceId, provision.obligation_evidence_id);

  const unverified = deriveAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    provisions: [{ ...provision, obligation_evidence_review_status: "pending" }],
    observations: fixture.observations,
    asOf: fixture.asOf,
  }).contractualAssessments.find((item) => item.category === "fx");
  assert.equal(unverified.obligationId, null);
  assert.equal(unverified.obligationEvidence, null);
});

test("reads only through organization-scoped repositories and handles empty external history", async () => {
  const calls = [];
  const result = await readAviationExternalRiskIntelligence({
    organizationId: fixture.organizationId,
    contractId: fixture.provisions[0].contract_id,
    analysisRunId: fixture.provisions[0].analysis_run_id,
    asOf: fixture.asOf,
    repository: {
      async listVerifiedContractProvisions(organizationId, filters) {
        calls.push({ organizationId, filters });
        return [fixture.provisions[0]];
      },
      async listRecentObservations() {
        return [];
      },
    },
  });
  assert.deepEqual(calls, [{
    organizationId: fixture.organizationId,
    filters: {
      contractId: fixture.provisions[0].contract_id,
      analysisRunId: fixture.provisions[0].analysis_run_id,
    },
  }]);
  assert.equal(result.coverage.currentCompletedAviationRunsOnly, false);
  assert.equal(result.observations.length, 0);
  assert.equal(result.contractualAssessments[0].observation, null);
  assert.equal(result.contractualAssessments[0].calculation.status, "not_calculated");
  assert.equal(result.sourcePolicy.fuel.status, "unavailable");
});
