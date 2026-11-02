# Operion next development cycle: paid aviation pilot readiness

## 1. Executive verdict

**AMBER for isolated development; NOT YET ACCEPTANCE-VERIFIED for a paying customer.**

The existing architecture was retained. OCI already has a dedicated frontend,
server-authorized access, MFA, recovery flows and eight commercial modules.
This cycle corrects misleading OCI login instructions, removes duplicate
sidebar Matt entries, protects the collapsed Admin label, and adds a bounded,
evidence-grounded aviation increment rather than a new application.

The critical external blocker is independently reproducible:
`oci.operionos.com` does not resolve. Dedicated OCI Auth/database configuration
and the founder's actual authorized login have not been verified. No customer
database was substituted. No production bootstrap or migration was executed.

Passing synthetic/offline tests is implementation evidence, not proof that a
paying customer can independently complete the deployed workflow. Dependency
advisories and the absence of demonstrated recovery/real-corpus acceptance also
remain release gates.

## 2. Git and environment baseline

| Item | Verified state |
| --- | --- |
| Baseline and final HEAD | `d32ab904f697489e6ff07f02640da55c4d960abd` |
| Working environment | Windows; Git 2.55.0.windows.3; Node 24.19.0; npm 11.17.0 |
| Isolated worktree | `OperionOS-matt-stitch-preview-2026-11-01` |
| Starting state | Clean detached HEAD; remote `main` matched the full baseline SHA |
| Current changes | Intentionally uncommitted; not a new deployed release |
| Dependency restoration | Root `dotenv` import failed with `ERR_MODULE_NOT_FOUND`; restored the existing root lockfile with `npm.cmd ci --ignore-scripts` |
| Manifests/lockfiles | Not changed or upgraded |
| Unrelated worktrees | Preserved; no reset, checkout, merge, rebase or deletion |

Frontend dependencies were already installed. Build/test artifacts are ignored
and were generated locally by the existing test tooling. Restoring packages did
not authorize advisory upgrades or production dependency changes.

## 3. Live evidence and deployment boundary

Fresh checks on 1 November 2026:

| Target | Observation | What it does not prove |
| --- | --- | --- |
| `https://operionos.com` | HTTPS 200 after redirect to `https://www.operionos.com/` | Source SHA, authenticated customer flows or database health |
| `https://www.operionos.com` | HTTPS 200 | This cycle's local changes are deployed |
| `oci.operionos.com` | Windows DNS `DNS_ERROR_RCODE_NAME_ERROR`; browser also failed name resolution | Existence/configuration of an independent hosting project |
| Public Render `/api/health` | HTTPS 200, `status: healthy`, `service: operion-backend` | Dedicated OCI backend, deployed SHA, database queries or contract persistence |

Health reference:
<https://operionos-backend-1.onrender.com/api/health>.

Hosting management access, deployment records and release-to-domain mappings
were not newly verified. Historical activation reports are context, not current
dashboard evidence. The health request was read-only; protected OCI probes were
not issued because authorization/audit paths may write audit records.

## 4. OCI authentication and founder Super Admin

The inspected architecture is already appropriate:

- Dedicated client configuration and a separate OCI session-storage namespace.
- Production hostname guard; public/customer hosts fail closed.
- Supabase provider `getUser` validation before trusting identity claims.
- Confirmed identity, MFA/AAL2 and server-side active `oci_user_roles` authority.
- No authorization based on frontend email, editable metadata or customer roles.
- Role revocation is checked on protected requests.
- Lookup/audit failure denies access instead of returning success-shaped data.
- Dedicated database target checks, lazy connections and verified TLS.
- A secure existing initial founder bootstrap, dry-run by default; confirmed
  founder identity and MFA required; explicit apply is atomic and audited.
- No hardcoded production password and no browser-based role grant.

The requested founder account must be verified by an authorized operator in the
dedicated OCI Auth project. Its existence, MFA enrollment, active role and live
login are **NOT YET VERIFIED**. The bootstrap was inspected and tested with
injected transports; it was not applied to infrastructure.

Only the misleading login copy changed: it now explicitly requires the
dedicated OCI administrator account and rejects any implication that customer
credentials authorize OCI.

### Password reset: implemented versus verified

The existing forms invoke real Supabase recovery APIs, rather than decorating
an inert reset screen. Offline tests execute request validation/provider
failure, recovery-token expiry/reuse, token-hash, PKCE and legacy callback
handling, identity mismatch, existing MFA, password validation, callback
scrubbing, session closure and cleanup retry.

**Verified locally:** provider-call contracts and guarded UI behavior using
synthetic sessions and intercepted network transports.

**Not verified live:** mail delivery, approved redirects on the actual OCI
domain, founder recovery links, live token expiry and production MFA. No real
password email or account mutation was initiated.

## 5. Essential OCI frontend

Existing pages were retained, not redesigned into another application:

| Surface | Actual implemented interaction |
| --- | --- |
| Founder command centre | Evidence/status filters, recommendations, linked actions, classified revenue |
| Accounts | Search, pagination, details, evidence, CRUD, archive/version conflicts |
| Contacts | Relationships, evidence, contact-only privacy erasure with explicit confirmation |
| Market intelligence | Geographic research scope; research stays separate from verified customer facts |
| Sales opportunities | Linked accounts, evidence-gated stages and pipeline |
| Activities | Account/opportunity links and validated records |
| Customer discovery | Research handoff and customer validation remain distinct |
| Pilots and proposals | Scope/approval/evidence fields, actual linked record forms |
| Revenue intelligence | Actual versus forecast and currencies/periods kept separate |
| Audit and settings | Bounded history and controlled persisted stage settings |

The existing synthetic transport suite covers these real UI interactions.
New coverage opens every module's empty state and creation dialog at 320, 768
and 1440px; it does not fabricate production records. Existing responsive
coverage spans 320, 360, 390, 430, 768, 1024, 1440 and 1920px, including modal
keyboard focus and exact 2px mobile metric gutters.

Production persistence and access remain blocked by dedicated infrastructure.

## 6. Contract Core, aviation and bounded predictive work

See [the detailed core increment report](aviation-contract-core-increment-2026-11-01.md)
for implementation boundaries, source evidence and its exact test command.

The inspected existing Core already has authenticated/organization-scoped
ingestion, PDF/DOCX parsing, deterministic clause/obligation/deadline stages,
evidence and structure references, risk processing, stored-record search and
grounded assistant/review recommendations.

Important qualifications:

- A parser producing text is not a measured extraction-quality guarantee.
- Derived page fallbacks are not original-PDF page proof.
- Deterministic summaries/review actions are not unrestricted verified LLM
  understanding, legal advice or approved operational actions.
- No live external fuel-price feed was established.
- No full Scenario Simulation or Digital Twin was added.

This cycle adds secondary aviation review topics and suggested owner/action/
rationale records in existing `profile.metadata.aviationCore`, preserving
original citations and unknown source locations. These lexical topics are not
new extracted obligations, legal conclusions or database category enums.

The fuel interface requires a self-contained, explicitly stated ratio formula,
base surcharge, baseline price, reference and frequency in one clause.
Unsupported prose formulas, cross-clause mechanisms, caps/floors/thresholds,
exceptions or missing/duplicate definitions require review and produce no
amount. Same-currency/unit/reference, finite positive typed inputs and labelled
provenance are required. Amounts are mathematical sensitivity, not confirmed
liability or forecast accuracy; legal applicability is not established.

Only hypothetical or user-supplied/unverified prices are accepted. Input
editing or changing the analysis run clears local results. No market lookup,
scenario persistence, audit write or billing operation is added. Completed
historical runs are not backfilled: old profiles truthfully show unavailable
coverage, and new metadata requires a new authorized analysis run.

## 7. Matt, Demo and Globe stability

- Sidebar **Ask Matt** appears under Main, not duplicated under Workspaces, in
  both Demo and authenticated production navigation.
- Workspace, floating Matt, contextual evidence and retained report routes stay
  available; removing duplicate menus does not remove functionality.
- Collapsed Admin is visible on one line inside the existing 72px rail.
- Mobile drawer uniqueness and no-overflow coverage supplement the existing
  Studio/Proposal 2px-gutter tests.
- Existing same-origin Earth imagery, UTC solar lighting and all 20 explicitly
  simulated routes remain unchanged.
- Voice-input consent, transcript review, interruption, session boundaries,
  optional response text and evidence/proposal distinctions remain covered.

**Real synchronized talking video is still blocked.** No provider account was
authorized or charged, and no provider-uploaded custom identity or fixed voice
was established. No generic footage or independent browser TTS was presented
as synchronized Matt. Hiding response text is supported, but does not establish
a fully functioning text-free talking-video response channel.

**2 November 2026 UI update:** the Matt stage now loops the supplied local
`frontend/public/matt/reference.mp4` instead of showing a static portrait.
This improves video presence only; it is prerecorded, muted and not synchronized
to answers. It does not change the blocked synchronized-video/voice status above.

## 8. Tests actually executed

| Check | Result and scope |
| --- | --- |
| `npm.cmd run test:oci` | 69/69 passed; offline server authorization, schema, isolated migration-runner doubles, geography and workflows; no real migration |
| Customer foundation/identity/HTTP security tests | 18/18 passed; injected identities and loopback protected routes |
| Matt/browser/Studio/unified + OCI browser suites | 76/76 passed; synthetic service config, real browser UI, requests intercepted; builds run serially |
| Matt/flight/route/solar/imagery pure suites | 29/29 passed |
| New navigation and all-module empty-state checks | Passed after fixing an initial test race: await lazy route rendering before counting links |
| Core parser/profile/pipeline/SSR and original regressions | 164/164 passed through the bounded implementation task; injected repositories, synthetic corpus and actual JSX SSR |
| Real Earth imagery browser checks | 2/2 passed: Home, Product, Demo Dashboard and Live Tracking, each at 390/1440px with all external imagery blocked and screenshot geographic-texture thresholds |
| Authenticated production Matt nav assertion | 1/1 focused rerun passed after adding single-entry coverage |
| Core interactive browser | 4/4 passed after fixes; actual workspace, desktop/mobile, citation structure, invalid/unverified inputs and no mutation requests |
| Core/SSR focused rerun after browser fixes | 34/34 passed |
| Local ingestion/document structure | Final 15/15 passed with credentials blank: existing synthetic DOCX fixture parsed locally, ordered complete clauses, repeatability, unknown page count and malformed archive rejection; no live database/storage |
| Preserved command-centre suite | 23/23 passed; all eight viewport layouts, review/filter controls, actual aircraft canvas selection on four surfaces at 320/390/1440px, explicit missing-model fallback |
| Actual UTC solar rendering | 1/1 passed: central luminance noon 162.9, midnight 55.9; difference exceeds 20 and night remains above 10 |
| Final unified Matt rerun | 7/7 passed, including mobile drawer Main uniqueness and actual folded Admin geometry |
| `git diff --check` | Passed; manifests/lockfiles unchanged |

No test count here is a claim of real founder access, production database
processing, customer acceptance or deployment. Legacy synthesis-helper unit
coverage is not a synchronized-video acceptance test.

The first interactive core run failed 4/4: browser-visible evidence collapsed
newlines, and the fixture omitted an existing safe obligation-estimate GET.
The component now preserves multiline source readability; the fixture
explicitly handles that existing read endpoint with truthful synthetic data.
All source-text, evidence and zero-mutation assertions were preserved.
The corrected 4/4 browser and 34/34 core/SSR runs passed. Dedicated test output
was removed, including cleanup on failed startup.

The expanded final navigation test initially sampled the 258px rail while
focus remained inside the mobile drawer or its desktop collapse transition
had not settled. The test now deliberately moves focus outside the sidebar
and waits for the actual 72px geometry before measuring the label. Keyboard
focus expansion and animations were not removed to make the test pass.
The final full unified suite passed 7/7.

Counts for focused reruns overlap earlier suites; do not sum them into a
fictional count of unique tests. All listed final executions passed.

## 9. Kilo reliability and state preservation

The reported Kilo "could not keep changes" UI error was not reproducible through
available direct Git/patch operations. The vendor's own keep-changes interface
was not available for an equivalent UI validation, so it is **not claimed fixed**.

The worktree index and HEAD locks were absent. The command-centre test file is
writable and its working-tree Git blob hash matched HEAD exactly:
`b620f619e852755baa0c0d3095df4b513db2f6ab`.

The file and all its assertions were preserved. No test bypass, force-push,
index manipulation, reset or unrelated-worktree modification was used.

## 10. Twenty-capability paid-pilot assessment

Statuses apply to the requested end-to-end paid-pilot standard, not just local
page availability. "Partially implemented" can include substantial passing
offline tests while real-data quality or operational acceptance remains open.

| # | Capability | Classification | Evidence / remaining acceptance gate |
| --- | --- | --- | --- |
| 1 | Contract upload | PARTIALLY IMPLEMENTED | Authenticated ingestion exists; actual customer upload/storage/retry workflow not accepted |
| 2 | Document parsing | PARTIALLY IMPLEMENTED | PDF/DOCX pipeline/tests, including actual local synthetic DOCX extraction; real aviation corpus, complex layouts and scanned-document limits need adjudication |
| 3 | Clause extraction | PARTIALLY IMPLEMENTED | Deterministic evidence-linked segmentation; taxonomy precision/recall and page correctness not measured on pilot corpus |
| 4 | Obligation extraction | PARTIALLY IMPLEMENTED | Structured evidence-linked extraction; accountable reviewer and missed-obligation evaluation needed |
| 5 | Deadline extraction | PARTIALLY IMPLEMENTED | Absolute/relative/event/ambiguous handling tested; verify source anchors and false-date rate on real contracts |
| 6 | Contract risk identification | PARTIALLY IMPLEMENTED | Evidence-linked deterministic risk stages; severity and missing-risk acceptance not yet adjudicated |
| 7 | Contract summaries | PARTIALLY IMPLEMENTED | Grounded stored-record summaries; completeness/material omission review needed |
| 8 | Contract search | PARTIALLY IMPLEMENTED | Stored index/search pipeline exists; 20-50 contract relevance and cross-tenant testing required |
| 9 | AI recommendations | PARTIALLY IMPLEMENTED | Grounded review recommendations, not approvals; operational usefulness and model/provider quality not verified |
| 10 | Aviation-specific intelligence | PARTIALLY IMPLEMENTED | Additive aviation topic/action foundation; real clause corpus coverage remains open |
| 11 | Predictive risk functionality | PARTIALLY IMPLEMENTED | One conditional hypothetical fuel-pricing foundation only; not a validated live forecast |
| 12 | Authentication | BLOCKED BY EXTERNAL DEPENDENCY | Provider/MFA/recovery implementation tested offline; dedicated OCI live founder account/domain unavailable |
| 13 | Organisation-level data isolation | PARTIALLY IMPLEMENTED | Membership-derived scope and manipulated-identity rejection tested; deployed DB/storage isolation acceptance needed |
| 14 | Role-based access | PARTIALLY IMPLEMENTED | Server permission matrices and OCI revocation fail-closed tests; live grants/revocation not verified |
| 15 | Document security | PARTIALLY IMPLEMENTED | Authenticated boundary and validation; private-object access/deletion/retention and adversarial files need operational verification |
| 16 | Audit logging | PARTIALLY IMPLEMENTED | OCI transactional/fail-closed audited operations tested; full customer processing/export/retention audit trail acceptance pending |
| 17 | Error handling | PARTIALLY IMPLEMENTED | Tested provider outages, stale requests, denied scope and version conflicts; whole production processing/retry observability not accepted |
| 18 | Backup and recovery | PARTIALLY IMPLEMENTED | Existing read-only recovery/archive auditor; no fresh backup, restore drill, retention, RPO or RTO verified |
| 19 | Customer onboarding | PARTIALLY IMPLEMENTED | Existing organization/user surfaces; independent invite/access/first-contract/support walkthrough not accepted |
| 20 | Pilot usability | BLOCKED BY EXTERNAL DEPENDENCY | Responsive workflows pass offline; live secure access and human aviation-corpus acceptance remain gates |

### Transparent readiness calculation

**Verified paid-pilot acceptance: 0/20 = 0% established by this cycle.**

This means no capability met *all* requested operational criteria with the
necessary real infrastructure/customer evidence in this audit. It does not
mean that no software works, or that implementation is 0% complete.

No weighted source-completion estimate is substituted for this verified
percentage. The matrix contains 18 substantially but partially implemented
capabilities and 2 external-dependency-blocked capabilities. Convert each row
to verified only after its operational and evidence-quality gate has actually
passed; offline regression counts alone do not convert a row.

## 11. Security observations and exact blockers

| Severity | Finding | Correction / intervention |
| --- | --- | --- |
| High | OCI domain does not resolve; founder/dedicated project access unverified | Authorized owner must approve/configure independent hosting, DNS, Auth, backend and dedicated DB; never reuse customer data |
| Critical advisory | Root lockfile: `proxy-addr` advisory; frontend lockfile: `dompurify` advisory | Separately authorize targeted dependency remediation and verify applicability/regressions before release; advisory severity is not proof of a confirmed exploitable deployment |
| High advisory | Root: `body-parser`, `follow-redirects`, `zod`; frontend: `vite`, `source-map-js` | Review affected execution paths and patched compatible resolutions; Vite's suggested fix is a major upgrade, not an automatic safe fix |
| Medium advisory | Root: `moment`, `qs`; frontend: `esbuild` | Review/patch in the dependency-remediation task; no `npm audit fix` executed |
| High | No real-corpus quality acceptance or storage/backup restore acceptance; ingestion auditing is best-effort | Add reviewer-adjudicated corpus, operational restore drills and a measured processing-audit delivery policy before customer onboarding |
| Medium | Tracked root `.env` contains actual-looking public frontend API/Supabase configuration | It contains three `VITE_` public keys/settings, not a detected service-role/password secret. Move deployment configuration out of tracked environment files in an approved hygiene change and independently verify customer RLS/storage policies |
| Medium | Exact hosting release/database state is unverified | Authenticated operator must inspect actual deployment records/logs and approve safe acceptance |
| Low | Kilo keep-changes UI incident remains unverified | Reproduce through vendor UI with session logs if it recurs; direct file/index integrity is currently normal |

Audit totals: root 6 affected packages (1 critical, 3 high, 2 moderate);
frontend 4 (1 critical, 2 high, 1 moderate). These counts are npm advisory
observations for the existing lockfiles, not ten independently proven
application exploits. No secret values were printed, copied into reports or
rotated. OCI-specific configuration was absent in inspected files/process
configuration; public/customer `VITE_` settings are not an OCI substitute.

## 12. Prioritized next authorized actions

1. Approve the dedicated OCI infrastructure plan and any exact cost quote.
   Verify independent project/domain/backend/database target, TLS, deployment
   branch/configuration, and then authorize schema/provisioning separately.
2. Establish the founder's confirmed identity, MFA and active server role;
   verify live login/logout/reset/expiry/revocation without weakening gates.
3. Remediate lockfile advisories in a bounded reviewed dependency task.
4. Create a rights-approved 20-50 aviation contract corpus with reviewer gold
   labels. Measure clause/obligation/deadline recall, evidence correctness and
   material false positives; expose unsupported/scanned/ambiguous documents.
5. Verify actual private storage and cross-tenant reads, recovery/retries,
   processing audit/observability, object/database backup and restore.
6. Run one independent customer onboarding and first-contract walkthrough;
   secure pilot scope, data-processing terms, retention and escalation owner.
7. Accept the evidence-linked recommendation and one-variable fuel flow on
   supported clauses only; keep unsupplied prices/unsupported formulas unknown.
8. Approve release only after end-to-end acceptance. Publication and deployment
   require new explicit permission; none was inferred from an earlier cycle.

## 13. Engineering estimate and December decision

Conditional estimate: **4-7 focused engineer-weeks**, plus owner/provider lead
time and customer/reviewer availability. This is a planning range, not a
verified delivery date:

- Dedicated hosting/Auth/DB activation and secure acceptance: 2-5 working days
  after approvals and operator access.
- Dependency/document-security/recovery hardening: 5-10 days.
- Corpus adjudication, extraction/search/recommendation improvements and the
  narrow pricing workflow: 10-20 days, depending on observed error rates.
- Backup/restore, independent onboarding and release acceptance: 3-7 days,
  partly overlapping corpus work.

**Before 31 December 2026 remains conditionally achievable, not committed.**
Stop/go decisions depend on timely infrastructure approval, absence of major
corpus failures and an available customer/reviewer. The target is readiness to
start a controlled 6-8 week pilot, not proof that such a pilot can finish by
31 December. A missed infrastructure or quality gate must reduce scope or move
the launch date, never be masked by a completion percentage.

## 14. Files and final verification addendum

### Changed-file inventory

| File | Purpose |
| --- | --- |
| [DemoShell.jsx](../frontend/src/components/layout/DemoShell.jsx) | One Main Ask Matt; preserve workspace routes; collapsed Admin class |
| [ProductionLayout.jsx](../frontend/src/components/layout/ProductionLayout.jsx) | One Main Ask Matt; remove duplicated workspace menu entry only |
| [demo-aero.css](../frontend/src/styles/demo-aero.css) | Existing 72px rail Admin label visible on one line |
| [OCI Auth.jsx](../frontend/src/oci/Auth.jsx) | Truthful dedicated-account login instructions |
| [matt-browser.test.mjs](../frontend/tests/matt-browser.test.mjs) | Authenticated single-sidebar-entry regression |
| [matt-unified.test.mjs](../frontend/tests/matt-unified.test.mjs) | Main heading, mobile drawer and folded Admin geometry regression |
| [oci.test.mjs](../frontend/tests/oci.test.mjs) | All eight empty states/dialogs at mobile/tablet/desktop widths |
| [aviationContractCore.js](../domain/contractIntelligence/aviationContractCore.js) | Shared topic/action/fuel ratio domain increment |
| [contractProfileService.js](../services/phase3/intelligence/contractProfileService.js) | Persist additive aviation metadata via existing profile schema |
| [AviationContractCoreSection.jsx](../frontend/src/components/intelligence/AviationContractCoreSection.jsx) | Real profile/evidence and local conditional fuel input UI |
| [ContractWorkspace.jsx](../frontend/src/routes/ContractWorkspace.jsx) | Wire component to scoped persisted analysis profile |
| [aviation-contract-core.test.js](../test/aviation-contract-core.test.js) | Pure/parser/profile/persistence safety tests |
| [contract-profile-service.test.js](../test/contract-profile-service.test.js) | Retain property checks over interpretations rather than original quoted evidence |
| [document-ingestion.test.js](../test/document-ingestion.test.js) | Actual local DOCX parsing via existing synthetic fixture; malformed archives rejected |
| [aviation-contract-core.test.mjs](../frontend/tests/aviation-contract-core.test.mjs) | Actual component SSR and workspace wiring |
| [aviation-contract-core-browser.test.mjs](../frontend/tests/aviation-contract-core-browser.test.mjs) | Actual scoped workspace form/evidence/unsupported states; no mutations |
| [Core increment report](aviation-contract-core-increment-2026-11-01.md) | Exact implementation, restrictions, source audit and test results |
| [This readiness report](aviation-paid-pilot-readiness-2026-11-01.md) | Twenty-capability acceptance assessment and remaining gates |

The preserved command-centre test was not modified. No dependency manifest,
lockfile, migration, customer data model or auth/role policy was changed.
Local HEAD and a fresh read-only `ls-remote` of `main` both still equal the
full baseline SHA. The temporary loopback preview was verified responsive
before use and stopped after its dependent checks. Self-hosted test servers
were closed by existing test teardown; no development service is intentionally
left running.

All changes remain local and uncommitted. No production data, credentials,
DNS, hosting, billing, Supabase infrastructure, external Matt assets or GitHub
branches were changed.
