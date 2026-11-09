# Phase 74 - Aviation Inflation and Contractual Indexation Intelligence

## Status and initial assessment

**Implemented and release-integrated; live database acceptance remains incomplete.** Isolated Chromium acceptance passes for the built Demo on desktop and mobile. Live authenticated application, database/RLS and publishing acceptance remain unverified. Migration 029 is prepared, not applied. Following renewed explicit authorization to push production `main`, the separate integration worktree's eight conflicts were resolved while preserving the existing Matt experience and globe. The candidate is validated for a normal fast-forward push; the resulting commit and Vercel deployment status are reported separately. The Blog workstream and unpublished editorial drafts are reported separately in [the Blog commercial-readiness report](operion-blog-commercial-readiness-and-seo-report.md).

Inspected the Phase 64, 67, 70, 71, 72 and 73 reports and their actual external-risk, observation repository, deterministic clause, predictive-risk, Workspace and synthetic Demo implementation. Existing source ingestion supports fuel, FX and SOFR, not inflation. The existing external-observation table explicitly restricts categories to fuel, FX and interest. Existing clause extraction already retains pricing/escalation evidence; there is no need to replace that stage. Phase 71 supplies a useful bounded, ephemeral assumption-comparison pattern; its utilisation forecast tables are not an appropriate indexation scenario store.

The implementation extends those paths. It does not create another risk engine, forecast store, dashboard, probabilistic model or customer-data integration.

## Implemented functionality

### Contractual terms

`shared/aviationIndexation.js` is the pure deterministic term/calculation helper used by the existing external-risk service and the synthetic Demo. It extracts explicit supported terms from verified clause excerpts:

- Fixed-price, fixed annual escalation, indexed or partially indexed arrangements.
- Exact CPI/HICP series identity, geography/base, baseline and reference month.
- Baseline price/currency/payment period and indexed share.
- Explicit annual frequency, adjustment date and calendar-day notice.
- Adjustment caps/floors and an expressly stated absolute-index-change threshold.
- Mentions of retroactivity and index substitution, which require further review rather than silently changing the formula.
- A stated customer payment provision, where present. This does not establish downstream recoverability.

Unknown labour/material/producer-cost mechanisms and unsupported index identities are surfaced for review, not mapped to CPI. Fixed-price clauses are not turned into inflation exposure. Conflicting fixed/indexed terms, duplicated key terms and contradictory index families fail closed.

**Parsing boundary:** calculation currently requires explicit supported labels and the exact index-ratio formula, illustrated below. This is not a general natural-language formula interpreter. Unsupported wording remains visible as an incomplete/review-required assessment; human verification remains necessary.

### Exact-series observations and review controls

Supported registry entries:

| Contractual series | Geography/base | Verification path |
|---|---|---|
| BLS `CUUR0000SA0`, CPI-U all items, US city average, not seasonally adjusted | United States; 1982-84=100 | Platform administrator reviews the official publication |
| `HICP.EA20.CP00.I15`, Eurostat HICP all items | Euro area 20; 2015=100 | Platform administrator reviews the exact geography, unit/base and publication |

No observations were invented, fetched into production or imported during development. No new automatic feed or paid provider was introduced. Existing public-source refresh continues to collect its existing fuel/FX/SOFR sources only.

`POST /api/system/inflation-observations` is protected by the existing authenticated **platform-superadmin** middleware. Ordinary organization writers cannot insert data into the shared public-observation store. It requires the exact supported series, value, completed reference month, publication timestamp, official source URL, units, geography and explicit human source-review confirmation. The administrator's identity and review timestamp are recorded. The result is a **platform-reviewer-verified publication**, not a claim that the system independently fetched and verified an official feed.

The existing append-only repository persists reviewed records and retains revisions without updating prior records. Reads can tolerate the absence of the new review columns, allowing legacy fuel/FX/interest reads before migration 029. Inflation inserts fail explicitly until the migration is approved and applied.

Example administrative payload (values below are synthetic and must NOT be imported as actual official data):

```json
{
  "seriesId": "CUUR0000SA0",
  "period": "2026-09",
  "value": 315,
  "publicationTimestamp": "2026-10-15T12:30:00Z",
  "sourceReference": "https://data.bls.gov/timeseries/CUUR0000SA0",
  "unit": "index 1982-84=100",
  "geography": "United States",
  "reviewConfirmed": true
}
```

The observation date stores the **first day representing a reference month**, not a claim of a daily observation. A matching published, reviewed monthly level is required; the maximum age is 75 days measured from that month boundary. The contractual reference month must equal the selected current observation's month. Other months, units, geographies, bases and indices are not substituted.

### Calculation methodology

Method: `phase74-explicit-index-ratio-v1`.

For baseline price `P`, contractual baseline index `I0`, current exact-series index `I1`, and explicitly indexed share `s`:

1. Index change = `I1 / I0 - 1`.
2. Where specified, an absolute-index-change threshold must be exceeded before an adjustment applies.
3. Unprotected adjustment = `s * index change`.
4. Apply the expressly stated adjustment floor, then the adjustment cap.
5. Revised price = `P * (1 + contractual adjustment)`.
6. Incremental cost = rounded revised price minus baseline price.

The explicit supported clause formula is:

`Adjustment formula: baseline price * (1 + indexed share * (current index / baseline index - 1))`

Annual indexed comparisons require reference months exactly twelve months apart and an adjustment date after the reference month. A fixed annual escalation uses its stated percentage without a market observation. Amounts retain the stated payment period; no annualization, currency conversion, invoice liability, accumulated multi-year charge, hedge, or downstream recovery is inferred.

The contract may establish who pays the revised price. The service does **not** call that amount net recoverable exposure or calculate a downstream offset without evidence.

### Workspace, portfolio and predictive risk

The existing external-risk API and Workspace component expose classification, formula inputs, original/revised price, incremental cost, cap/floor, adjustment date, notice-review date, evidence, limitations and recommendations. The portfolio includes an independent inflation category without adding unlike exposures.

The existing predictive-risk service carries the same calculation and clause facts in a version-scoped `inflation_external_risk_sensitivity` assessment. Adjustment dates are supplied through the existing attention-date path. Uncapped arrangements generate a review prompt about cap negotiation and cost allocation. Recommendations remain rule-based advisory actions, not generated legal advice, guaranteed savings or performed customer actions.

`POST /api/portfolio/aviation-external-risk/:contractId/indexation-sensitivity` reuses the authenticated organization-scoped assessment lookup and bounded comparison pattern. It accepts one to four labelled positive alternative index levels, applies the same shared formula and returns baseline, alternative price, difference, assumptions, method, contract/version, evidence references, creation timestamp and limitations. Scenarios are ephemeral, explicitly not forecasts, and are not written into forecast/outcome history.

## Synthetic Demo

The existing MRO Demo contract now has a complete indexation journey, not an empty template: clause, obligation, notice review deadline, evidence, risk, separate financial illustration and deterministic assistant explanation.

- Synthetic baseline price: USD 100,000 per year.
- Synthetic September baseline index: 300; subsequent September index: 315.
- Indexed share: 80%; index movement: 5%; weighted change: 4%.
- Explicit cap: 3%; floor: 0%; threshold: absolute index movement exceeds 1%.
- Revised synthetic annual price: USD 103,000; incremental price: USD 3,000.
- Synthetic adjustment date: 2027-01-01; thirty-day notice review: 2026-12-02.
- Alternative index 306 produces USD 101,600; 330 remains capped at USD 103,000; 294 is floored at USD 100,000.

The existing Demo intelligence page has an editable index-level assumption, linked MRO Workspace sections and explicit synthetic publication/provenance disclosures. The public Demo also explains the MRO example and links to the full journey. All values and publication/review states are explicitly fabricated for demonstration, not official BLS observations, customer performance or calibration evidence. Existing fuel, FX, financing and utilisation examples remain independent.

## Files changed for this phase

- `shared/aviationIndexation.js`
- `services/phase3/intelligence/inflationObservationReview.js`
- `services/phase3/intelligence/aviationExternalRiskIntelligenceService.js`
- `services/phase3/intelligence/aviationPredictiveContractRiskService.js`
- `repositories/phase3/externalAviationObservationRepository.js`
- `routes/systemRoutes.js`
- `routes/portfolioRoutes.js`
- `supabase/migrations/029_inflation_observation_review.sql`
- `frontend/src/lib/contractsApi.js`
- `frontend/src/components/intelligence/AviationExternalRiskIntelligence.jsx`
- `frontend/src/demo/indexationJourney.js`
- `frontend/src/demo/DemoDataProvider.jsx`
- `frontend/src/routes/demo/DemoIntelligence.jsx`
- `frontend/src/components/demo/OperionAssistant.jsx`
- `frontend/src/lib/publicDemoData.js`
- `frontend/src/routes/DemoHub.jsx`
- `test/aviation-indexation-intelligence.test.js`
- `test/aviation-external-risk-intelligence.test.js`
- `frontend/tests/demo-aviation-journey.test.mjs`
- `frontend/tests/phase74-browser.test.mjs`
- This report.

Earlier OCI/Blog functionality is present as pre-existing uncommitted local work. Production integration must account for those dependencies while preserving current upstream Matt/globe changes; this working directory is not itself the production branch.

## Security and integrity

- Existing organization membership and contract-read authorization protect calculations. The API re-reads the requested assessment under the authorized organization and contract scope rather than trusting caller-supplied clause facts.
- The new scenario helper rejects cross-organization assessments. The existing repository joins contract, analysis run, clause and evidence on organization/version scope.
- Shared publication ingestion is platform-superadmin only; no tenant can poison another tenant's common source data via ordinary contract-write permission.
- Source URLs, units, geography, index identity, publication timing, review identity, freshness and contractual reference month are validated.
- No confidential contract text is transmitted externally. There is no new external source request in this phase.
- Historical observation rows are not rewritten. User assumptions remain distinct from reviewed publications and original contractual evidence.
- Migration 029 is necessary because migration 027 disallows inflation and has no reviewer identity/timestamp. It changes only the Operion public-observation table and preserves its service-role-only grants/RLS; no OCI migration boundary is changed. **No migration was applied.**

## Verification

| Check | Result |
|---|---|
| Final full aviation regression batch | 185 passed, 0 failed |
| Production-integrated changed-file backend suites | 470 passed, 0 failed across 32 files, including aviation, pipeline, document ingestion, profile, deadline, obligations, financial impact, Blog, deployment-source and frontend-source checks |
| Production-integrated focused aviation/profile/deadline/Blog command | 333 passed, 0 failed; overlaps the changed-file command |
| Production-integrated Matt shared-context/configuration tests | 3 passed, 0 failed; HTTP-backed Matt tests could not connect to loopback and were stopped, not counted as passing |
| Final focused indexation plus complete Demo tests | 50 passed, 0 failed (33 indexation + 17 Demo) |
| Final combined indexation, Demo, Blog CMS and SEO regression command | 67 passed, 0 failed; overlaps the above suites, not additional independent coverage |
| Production frontend build | Passed; Vite large-chunk advisory remains |
| Isolated built-frontend Chromium acceptance | 2 passed, 0 failed: desktop editable assumptions and blank-input rejection; mobile MRO evidence drawer, synthetic disclosure and no horizontal overflow |
| Isolated Blog SSR Chromium acceptance | 5 passed, 0 failed; actual SSR functions/styles with synthetic in-memory API fixtures at four viewports plus JavaScript-disabled mobile rendering |
| Existing corporate browser suite | Blocked: 27 navigation failures with `ERR_NETWORK_ACCESS_DENIED`; Chromium now launches, but socket-backed application acceptance remains unavailable |
| Backend/shared JS and browser-test syntax; git whitespace | Passed; original working tree index remains empty |
| Browser-to-server and live authenticated acceptance | Unverified: Vite reported ready on port 5180, but localhost/network browser requests and the local HTTP readiness request timed out |
| Live database/RLS/migration acceptance | Not executed; no production DB or schema operations |

The actual clause extractor is exercised, not just a standalone regular expression. Negative cases cover source, unit, geography, currency, verification, publication time, stale/incompatible periods, missing formula/share/baseline, duplicate or contradictory terms, caps/floors, unsupported indexation, cross-organization data and malformed API input. Scenario tests retain the baseline without mutation. Predictive-risk tests verify the distinct financial output; Demo tests render all MRO sections and trace evidence only within the right contract.

Chromium used the actual built assets served through Playwright request interception, with external requests aborted. The browser-only build supplied explicitly synthetic public Supabase configuration because the frontend requires a URL/key at startup; it used no credentials, database or production service. This proves local Demo rendering and interaction, not real authentication, backend API execution or database policy behavior. The final normal frontend build was restored afterward without these synthetic overrides. Browser assertions use real clicks after declining analytics consent and scrolling the evidence action into view; no forced click bypasses an overlay.

The Blog follow-up corrected a launch-critical response-contract mismatch: public SQL did not project publication status although the SSR privacy guard requires it. The controller now returns status while retaining published-only filters and fail-closed SSR checks. Focused Blog/SEO tests pass 17/17; the final combined command includes these tests. The five article drafts remain unpublished. See the separate Blog report for source references, exact owned files and its outstanding CMS authorization/database acceptance gates.

## Production integration attempt

The source branch is `feat/matt-superadmin-integration`, while the integration base is production `origin/main` at `104c9c2d713c0a83940a7ad85a111c1a96e087fe`. The source includes extensive earlier uncommitted OCI prerequisites; production has newer shared Matt Demo architecture and globe work.

A separate worktree on `release/phase74-commercial-readiness` was created from production. A scoped OCI/Blog dependency patch was applied there without staging or overwriting the original working tree. Three-way integration left conflicts in:

- `frontend/src/components/demo/OperionAssistant.jsx`
- `frontend/src/demo/DemoDataProvider.jsx`
- `frontend/src/lib/apiClient.js`
- `frontend/src/routes/ContractWorkspace.jsx`
- `frontend/src/routes/demo/DemoWorkspace.jsx`
- `index.js`
- `services/phase3/intelligence/contractProfileService.js`
- `services/phase3/intelligence/deadlineIntelligenceService.js`

The renewed production-push request was addressed by resolving these conflicts deliberately:

- Preserved production's contextual/floating Matt assistant rather than replacing it with the older independent assistant.
- Expanded the canonical `shared/mattDemoContracts.js` fixture instead of introducing a second contract catalog. Pure aviation/indexation fixtures now live in shared modules; frontend paths re-export them.
- Updated Matt's synthetic-context notices and prepared account coverage to reflect the distinct lease, financing and MRO illustrations, with no evidence attributed to navigation templates. No voice, provider, session or customer authorization behavior was replaced.
- Retained API request cancellation and keepalive alongside the new cache option.
- Retained production aviation-core UI, Matt API mounts and aviation-core recommendations while adding the OCI components, outcome route and evidence-enrichment path.
- Preserved conflicting/unresolved date definitions as ambiguous and explicitly requiring reviewer reconciliation.
- Excluded unrelated, unapproved local Matt-administration navigation and route mounts.
- Updated outdated frontend source assertions to the preserved Matt integration. Demo SSR tests explicitly stub the browser-only Matt boundary; the separate actual built-app Chromium tests exercise the real integrated frontend.

The integrated candidate passes 470 changed-file backend tests, 17 Demo tests, 3 focused Matt context/configuration tests, 7 actual Chromium cases, the frontend production build and syntax checks for 97 changed/new JavaScript files. The original source worktree and its empty index were preserved. No force-push or database operation is authorized or required. Migration 029 and live source-review/CMS authorization acceptance remain separate activation gates; pushing source does not establish those capabilities as production-verified.

## Limitations, release gates and next step

1. Obtain environment-safe approval and apply migration 029 through the established Operion workflow; verify the real grants/RLS and authenticated superadmin source-review path. Do not treat source-code checks as database acceptance.
2. Isolated Demo Chromium acceptance passes; authenticated upload/review/assessment acceptance still requires a reachable test environment.
3. The first release supports exact monthly CPI/HICP series and explicit annual formulas. Quarterly labour indices, PPI/material baskets, bespoke formulas, substitution, retroactivity, multi-year compounding, and downstream recoverability calculations remain incomplete/review-required.
4. Current assessment selection uses the latest eligible observation for a series. A contract naming a different reference month fails closed rather than silently selecting or substituting a historical month.
5. No automated official inflation feed is implemented. An authorized platform reviewer must verify the public release and its exact series/base before ingestion; regular public-source refresh does not populate inflation.
6. Draft Blog content is not automatically published. Blog production readiness depends on its separate acceptance gates.
7. Release integration conflicts are resolved and candidate checks pass. Push must remain a normal fast-forward to `main`; verify the resulting GitHub commit and Vercel check separately. Never infer successful deployment from a local build or push alone.

**Recommended Phase 75:** complete non-production authenticated and database acceptance, then extend exact-series historical reference-month selection and reviewer-approved formula coverage. Add a quarterly labour or PPI series only when its official identity, cadence, release provenance and applicable contractual formula are verified. Do not replace these missing inputs with headline inflation assumptions or probabilistic output.
