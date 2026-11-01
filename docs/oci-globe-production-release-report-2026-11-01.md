# OCI and Globe production release verification - 2026-11-01

## Evidence and publication boundary

Repository: `operionosweb/OperionOS-backend`; production branch: `main`.
Starting production SHA, independently refreshed with Git:
`2956d9dad61a14793541bef02f2f29aeedb3d8e7`.

Implementation uses a new detached, isolated worktree based on that exact SHA.
No other worktree was reset, cleaned, repurposed or included in this integration.
The checked-in report records the pre-publication candidate. Its own eventual
commit SHA cannot be embedded in that same commit. The local post-publication
appendix records the independently verified final SHA, hosting result and live
acceptance; that appendix is explicitly distinguished from published content.
No publication or deployment success is claimed before those checks.

## 1. OCI infrastructure and founder acceptance

### Actual Vercel project inspection

Authenticated Vercel project, domain, environment-name and deployment APIs were
inspected, not just repository configuration.

| Setting | Public website | Independent OCI |
| --- | --- | --- |
| Project | `operion-os` | `operion-oci-production` |
| Project ID | `prj_GwioGkOUaGJJpdCGJ9rqV7kIqgwW` | `prj_Dua6l29D0bGHPTJ1Zy0unEJ86b2a` |
| Connected repository | `OperionOS-backend` | `OperionOS-backend` |
| Production branch | `main` | `main` |
| Root | `frontend` | `oci` |
| Install | `npm ci` | `npm --prefix ../frontend ci` |
| Build | `npm run build` | `node ../scripts/build-oci.js` |
| Output | `dist` | `dist-oci` |
| Build pause | Not configured | Ignored Build Step `exit 0` |
| Custom domains | `operionos.com`, `www.operionos.com` | None |
| Environment inventory | Three public configuration names | Empty |

The public names are `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`; values were neither displayed nor copied.
OCI previews remain disabled from the prior isolated setup; no hosting setting
was changed in this task.

Starting public deployment `dpl_6GNMV26jriyxq9qAWn1h54tutKCb` was
Ready / Production for `2956d9da`, with the public aliases.
Starting OCI deployment `dpl_BNRGosmQDup4JUXCeBL2V2XxQYB5` was
Canceled / Production for that SHA. A canceled record is not an operational OCI
deployment.

### Dedicated Supabase and billing

The actual organization project inventory contains only:

- `Operion OS's Project`: `cvwalskmgniwtmqqbdvj`, eu-west-1, Nano.
- `operion-phase3b-test`: `amlpybvkzoegnxwuodyn`, eu-west-1, Nano.

`operion-oci-production` does not exist in this inventory. The dashboard's
two-Free-project limit blocked project creation during this task. The current
organization subscription was independently rechecked as Free. Neither existing
project was modified or repurposed.

The earlier upgrade panel in this task showed Pro "from $25/month".
[Official compute pricing](https://supabase.com/docs/guides/platform/compute-and-disk)
was rechecked: Small is $0.0206/hour, approximately $15/month; paid-organization
Nano instances are billed at Micro pricing. These are component prices, not an
approved, itemized checkout total. The final organization scope, compute credits,
existing-project charges, tax and usage allowances require explicit approval.
No checkout, subscription upgrade or paid project creation was performed.

Prefer an independently approved OCI billing scope rather than implicitly
changing billing for the protected existing organization. Obtain the actual
itemized quote for a dedicated Frankfurt (`eu-central-1`) OCI project before
authorizing any paid action.

### Backend, domain, identity and MFA

- Render dashboard still requires sign-in. Its actual branch, auto-deploy setting,
  deployed SHA and build/runtime records remain unverified.
- The existing Render backend's safe `/api/health` returned HTTP 200. This does
  not verify its commit SHA, authenticated database queries or an OCI database.
- `oci.operionos.com` DNS remains unresolved; there is no OCI custom-domain
  assignment or verified OCI HTTPS.
- No dedicated OCI Auth user, real founder session, `oci_user_roles` assignment,
  bootstrap audit event or founder MFA acceptance could be verified without
  dedicated infrastructure. Synthetic browser tests are not founder acceptance.
- The guarded bootstrap, identity authority, authorization, recovery privacy,
  migration runner and TLS implementation are unchanged.
- No migration, customer-data operation, role grant or external notice was run.

Required backend configuration names remain `OCI_ALLOWED_ORIGINS`,
`OCI_DATABASE_TARGET`, `OCI_SUPABASE_PROJECT_REF`, `OCI_SUPABASE_URL`,
`OCI_SUPABASE_ANON_KEY`, `OCI_DATABASE_URL` and, where certificate verification
requires it, an approved `OCI_DATABASE_CA`. No values were created.

### Exact remaining activation sequence

1. Approve an itemized, isolated OCI billing/project scope.
2. Create the dedicated Frankfurt production project; do not use either existing
   project as OCI's database or identity provider.
3. Verify its reference, Auth configuration, database certificate chain and
   authenticated read-only database access. Keep TLS verification enabled.
4. Review and authorize the dedicated migration plan and execute only against
   the verified OCI target in a separately authorized task.
5. Configure server-only database credentials and the dedicated frontend public
   Auth/backend configuration; verify RLS, audit and `oci_user_roles` isolation.
6. Use the guarded founder bootstrap with a real verified Auth user ID; verify
   bootstrap audit evidence and mandatory MFA. Do not use email-only authority.
7. Verify all protected modules and server-side denial for unauthorized users.
8. Only then authorize clearing the OCI build pause, domain/DNS setup and
   independent production deployment. Recheck HTTPS and actual founder access.

## 2. Globe intelligence implementation

### Shared surfaces and initial state

Home, Product, Demo Dashboard and Demo Live Tracking continue to use the shared
`FlightOperations` / Cesium implementation. They start with no selected aircraft,
aircraft card, contract panel or alert panel. Persisted legacy context does not
force a panel open on entry.

The default view is Europe, with a light globe/base/background, lighting disabled
and no dark skybox. Standard OSM and the original alternative map configuration
remain intact. The ordinary public referrer policy remains `origin`; password
recovery retains its privacy protections.

Initial rendered PNGs on all four entrypoints measured 0.00% near-black pixels
in the offline acceptance environment. This verifies initial framing rather than
pretending offline tile requests establish live provider connectivity.

### Ten distinct fictional flights

All flights, operators, events, clauses, recommendations and monetary examples
are in-memory illustrative fixtures, never database seeds. Every shared surface,
aircraft card, alert panel and contract inspection displays:

> ILLUSTRATIVE DEMONSTRATION DATA - NOT LIVE FLIGHT OR CONTRACT DATA.

The UI uses the same notice with an em dash. No fixture is presented as a real
airline observation or actual customer liability.

| Aircraft | Route | Scenario status |
| --- | --- | --- |
| G-OPER | BCN - FRA | On time |
| G-OPRA | MAD - AMS | Delayed |
| DEMO-003 | CDG - LHR | Delayed |
| DEMO-004 | AMS - FCO | Rerouted |
| DEMO-005 | FRA - MAD | Cancelled |
| DEMO-006 | LHR - BCN | Weather impact |
| DEMO-007 | LIS - CDG | Maintenance |
| DEMO-008 | MUC - CPH | Delayed |
| DEMO-009 | MXP - AMS | Delayed |
| DEMO-010 | DUB - FRA; illustrative alternate BRU | Diverted |

The fixed scenario date is 2026-11-01, not a live clock. Ground/inspection and
canceled fixtures have zero speed and altitude. Ownership and manufacture year
are explicitly unavailable, not fabricated.

### Cards and in-place contracts

Cards include aircraft identity/model/operator, origin/destination, schedule and
estimates, delay/rerouting, ground/flight phase, operational event and provenance,
associated agreement, exposure confidence and explainable recommendations.
Aircraft/flight facts, alerts and contract evidence/obligations are disclosures
whose detailed DOM is mounted only when requested, reducing initial rendering
cost. Alert-driven selection opens the relevant alert context.

Each flight has its own fictional contextual agreement, clause/obligation IDs and
triggering event. The canceled fixture has no supplied clause or established
obligation; the UI explicitly says so.

Inspect associated contract replaces the card inside the existing Globe; it does
not navigate away. Aircraft, filters, route, camera and renderer remain retained.
Acceptance checks compare the actual canvas element and its rendered frame before
and after inspection. Escape/Return restores the same aircraft context and focus.

The authenticated customer Globe remains synthetic-free. Its contract buttons
inspect only authorized associations in the existing sheet. That endpoint
provides counts and relationships, not clause excerpts or financial terms; the UI
does not invent them. Responses are scoped to the selected aircraft/organization,
late responses cannot overwrite a new selection, and request errors are surfaced.

### Fleet and alerts

Fleet filters combine geography, aircraft type/model/operator/registration and
condition/phase, route/origin/destination, flight status/time windows/delay,
rerouting/cancellation, associated contract/type, obligation/deadline/breach
review, quantified/unquantified/high exposure and available recommendations.
Europe is the default; Global is explicitly selectable. Counts, investigation
presets, removable chips, reset and honest zero-result states are implemented.
Legacy query/layer filters remain additional constraints.

There are 35 linked fictional alerts across operational, contractual, financial
exposure and action contexts. Filters include category, severity, status,
aircraft/operator/country/route, contract/obligation and action status. Current
fleet filters also constrain alerts. Selecting an alert selects its own aircraft,
highlights that alert and supports inspection of its own agreement.
No alert or recommendation sends a notice or writes production records.

### Exposure and recommendation rules

Six distinct states are retained: No identified exposure; Potential contractual
exposure; Estimated financial exposure; Unquantified exposure; Insufficient
evidence; Confirmed contractual obligation. The last state refers only to a
supplied fictional notification obligation, not confirmed customer liability.

Only DEMO-003 and DEMO-009 supply a monetary term:
`min(EUR 500, max(0, delay - 60) minutes x EUR 10/minute)`, yielding illustrative
EUR 150 and EUR 350. The assumed attributable arrival delay, exclusions, review
requirements and uncertainty are displayed. Other scenarios say "Exposure not
yet quantified." A delay alone never establishes breach.

Recommendations are rule-based with reasons linked to supplied fictional evidence:
review notice deadlines or obtain missing evidence, then review attribution,
exclusions and mitigation. Weather is not automatically force majeure.

## 3. Validation and performance

All service-dependent browser validation uses synthetic configuration,
intercepted transports and loopback artifacts, not production records.

| Validation | Result |
| --- | --- |
| Globe functional/ten-width suite | 14/14 passed, including every flight's own card/agreement |
| Latest narrow-screen shared fleet/card/text regressions | 4/4 passed at 320 and 390 |
| Same-runtime aircraft picking comparison | 2/2 passed, seven trusted selections per viewport and version |
| OCI/MFA/identity/recovery browser suite | 35/35 passed |
| Added scoped customer in-place/race/error browser acceptance | 1/1 passed |
| OCI backend/authorization/geography/commercial tests | 69/69 passed |
| Changed Globe/provider/schema/map units, final focused run | 16/16 passed |
| Earlier pose/picking and shared navigation/fullscreen/relationship coverage | 23/23 units; 14/14 browser checks passed |
| Full backend suite | 518/519 passed; one pre-existing source-heading assertion |
| Public production build | Passed; existing large Cesium chunk warning remains |
| Independent OCI build helper | Passed; output remains separate from public application |
| Changed source and built JS/CSS/HTML credential/TLS scan | 251 files scanned, no findings before report addition |
| `git diff --check` | Passed |

The full-suite failure is `test/saas-routing-seo.test.js:114`, "public route
components retain semantic primary headings", requiring a literal H1 in
`CorporateHome.jsx`. Both source and test match starting main exactly
(source blob `d03216ec61eaa59f327eeaf8b33f77da12f2ff83`;
test blob `e41b72392b78e8bf068b6a32b8021a1fd4adfee9`).
This unrelated baseline failure was not hidden or changed. The full suite is not
claimed green.

Widths exercised: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920.
Panels retain visible Globe/map controls, fit their containing stage and avoid
horizontal overflow. Keyboard return/focus and unchanged route/frame were tested.

### Measured aircraft selection, not a universal 24ms claim

The historical 24ms observation was not reproducible as a universal single-click
or median limit on this machine. Initial strict tests caught mobile 32-48ms
samples; no such failure was suppressed. Detailed content was made lazy,
selection state batched concurrently, and panel painting contained/opaque.

To distinguish a real regression from presentation timing, original main blobs
were compiled read-only using exactly the candidate dependencies, runtime,
synthetic configuration and browser viewport. No existing worktree was edited.
The same trusted click/touch method was used for both artifacts.

| Final same-runtime comparison | Starting main | Candidate |
| --- | --- | --- |
| 390px median, seven taps | 48ms | 32ms |
| 390px samples | 64,48,48,48,56,48,48ms | 32,32,16,16,32,32,24ms |
| 1440px median upper bound, seven clicks | 24ms | 16ms |
| GPU picking readbacks | 0 | 0 |
| Largest observed candidate input handler in final comparison | - | 1.4ms mobile; 0.5ms desktop |

An earlier equivalent comparison measured mobile medians 56ms baseline / 24ms
candidate. The final result above, not the best sample, is the release evidence.
Absent desktop Event Timing entries mean below the observer's 16ms floor, not
zero latency. Measurements are browser/frame-quantized, not field INP percentiles.
The final gate verifies no regression against the equivalent baseline, zero GPU
readbacks and no long handlers/interactions; it does not substitute only a loose
200ms threshold for the comparison.

A mobile Chromium trace measured maximum sampled FunctionCall 1.367ms,
UpdateLayoutTree 1.007ms, Layout 0.657ms and pointerup dispatch 0.664ms. There was
no sampled long JavaScript/layout/input task. No artificial fixed delay or
premature pointer-down selection was introduced to game the measurement.

## 4. Git, security and production integration

The refreshed release branch remains
`dd8864653ce8c3a1e634e4a5a3a3d15e21e853df`; its approved history is already
in starting main. This task adds only the reviewed Globe changes, directly
related customer inspection/race protection, tests and this report.
There is no merge/cherry-pick from dirty or TLS-bearing worktrees.

Blocked TLS commit `e0dfc838d6490b7dfd36abf97487761c3f8f58e2` is not an ancestor
of the candidate (Git ancestry check exit 1).
Recovery commit `8720815dcea6811326051166e41ba44d61395011` remains an ancestor
(exit 0), with its privacy/MFA tests passing.

Manifests, lockfiles, recovery implementation, backend source, bootstrap,
migration runner, Supabase files and TLS code are unchanged. Dependency restore
was limited to missing packages in the new worktree, using existing lockfiles.
The inherited tracked root browser environment configuration was not changed;
no private/service-role credentials were introduced.

Reviewed file inventory:

- `frontend/src/components/aviation/AircraftInfoPopup.jsx`
- `frontend/src/components/aviation/FlightOperations.jsx`
- `frontend/src/components/aviation/GlobeIntelligencePanels.jsx`
- `frontend/src/components/aviation/globeIntelligence.js`
- `frontend/src/components/aviation/ProductionFlightGlobe.jsx`
- `frontend/src/components/aviation/aircraftPose.js`
- `frontend/src/components/demoRedesign/CesiumFlightGlobe.jsx`
- `frontend/src/demo/aviationDataProvider.js`
- `frontend/src/demo/globeIntelligenceData.js`
- `frontend/src/routes/ProductionLiveTracking.jsx`
- `frontend/src/routes/demo/AviationIntelligenceMap.jsx`
- `frontend/src/styles/globe-intelligence.css`
- `frontend/tests/globe-intelligence.test.mjs`
- `frontend/tests/globe-responsive.test.mjs`
- `frontend/tests/oci.test.mjs`
- `test/demo-aviation-data-provider.test.js`
- `test/globe-intelligence.test.js`
- `test/globe-schema.test.js`
- `docs/oci-globe-production-release-report-2026-11-01.md`

Pre-existing worktree HEADs, tracked binary diffs/status and untracked contents
were fingerprinted before publication for comparison afterward. Only a normal
non-force push of isolated HEAD to `refs/heads/main` is authorized.
The other four remote branch tips are recorded for after-push comparison.

The actual Vercel public project's connected main/Production configuration and
earlier push-triggered deployments establish its production trigger. OCI's
ignored-build configuration deliberately cancels its builds. Render's trigger
cannot be confirmed while dashboard access is blocked. No manual deployment
or production setting change is performed.

## 5. Limitations, rollback and next authorized action

- OCI cannot be operational without approved dedicated paid infrastructure,
  dedicated Auth/database/TLS/RLS, founder MFA/role acceptance and domain/HTTPS.
- Render deployed SHA, auto-deploy configuration and authenticated database
  health remain access/evidence blocked.
- Public demonstration flights and contract exposure are not live customer data.
- Customer associations do not supply clauses or financial terms.
- Mobile timing varies: final median 32ms, faster than the equivalent 48ms
  baseline, but not a claim that all mobile selections are 24ms.
- One unrelated full-suite source-heading assertion remains failed.

If the public release regresses, review and authorize a normal revert of the
Globe release commit on a fresh main-based worktree, rerun relevant checks and
normally push main. Do not reset/force-push or deploy the blocked TLS branch.
Retain OCI's pause, existing public domains and all protected database projects.
No database rollback is necessary because no migration or record mutation ran.

After publication, independently check GitHub commits/main, Git `ls-remote`,
refreshed origin/main and isolated HEAD equality; TLS/recovery ancestry; all other
remote tips and original worktree fingerprints. Locate the exact public Vercel
SHA and require Ready / Production and public aliases before live acceptance.
Verify public HTTPS, initial state, aircraft/fleet/alert/contract interactions and
runtime errors. Record OCI separately as blocked, and stop after verification.

Final verdict and exact release/deployment identities are reserved for the
post-publication appendix; none are invented in this candidate report.
