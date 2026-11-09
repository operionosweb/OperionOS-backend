# Operion Phase 67 — Aviation Predictive Risk Engine

## Executive summary

Added an evidence-gated, deterministic calendar-year utilisation projection to the existing aviation contractual exposure assessment. The projection reuses verified utilisation history and contractual limits; it does not claim a breach, calculate a penalty without supported contractual terms, or produce a probability. The existing FX reference sensitivity remains separate and is not presented as an FX forecast.

## Implementation

- Reused Phase 55’s deterministic utilisation history, Phase 54’s lease-limit and current-utilisation assessment, and the existing contractual exposure assessment and early-warning presentation.
- Added a versioned `phase67-calendar-year-run-rate-v1` method. It requires a positive contractual calendar-year limit, contiguous verified cumulative observations from January 1, distinct citations, a supported Phase 55 forecast, and fresh current evidence matching the latest historical reading. Incomplete, stale, unverified, misaligned, or invalid inputs produce an insufficient-evidence result.
- Estimates the period-end value by extending the observed calendar-day rate through December 31. The result is a deterministic estimate, not a probability, assured outcome, or finding of breach. Minimum limits remain distinct from maximum limits.
- Exposes the estimate, evidence, assumptions, comparisons, and limitations in the existing aviation predictive-risk UI. A targeted freshness-check correction now measures the age of evidence in the correct direction and rejects future-dated or older-than-30-day observations.
- Added a separate, explicitly synthetic calendar-year lease example to the existing Demo. It preserves the existing term-limit and FX examples and does not imply customer data, live monitoring, production forecasts, persisted snapshots, or backtesting.
- No migration, new external integration, production operation, deployment, commit, or push was performed.

## Synthetic example

The Demo uses a synthetic 1,000-flight-hour calendar-year allowance and 700 recorded synthetic hours through July 31, 2026. Its constant-rate calculation estimates 1,205.19 hours by year-end, an indicative 205.19-hour excess. This is illustrative only; it is not an actual aircraft reading, an established financial charge, or a claim that the allowance will be exceeded.

## Files changed

- `services/phase3/intelligence/aviationPredictiveContractRiskService.js`
- `frontend/src/components/intelligence/AviationPredictiveContractRisk.jsx`
- `frontend/src/demo/aviationIntelligenceJourney.js`
- `frontend/src/demo/DemoDataProvider.jsx`
- `frontend/src/routes/demo/DemoIntelligence.jsx`
- `test/aviation-predictive-contract-risk.test.js`
- `frontend/tests/demo-aviation-journey.test.mjs`
- `operion-phase67-aviation-predictive-risk-engine-report.md`

## Verification

- `node --test test/aviation-predictive-contract-risk.test.js` — **28 passed, 0 failed**.
- `node --test frontend/tests/demo-aviation-journey.test.mjs` — **11 passed, 0 failed**.
- Related lease-risk, outcome/backtesting, and financial-exposure suites — **38 passed, 0 failed**.
- `node --check services/phase3/intelligence/aviationPredictiveContractRiskService.js` — passed.
- `git diff --check` — passed.
- `npm.cmd run build` in `frontend` — passed. Vite emitted a large-chunk advisory (including the Cesium widgets chunk); this did not fail the build.

## Limitations and unverified acceptance

- Projection is supported only for explicit calendar-year limits with sufficiently complete evidence from the calendar-year boundary. Lease-year periods and other measurement periods fail closed.
- The new annualised projection is not persisted as a Phase 62 snapshot and is not included in outcome backtesting. Existing Phase 62 snapshot/backtesting behavior for supported Phase 55 threshold-date forecasts remains unchanged.
- The estimate assumes a constant observed rate and does not model seasonality, revised flight plans, operational disruption, or future conditions. It calculates no financial exposure unless separately supported contractual formulae and inputs are available.
- The Demo is synthetic. Production database, RLS, tenant acceptance, and browser acceptance were not verified. The previously documented browser endpoint was unavailable; no infrastructure blocker was bypassed.

## Recommended Phase 68

Define and implement append-only, contract-version-scoped snapshots for this projection, including the reviewer and evidence provenance needed to compare later verified actual outcomes. Keep the new method out of accuracy or calibration claims until sufficient eligible outcomes have been recorded and evaluated.
