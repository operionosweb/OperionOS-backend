# Operion Phase 73 — Aviation Interest-Rate Financing Exposure Intelligence

## Executive summary

Phase 73 adds an evidence-scoped financing assessment to the existing aviation external-risk and Contract Workspace flow. For explicitly identified fixed-rate clauses, the service can calculate a simple annualized balance run-rate from a cited principal and rate. For floating-rate financing, calculations are currently limited to USD facilities explicitly referencing SOFR, with a matching fresh verified New York Fed observation and explicit contractual spread, reset frequency, and any stated cap or floor. A bounded scenario comparison is available in the existing Workspace.

The implementation reuses the existing external-observation and FX scenario architecture, adds no database migration, and does not persist scenario comparisons as forecasts. It does not calculate accrued or payable interest, scheduled cash flows, or hedge-adjusted costs. Other floating benchmarks are recognized but fail closed because matching verified observations are not implemented. The implementation is therefore a useful demonstrable slice, not complete multi-benchmark financing intelligence.

## 1. Architecture inspected and reused

- **Phase 64 FX sensitivity:** Reused the external-risk service's evidence-scoped assessment structure and bounded scenario-comparison approach. Financing outputs remain a separate category; they are not added to FX or operational exposures.
- **Phase 68 external observations:** Reused stored, normalized public observations, including the New York Fed SOFR series (`interest.us.sofr`). The calculation checks source, publication record type, verification status, currency, units, market applicability, and freshness.
- **Contract evidence and versioning:** Uses the existing verified clause evidence and current `documentVersionId`/analysis-run scope returned by the external-risk repository. Principal provenance is reported as a cited clause fact only when it comes from that evidence.
- **Predictive-risk integration:** Adds financing exposure to the existing predictive contract-risk assessment as its own assessment; it does not combine it numerically with FX or utilisation.
- **Workspace and Demo:** Extends the existing Contract Workspace external-risk component and the existing synthetic aviation Demo. No new product module or page was added.
- **Persistence:** Financing calculations are derived from existing evidence and observations. SOFR scenario comparisons are ephemeral. No schema, migration, or persistence mechanism was added.

The new implementation is principally in:

- `services/phase3/intelligence/aviationExternalRiskIntelligenceService.js`
- `services/phase3/intelligence/aviationPredictiveContractRiskService.js`
- `routes/portfolioRoutes.js`
- `frontend/src/components/intelligence/AviationExternalRiskIntelligence.jsx`
- `frontend/src/demo/aviationIntelligenceJourney.js`
- `frontend/src/demo/DemoDataProvider.jsx`
- `frontend/src/routes/demo/DemoIntelligence.jsx`
- `frontend/src/components/demo/OperionAssistant.jsx`

## 2. Functionality implemented

### Clause classification and terms

The service recognizes explicit fixed and floating financing language and parses supported evidence for:

- Principal and currency.
- SOFR and contractual spread.
- Reset frequency.
- Fixed annual rate.
- Explicit interest-rate cap and floor.
- Mentions of hedging and rate protection, which are disclosed but not quantified.

Ambiguous rate language, missing terms, incompatible currencies, unavailable observations, and invalid or contradictory protections prevent calculation or remain review-required. The floor parser handles both an explicitly repeated rate subject and a coordinated clause such as “the interest rate shall not exceed … and shall not fall below …”.

### Deterministic annualized run-rate

Method identifier: `phase73-simple-annualized-financing-run-rate-v1`.

- Floating rate before protections = verified SOFR percentage + spread basis points / 100.
- Apply an explicit floor, then an explicit cap.
- Annualized run-rate = positive cited principal × applicable annual rate / 100.
- Fixed-rate clauses use the explicit fixed annual rate and cited principal.

These are gross simple annualized balance run-rates. They are **not** accrued interest, a payment amount, a forecast, or a full contract cash-flow calculation. No amortization, compounding, day-count convention, fees, taxes, payment schedule, or hedge offset is inferred.

For floating-rate assessments, a SOFR observation is usable only when it is a fresh (maximum seven-day age) verified published observation from the New York Fed, is in USD percent per annum, and names the matching SOFR indicator and market applicability.

### Bounded scenarios

The authenticated endpoint `POST /aviation-external-risk/:contractId/interest-sensitivity` accepts one to four labelled SOFR assumptions from 0% to 100%, a positive bounded principal, and a verified assessment identifier. The service checks that the selected assessment belongs to the requested organization-scoped contract/version and that the observed reference-rate basis is applicable. Principal supplied by the user is marked as an assumption unless it exactly matches the cited clause value. Scenario results include calculation method, assumptions, clause/observation references, and limitations; they are not saved as forecast snapshots.

### Workspace and recommendations

The existing Workspace shows the financing classification, missing inputs or calculated annualized run-rate, applicable rate, evidence context, and an interactive SOFR scenario comparison. The displayed recommendation is a deterministic review prompt tied to the cited financing terms; it is not legal advice or a definitive conclusion. Recommendations are rule/template driven rather than AI-generated.

### Predictive-risk and Demo

Financing exposure flows into the existing predictive-risk results as a distinct assessment, without an aggregate score or FX/operational double-counting.

The existing Demo includes a separate synthetic aircraft-financing agreement, clause, obligation, evidence references, SOFR baseline, cap/floor, and bounded scenarios. Inputs are explicitly synthetic and are not represented as a live observation or customer record. The illustration uses USD 10,000,000 principal, 250 bps spread, 3.92% synthetic SOFR, a 1.00% floor, and a 7.50% cap. Its baseline applicable rate is 6.42%, or a USD 642,000 simple annualized run-rate. A +1 percentage-point SOFR assumption gives 7.42% / USD 742,000; a +2-point assumption is capped at 7.50% / USD 750,000. These figures are illustrative only.

## 3. Limitations and unresolved requirements

- **Benchmark coverage:** Only SOFR has a matching stored public-observation integration. SONIA, EURIBOR, and other benchmarks are not substituted and cannot currently produce a floating-rate calculation.
- **Interest conventions:** There is no daily accrual, compounding, day-count, amortization, or scheduled-payment calculation. Reset frequency is parsed and disclosed but does not change the simple annualized formula.
- **Hedges:** Hedge language is surfaced, but hedge notionals, effectiveness, cost, and offsets are not calculated.
- **Outstanding balance verification:** A principal extracted from the verified clause is auditable but may not represent the current lender balance. User-supplied principal remains an assumption; lender-statement ingestion/review is not part of this phase.
- **Recommendations:** Recommendations are deterministic, evidence-linked review prompts, not generated AI advice and not legal advice.
- **Persistence and outcome validation:** Scenario comparisons are not append-only historical forecasts, and this work does not establish predictive accuracy or calibration.
- **Acceptance not performed:** No browser-based acceptance, live provider refresh, database/RLS acceptance, or production-like API exercise was performed in this environment. The focused service and route tests are not a substitute for those checks.
- **Existing Demo warning:** The Demo test run emits a React missing-list-key warning from the existing `Risks` render path. Tests pass; the warning is not evidence that the financing calculation failed.

## 4. Security and data integrity

- The portfolio router applies authentication, organization membership, and `contract:read` permission before its routes.
- The new scenario route reads assessments using `req.organization.id` and the requested contract ID, then selects the requested assessment from that scoped result. Missing assessments return a generic unavailable response.
- Input bounds and shape are checked before the scoped data read. The focused tests verify malformed scenario requests are rejected before contract data is read.
- Existing external-risk repository/service checks enforce organization scope, verified clause/evidence status, aviation contract classification, and document-version scope. Focused tests cover rejection of cross-organization provisions and unverified evidence.
- Public market-data collection does not send contract text or identifiers to the provider. No customer contract content is included in SOFR collection requests.
- No migration, destructive database operation, production operation, commit, push, or deployment was performed.

Database/RLS acceptance was not run; tenant guarantees above describe the route/repository design and the focused code tests, not a live database policy verification.

## 5. Tests and build results

Executed from the repository root unless noted:

| Check | Result |
|---|---|
| `node --test test\aviation-external-risk-intelligence.test.js test\aviation-predictive-contract-risk.test.js` | **53 passed, 0 failed** |
| `node --test frontend\tests\demo-aviation-journey.test.mjs` | **16 passed, 0 failed** (React missing-key warning noted above) |
| `node --check` on the external-risk service, predictive-risk service, portfolio route, and Demo journey JS module | **Passed** |
| `npm.cmd run build` in `frontend` | **Passed**; Vite transformed 3,264 modules and completed production output |
| `git diff --check` | **Passed** |

`node --check` does not directly parse `.jsx`; the successful Vite production build compiled the JSX files. The full backend test suite, browser acceptance, live external-provider workflow, and database/RLS rehearsal were not run.

## 6. Recommended next phase

**Phase 74 recommendation: reviewer-approved aviation financing cash-flow assessment for one supported facility type.**

First establish a verified current outstanding balance, contractual reset dates, repayment schedule, compounding/day-count convention, and payment dates from version-scoped evidence. Then implement a deterministic period-by-period interest schedule for one supported benchmark and convention, with evidence eligibility, missing-input handling, and comparison tests. This is higher value than adding many benchmark labels or predictive scoring because the present annualized run-rate is not a contractual payment estimate, and those missing terms determine the actual cash obligation. Keep any hedge-adjusted or forecast result out of scope until the required verified data and methodology are available.
