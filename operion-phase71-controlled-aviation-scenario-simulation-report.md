# Operion Phase 71 — Controlled Aviation Scenario Simulation

## 1. Executive summary

Phase 71 adds a bounded, deterministic FX scenario comparison to the existing aviation external-risk and Contract Workspace workflow. It reuses Phase 64's cited-payment and verified-ECB sensitivity calculation for each user-defined rate; it does not introduce another calculation engine, forecast, probability, or cross-category risk score.

An authorized user can compare one to four labelled quote-rate assumptions against the same current reference observation and contract payment. The results carry an ephemeral scenario identifier, organization and contract-version scope, methodology, evidence references, assumptions, timestamp, calculated EUR reference equivalents and differences, an impact explanation, and an evidence-linked recommendation. The existing synthetic lease Demo shows three editable, explicitly synthetic assumptions.

The scenario readiness gate is satisfied for this narrow read-only calculation. Scenarios are not persisted: no existing durable FX scenario store is available, Phase 62's append-only tables are specifically for forecast snapshots and outcomes, and adding scenario persistence would require a new schema. Comparisons remain available in the active workspace view only.

## 2. Phase 70 and prior architecture review

Reviewed the Phase 70 report and the Phase 62–69 reports, including the Phase 64 FX implementation and the Phase 62 outcome persistence boundary. Source inspection verified:

- The FX payment assessment is derived from a verified current-version contractual provision with an explicit foreign-currency amount and due date.
- The sensitivity calculation requires a supported currency, matching current verified ECB observation, matching units and source, current contract version, and a cited clause/evidence location.
- ECB quote convention is quote-currency units per EUR. For payment amount `P` and quote `R`, the EUR reference equivalent is `P / R`.
- The existing API uses authentication, organization membership, and `contract:read`. The sensitivity handler re-reads the assessment through the organization-scoped external-risk repository using the path contract ID and optional analysis-run ID; callers cannot supply an organization ID in the scenario payload.
- Contract, analysis-run, clause, and document-version scope is carried by the verified assessment. An extracted obligation ID is included when available; the explicit payment clause and its verified citation remain the contractual basis.
- Phase 69's evaluator applies only to eligible saved deterministic utilisation snapshots and later verified utilisation outcomes. Phase 64 FX sensitivities are user assumptions, not comparable forecasts, and are not eligible for outcome-accuracy metrics.
- Phase 70's browser and live database/RLS acceptance remained unverified. Phase 62 reports migration 028 as not applied at the time and Phase 63 records migration 027's applied status as unknown. This Phase 71 change requires neither migration.

No identified Phase 69 or 70 limitation blocks a read-only FX reference comparison. Production database availability, live user authorization, and RLS still require separate acceptance.

## 3. Scenario readiness assessment

| Readiness condition | Finding |
|---|---|
| Relevant contractual obligation | **Supported for eligible records:** an explicit foreign-currency payment amount and due date are extracted from a cited, verified contractual provision. A separate verified obligation ID is attached when available; no obligation relationship is invented. |
| Contract-version scope | **Satisfied in the existing read path:** contract, analysis run, clause, and document version are tied to the assessment returned by the organization-scoped read. |
| Calculation inputs | **Satisfied conditionally:** payment amount/currency/date, verified clause citation, and a current matching ECB observation are required. Missing, mismatched, unverified, or stale inputs fail closed. |
| Baseline observation | **Supported conditionally:** current verified ECB observation with matching currency pair, quote convention, units, source, indicator, and observation date. |
| Reproducible methodology | **Satisfied:** each scenario calls the existing versioned `phase64-fx-reference-sensitivity-v1` calculation with its explicit input rate. |
| Facts versus assumptions | **Satisfied:** ECB baseline is identified as a verified informational observation; each alternative quote is labeled a user assumption, never a forecast. |
| Explainable impact | **Satisfied within the existing limitation:** explains the reference-equivalent change for one cited payment; it does not imply actual settlement, reporting-currency exposure, incurred loss, hedge impact, or transaction costs. |
| Persistence | **Not available and intentionally deferred:** no compatible existing FX scenario persistence pattern exists. No migration or misuse of utilisation forecast/outcome tables was introduced. |

## 4. Existing services reused

- `deriveAviationFxReferenceSensitivity` remains the sole production calculation and eligibility gate. The new comparison function calls it for each assumption rather than reimplementing FX arithmetic.
- The existing Phase 64 external-risk assessment, public ECB observation repository, and contract/version-scoped provision reader.
- The authenticated `/api/portfolio/aviation-external-risk/:contractId/fx-sensitivity` route, extended compatibly to accept a labelled set while retaining the legacy single-rate request.
- The existing `AviationExternalRiskIntelligence` component, mounted in Contract Workspace and the portfolio view.
- The existing Phase 65 `ContractualExposureAssessment` recommendation/provenance display.
- The synthetic aircraft lease's payment clause, payment obligation, evidence references, and FX reference example.

## 5. Scenario functionality and FX methodology

The existing sensitivity uses:

`EUR reference equivalent = foreign-currency payment amount / (foreign-currency units per EUR)`

For each user-defined scenario:

- `baseline result = payment / verified ECB quote`
- `scenario result = payment / user-assumed quote`
- `signed difference = scenario result − baseline result`
- `absolute difference = |signed difference|`
- `percentage difference = signed difference / baseline result × 100`

Percentage change is available only after the existing positive-payment and positive-rate eligibility checks, so the baseline denominator is strictly positive. Up to four labelled assumptions may be compared against one shared baseline. Invalid rates, empty/oversized sets, mixed legacy/scenario request modes, and invalid labels are rejected. No likelihood, weighting, probability, or forecast is produced.

Each calculated comparison includes an ephemeral scenario ID, organization ID, contract/run/version, optional linked obligation, clause, FX indicator and unit, payment, baseline observation provenance, user assumption, methodology/version, baseline and scenario results, signed/absolute/percentage differences, evidence references, creation timestamp, limitations, and impact explanation.

## 6. Contractual impact and recommendation

The result names the cited payment clause and explains how the hypothetical quote changes that payment's EUR reference equivalent. It expressly distinguishes the assumed quote from the verified baseline and states that the comparison is not a forecast or transaction/settlement amount.

The existing treasury-review recommendation is retained and attached to the contractual citation and external observation reference. It is marked `recommendation_only`; no hedge, transaction, negotiation, or customer action is performed. The recommendation remains advisory, not legal or financial advice.

## 7. API and user experience

- The existing sensitivity endpoint accepts either the legacy single-rate request or one to four labelled `scenarios`, not both.
- Scenario requests are bounded and validated before data reads. The authorized organization is taken from middleware context, not request input.
- The endpoint re-reads the requested assessment under the path contract and authenticated organization before calculating.
- Contract Workspace and portfolio users can label assumptions, add/remove rows up to the four-scenario cap, compare, and inspect results with supporting clause/source references.
- Results remain in React state for the current view only. Leaving the view discards them; the UI explicitly says they are not saved as forecasts or historical assessments.
- No extra dashboard, navigation, external integration, or write route was added.

## 8. Synthetic Demo changes

The synthetic lease Demo now compares editable moderate-adverse, severe-adverse, and favourable quote assumptions against its explicitly synthetic baseline. It shows the baseline and scenario EUR reference equivalents, signed difference, source IDs, payment clause/obligation, a qualified synthetic recommendation, and the Phase 64 method version. The Demo makes clear that all values are synthetic, are not sourced from the ECB, are not forecasts or customer data, and are not persisted.

Tests confirm the adverse assumptions increase the synthetic EUR reference equivalent under the quote convention while the favourable assumption decreases it. These calculations are illustrations only and do not enter customer performance evaluation or predictive calibration.

## 9. Security and data integrity

- Authentication, organization membership, and `contract:read` remain enforced by the existing portfolio router.
- Contract ID and optional analysis-run ID constrain the repository read; the assessment must be present in that scoped result before scenario calculation.
- The calculation receives organization scope from the authenticated request context. Cross-organization scope is rejected by the existing scope assertion and covered by service tests.
- Current document-version, verified clause evidence, current verified observation, matching source, indicator, currency, and unit remain required.
- Scenario generation performs no database writes and does not mutate the source assessment. Tests verify input immutability.
- This repository's relevant tenant authorization boundary is organization scope; no separate tenant identifier was added or inferred.
- Live organization/RLS behavior remains unverified. Automated scope tests do not replace database-backed authorization acceptance.

## 10. Exact verification results

| Check | Result |
|---|---|
| Phase 62–70 related backend and Demo suites: external-risk/FX, predictive-contract-risk, outcomes, lease financial exposure, lease recommendations, lease risk assessment, contract portfolio intelligence, aviation contract-intelligence acceptance, and Demo journey | **138 passed, 0 failed** |
| Frontend production build (`npm.cmd run build`) | **Passed**; Vite emitted its existing advisory for minified chunks over 500 kB |
| `node --check` on changed backend service, route, and test files plus Demo logic and tests | **Passed** |
| `git diff --check` and whitespace checks for new task files | **Passed** |
| Browser acceptance | **Not completed:** the browser could not connect to the local Vite server; browser navigation timed out and the shell probe returned 502 |
| Live database/RLS or authenticated cross-organization acceptance | **Not run** |
| Migration, production operation, deployment, commit, or push | **Not performed** |

The test fixtures are synthetic. Test success demonstrates validation and calculation behavior, not availability or correctness of any particular production customer's contract or current external observation.

## 11. Known limitations

- The EUR outputs are ECB reference-rate equivalents, not organization reporting-currency exposure, transaction price, actual settlement, realized loss, or hedge-adjusted value.
- The current source's freshness policy remains the existing per-indicator policy; no universal freshness threshold was added.
- Scenario IDs/timestamps are ephemeral. Scenarios are not saved, shared across sessions, or included in backtesting.
- A linked extracted obligation ID may be absent even when the verified cited clause explicitly states the payment. The clause evidence, not an invented obligation link, is the operative contract basis.
- Current deployment identity, organization access, source-observation availability, database migration state, and RLS policies were not live-verified.

## 12. Commercial demonstration readiness

The existing synthetic Demo now demonstrates the controlled baseline → assumption → calculated impact → evidence-linked recommendation journey and is suitable for a clearly labelled product demonstration. The authenticated workspace implementation is ready for authorized non-production acceptance against a real, reviewer-approved contract with a fresh matching observation. It is **not yet production-acceptance verified**, and it does not demonstrate a predicted exchange rate or a customer's actual financial loss.

## 13. Recommended Phase 72

After authorized non-production identity and database access are available, validate the existing FX scenario flow end-to-end: verified payment extraction, current observation freshness, contract/version and organization isolation, browser interaction, and source/evidence traceability. Separately decide whether customers need durable scenario history; only then define review, retention, correction, and access rules and seek approval for a minimal persistence design. Do not add probabilities or market forecasts without justified data and methodology.
