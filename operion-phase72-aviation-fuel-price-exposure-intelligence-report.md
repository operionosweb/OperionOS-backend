# Phase 72 — Aviation Fuel-Price Exposure Intelligence

## Executive summary

Phase 72 adds a bounded, evidence-backed assessment for aircraft-lease fuel-price adjustment clauses. The existing external-risk assessment now connects a verified, current U.S. Gulf Coast jet-fuel observation to explicit contractual terms and calculates an adjustment only when the required terms and evidence are present.

The assessment is carried through the existing predictive-risk and Demo experiences. Fuel exposure remains a distinct category: it is not added to FX or utilisation values, annualized, treated as a forecast, or described as a settled invoice or net customer exposure.

No database migration, production operation, deployment, commit, or external integration was performed.

## Existing architecture reused

- **External observations:** The existing aviation external-risk observation and source-quality pipeline, including the EIA fuel indicator, freshness checks, and source provenance.
- **Contract assessments:** The existing clause-derived external-risk assessment flow, which scopes reviewed provisions to the current contract version and organization.
- **Predictive risk:** Existing aviation predictive-risk components and early-warning output, extended to carry fuel exposure without combining unlike categories.
- **Demo journeys:** Existing internal Demo data provider, aviation intelligence journey, workspace, financial-impact view, assistant, and public Demo. No separate Demo module or navigation was introduced.

## Implementation

### Assessment and calculation

The supported reference is limited to the EIA indicator `fuel.jet.us.gulf_coast`, in USD per gallon, with a matching U.S. Gulf Coast market, verified published observation, and current freshness. Calculation also requires a verified current-version contractual clause with explicit:

- USD-per-gallon baseline;
- gallons per adjustment period;
- pass-through percentage;
- adjustment period and formula; and
- party responsible for payment.

The deterministic formula is:

`max(0, current reference price - contractual baseline) × explicit gallons × explicit pass-through percentage`

Only the expressly stated period is calculated. The assessment does not infer a rate, volume, payer, formula, or missing contractual consequence. Below-baseline values produce zero adjustment rather than a credit. The resulting figure is a clause-based illustration, not an invoice, settlement decision, net exposure, annualized value, or forecast. Where terms or eligible evidence are absent, the assessment reports missing information and does not calculate.

### API and customer UI

- Fuel assessment details and limitations now flow through existing external-risk assessment and predictive-risk outputs.
- Existing external-risk and predictive-risk interfaces present the calculation or missing inputs, evidence, limitations, and recommended review action.
- Fuel remains distinct from FX and utilisation assessments; no cross-category or cross-currency aggregate is created.

### Demo

The internal and public Demo journeys include one explicitly synthetic aviation example: a fuel-price clause, obligation, recurring deadline, evidence, risk, and separate USD financial illustration. Existing workspace evidence links, assistant responses, financial-impact presentation, and journey navigation support the example. Fuel evidence is explicitly labeled synthetic and is not represented as EIA/live data, customer cost, an invoice, a forecast, or calibration data.

Example terms: baseline USD 2.00/gallon; synthetic reference USD 2.15/gallon; 20,000 gallons/week; 80% pass-through; illustrative result USD 2,400 for one week. This is a synthetic demonstration only.

## Evidence, security, and data integrity

- Assessment inputs remain scoped to organization and reviewed contract/version evidence through the existing assessment path.
- Fuel observations must satisfy the indicator's source, unit, currency, market, verification, publication-record, and freshness requirements before they can support a calculation.
- Contractual and external evidence references are retained with the result and recommendation; missing or invalid inputs fail closed to a non-calculated result.
- Fuel values are not combined with other assessment categories.
- No migration or new persistence mechanism was added, and no confidential contract data was sent to an external service.

Live database/RLS acceptance was not run. Therefore this report does not claim independent live verification of tenant isolation or database policies.

## Files changed

- `services/phase3/intelligence/aviationExternalRiskIntelligenceService.js` — fuel clause term parsing, evidence gates, calculation, and recommendation evidence.
- `services/phase3/intelligence/aviationPredictiveContractRiskService.js` — propagation into existing predictive-risk and warning outputs while preserving category independence.
- `frontend/src/components/intelligence/AviationPredictiveContractRisk.jsx` — predictive-risk display for fuel assessment, inputs, provenance, limitations, and action.
- `frontend/src/components/intelligence/AviationExternalRiskIntelligence.jsx` — external-risk fuel result and missing-input presentation.
- `frontend/src/demo/aviationIntelligenceJourney.js` — synthetic fuel terms, observation, and deterministic calculation.
- `frontend/src/demo/DemoDataProvider.jsx` — synthetic clause, obligation, deadline, risk, evidence, and separate impact item.
- `frontend/src/routes/demo/DemoIntelligence.jsx` — fuel exposure in the existing synthetic aviation journey.
- `frontend/src/components/demo/DemoFinancialImpact.jsx` — item-specific currency and multiple evidence links without cross-category aggregation.
- `frontend/src/routes/demo/DemoWorkspace.jsx` — links for risk evidence citations.
- `frontend/src/components/demo/OperionAssistant.jsx` — synthetic fuel answer and prompt suggestions without fabricated confidence.
- `frontend/src/lib/publicDemoData.js` and `frontend/src/routes/DemoHub.jsx` — public synthetic example and disclosure.
- `test/aviation-external-risk-intelligence.test.js` — calculation eligibility, invalid/mismatched evidence, and below-baseline cases.
- `test/aviation-predictive-contract-risk.test.js` — propagation, distinct assessment, and non-aggregation coverage.
- `frontend/tests/demo-aviation-journey.test.mjs` — calculation, provenance, Demo surfaces, and synthetic disclosure coverage.

## Verification results

| Check | Result |
|---|---|
| Aviation backend regression suites (`test/aviation*.test.js`) | **Passed: 148/148** |
| Focused Demo aviation journey tests | **Passed: 15/15** |
| Frontend production build | **Passed**; Vite processed 3,264 modules and emitted a non-blocking large-chunk warning |
| Backend JavaScript syntax checks | **Passed** for the changed external-risk services and test |
| `git diff --check` | **Passed** |
| Browser acceptance | **Not completed**; local preview endpoints were unreachable/time out |
| Live database/RLS acceptance | **Not run** |

The final backend regression run initially exposed a negative-test fixture that left a second valid observation available. The fixture was corrected to invalidate all observations for the tested indicator; the full aviation suite then passed.

## Limitations and remaining risks

- The supported live assessment is limited to the configured U.S. Gulf Coast EIA fuel indicator; it is not a general fuel-benchmark integration.
- Contract terms are identified from verified clause text but still require human review; the illustration is not legal or financial advice.
- A calculated clause adjustment does not establish an invoice, customer-level net exposure, actual consumption, or settlement.
- Browser behavior and live tenant/RLS controls require acceptance in an environment where the application and database can be reached.
- The frontend build retains a non-blocking large-chunk warning.

## Completion assessment and next phase

The implemented demonstration can show a synthetic fuel-price clause, eligible synthetic benchmark evidence, required calculation inputs, a bounded one-period calculation, provenance, limitations, and a practical review action. It cannot establish actual customer fuel costs, invoice amounts, or live performance from synthetic data.

**Recommended Phase 73:** validate the clause-to-benchmark mapping and calculation presentation with aviation contract reviewers and customer-approved, non-production test evidence. Keep the scope to eligibility, review controls, and auditable evidence; do not broaden benchmark coverage or make predictive claims without approved evidence and a justified methodology.
