# Operion Phase 64 — Predictive Risk Intelligence

## Executive summary

Implemented one deterministic, contract-linked FX reference sensitivity in the existing aviation external-risk flow. It compares a verified foreign-currency payment with a current, matching ECB EUR reference observation and an explicitly entered alternative rate. The alternative rate is an assumption, not a forecast; the resulting EUR values are reference equivalents, not an actual liability, settlement amount, or customer reporting-currency value.

The existing portfolio/workspace surface and authenticated API are reused. The synthetic Demo now shows the same kind of calculation with clearly labelled synthetic clause evidence and rates. No probability, prediction, external customer-data call, or persistence was added.

## Selected improvement

FX was the most supportable deterministic vertical slice among the existing external-risk relationships:

- The existing service can identify an explicit foreign-currency payment amount and due date from verified current-version aviation clause evidence.
- It can link that payment currency to a current, validated ECB reference observation.
- Fuel exposure still lacks an applicable contractual adjustment formula and quantities. Floating-rate exposure still lacks principal, reset dates, and accrual conventions. Neither currently supports a defensible calculation.

The Phase 64 calculation therefore covers one cited payment only. It does not annualize, aggregate, infer a hedge, or claim a loss.

## Implementation

The existing external-risk service exports a deterministic sensitivity calculation. For payment amount `P`, current ECB quote rate `R`, and user-entered scenario quote rate `S` (both in quote-currency units per EUR), it calculates:

- Reference equivalent: `P / R`
- Scenario equivalent: `P / S`
- Difference and percentage change between those reference equivalents

The result is produced only when the payment amount and due date, verified clause/evidence location, current document version, and a current matching ECB observation are available. Missing or stale evidence returns `insufficient_evidence`; invalid or out-of-range scenario rates are rejected. The result retains contract, analysis-run, version, clause, and evidence identifiers plus the observation source and date.

The external-risk panel offers the calculation in both the existing contract and portfolio views. Users enter a scenario rate; nothing is calculated automatically from an assumed future rate. The output recommends treasury review and explicitly discloses the limitations. It does not alter the underlying external-risk assessment.

The Demo includes one synthetic maintenance-reserve payment clause, a synthetic page citation, and a local user-adjustable rate example. The example makes no external provider request and does not add its amount to existing financial totals.

## Evidence, security, and persistence

- Contract amounts/dates remain contractual facts from verified clause evidence; the alternative rate is explicitly identified as a user assumption.
- ECB values are used only as informational reference rates, not contractual benchmarks or transaction prices.
- The result is not described as an actual exposure, forecast, probability, or legal/financial advice.
- The new POST endpoint is under the existing authenticated portfolio router, which requires organization membership and `contract:read`. It reads the requested contract through the existing organization-scoped repository and only calculates for an assessment returned by that scoped read.
- The calculation is read-only and not stored. No migration or Phase 62 forecast snapshot was added: this is a user-defined sensitivity, not a forecast, and the existing snapshot workflow covers deterministic utilisation forecasts rather than FX scenarios.

## Files changed

- `services/phase3/intelligence/aviationExternalRiskIntelligenceService.js` — eligibility checks and deterministic calculation.
- `routes/portfolioRoutes.js` — organization-scoped FX sensitivity endpoint.
- `frontend/src/lib/contractsApi.js` — endpoint client.
- `frontend/src/components/intelligence/AviationExternalRiskIntelligence.jsx` — interactive sensitivity for the existing portfolio/workspace surface.
- `frontend/src/demo/aviationIntelligenceJourney.js` — synthetic payment inputs and deterministic example.
- `frontend/src/demo/DemoDataProvider.jsx` — synthetic clause and evidence linkage.
- `frontend/src/routes/demo/DemoIntelligence.jsx` — interactive, disclosed synthetic Demo journey.
- `test/aviation-external-risk-intelligence.test.js` — calculation, evidence, staleness, and invalid-input coverage.
- `frontend/tests/demo-aviation-journey.test.mjs` — synthetic traceability, calculation, and disclosure coverage.

## Verification

| Check | Result |
|---|---|
| `node --test test/aviation-external-risk-intelligence.test.js` | PASS — 10/10 |
| `node --test frontend/tests/demo-aviation-journey.test.mjs` | PASS — 9/9 |
| `npm.cmd run build` in `frontend` | PASS — Vite production build |
| `node --check` for the changed backend route and service | PASS |
| `git diff --check` | PASS |

## Limitations and unverified acceptance

- No live authenticated API, database, RLS, or browser acceptance was run. Existing Phase 51–52 environment and identity blockers remain; this implementation does not claim those checks passed.
- The ECB reference may not match the payment-date settlement rate. Reporting currency, transaction costs, hedge/treasury position, and actual settlement remain unknown.
- No FX scenario history, forecast snapshot, probabilistic model, or backtest is produced.
- Production, migrations, deployment, commit, and push were not performed.

## Recommended Phase 65

Validate the FX sensitivity with authorized non-production identity and database access, including organization isolation and current-version evidence retrieval. Separately assess whether approved organization reporting-currency and treasury inputs can be supplied before extending this reference sensitivity into customer-specific financial exposure.
