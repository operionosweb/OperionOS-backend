# Matt platform-wide intelligence and security: local acceptance

Date: 2 November 2026. Scope: the isolated local Matt worktree only.

## 1. Executive verdict

**IMPLEMENTED LOCALLY — PROVIDER ACTIVATION REQUIRED**

Matt now has explicit selected-analysis, authorized-account and Operion-guide
question scopes within the existing shared assistant. The change adds reviewed
platform knowledge, fresh tenant-scoped account retrieval, canonical financial
impact and aviation relationships, scoped conversation/report state, and
three-minute idle termination. The approved circular portrait and existing
cinematic video presentation are retained. Disconnect is now visible beside
the audio controls, not hidden inside Voice settings.

Local automated evidence: **126/126 unit/backend/protocol tests**, **51/51
Chromium browser tests**, **6/6 installed Edge checks**, and **6/6 installed
Chrome checks** passed. Synthetic providers and transcripts are not real Matt.

This is NOT acceptance of full live operation, a security certification,
production tenant-isolation assurance, measured answer accuracy, or permission
to publish. The confidential paid pilot remains **NOT READY**. The desktop
acceptance safety gate remains unresolved. Native editor Keep recovery is
**not verified**; preserving source files is not the same as repairing it.

## 2. Architecture before and after

Before this extension, Demo and SaaS already shared the live session, answer
orchestration, microphone, avatar transport and findings presentation. Questions
required a selected analysis or a server-mapped prepared Demo alias. Matt did
not have a maintained platform guide or authorized account overview.

After:

1. Authenticate and resolve current membership/permissions on the server.
2. Select a validated `analysis`, `account` or `platform` context mode.
3. Retrieve only that scope; add reviewed platform documentation.
4. Generate through the existing budgeted AI gateway.
5. Validate the response shape and cited source identifiers.
6. Return the exact validated answer for the existing avatar Text Echo path.

The browser supplies a small allowlisted page ID for navigation, never an
authorization grant or arbitrary retrieval object. No new autonomous agent,
web crawler, ingestion engine or global customer knowledge store was added.

## 3. Shared Matt engine design

The main Matt route, contract workspace, Globe floating assistant and expanded
assistant retain `MattExperience`, `useMattLive`, the shared session service and
the same answer-service factory. Demo injects its prepared reader and bounded
gateway allocation; SaaS injects canonical authorized readers.

Changing the question scope closes the old live lifecycle and separates local
conversation/report state. A new approved connection is required. This is
intentional: it avoids carrying provider conversation context into a new scope.
Changing context is not advertised as a seamless persistent production room.

Disconnected guide answers use the same reviewed documentation and are
explicitly labelled **prepared, not generated AI**. Disconnected account
reasoning returns a visible connection requirement; it does not substitute a
selected lease answer. Existing disconnected selected-contract findings remain
available. A platform-only Super Admin can use the prepared public product
guide, but cannot retrieve customer data or start tenant reasoning without
verified organization membership and contract-read permission.

## 4. Tenant isolation design

- The organization header selects a membership to verify; it is not trusted
  alone. The server verifies active membership for the authenticated user.
- All Matt live endpoints retain organization membership and `contract:read`.
  Platform administration is not an implicit customer-data grant.
- Trusted account identity and permissions are constructed from middleware.
  Body-supplied account/organization/user impersonation is not used.
- Account catalog and latest-run queries filter by organization before reading.
  Returned organization mismatches fail closed.
- Canonical run readers independently validate organization/run ownership.
  Document-version, obligation, deadline, evidence and search readers preserve
  their existing scoped queries.
- Account metadata must match both authenticated organization and user.
- Source retrieval and permission checks happen before the model/cache path.
  Input fingerprints include the user; gateway cache/job keys include tenant.
- Server sessions belong to organization plus user. Histories reset when
  analysis, mode, page or permission scope changes.
- Browser reports are session state, not globally retrievable report records.
  Account, identity, role, authorization-loading and read-permission changes
  clear retained sessions. They do not authorize a remote report-ID lookup.
- Demo uses only its fixed namespace and prepared readers; it has no customer
  database fallback. Its capability does not confer administrative access.

These are boundaries of the inspected Matt path. Legacy vector memory is not
wired into Matt and was not modified. This report does not certify unrelated
legacy APIs or the deployed database's actual RLS configuration.

## 5. Threat model and adversarial results

Fixtures use two distinct fictional organizations, users, contracts, documents,
versions, runs, evidence and money/currency sentinel strings. No customer data
was used. The tests execute real repository builders and canonical readers
against an in-memory query adapter; they do not exercise a live database.

| Attack or boundary | Local evidence | Result |
|---|---|---|
| A reads B, then B reads A | Own-source positive cases plus guessed foreign run/document/version/contract/evidence IDs submitted as analysis selectors | Denied before model |
| Organization-header tampering | Actual HTTP router plus real membership/permission middleware | 403, no foreign retrieval |
| Body account/tenant impersonation | Actual HTTP turn; trusted middleware account replaces body metadata | Own account only |
| Platform Super Admin without membership | Actual HTTP session request | Denied |
| Permission/membership revocation | Fresh HTTP membership check and populated-cache permission-loss test | Denied before reasoning |
| Session reuse by other tenant or user | Actual shared session service | Session not found |
| Follow-up history | Real service with separate A/B sessions and mode switches | Own history only; resets verified |
| Account freshness | Mutate fictional catalog between accepted turns | Updated authorized catalog retrieved |
| Search leakage | Real scoped PostgreSQL text-search repository builder | Own positive result; foreign marker absent; foreign run denied |
| Cache and job disclosure | Identical text under different tenants; separate users; guessed foreign job ID | Separate model calls; foreign job absent |
| Provider context | Captured model input and returned echo-eligible answer; avatar creation receives no account arguments | No foreign source marker |
| Foreign report/flight/account inputs in Demo | Strict HTTP body allowlist and context validation | Rejected before model |
| Unknown page/mode or analysis ID in account/guide scope | Context validator | Rejected |
| Oversized catalog/history/context | 51-contract and 201-run fixture boundaries; existing generation context-limit tests | Explicit refusal, no silent truncation |
| Unscoped vector/semantic or remote-report fallback | No such Matt path; source guards plus query adapter rejecting RPC | Unavailable, not falsely marked as a tested vector database |
| Idle room | Server lifecycle and browser timer/cleanup test | Provider cleanup; later turn denied |

Foreign identifiers sent in an unsupported field do not establish an
independently addressable document/report API: Matt does not have one.
Canonical relationship/profile/search reader tests also verify rejection
before downstream access. This is not a two-tenant production database
penetration test, nor an independent security audit. No disclosure was observed
within the fixtures; an absolute deployment-wide guarantee cannot be inferred.

## 6. Operion knowledge integration

The maintained source is [operionPlatformKnowledge.js](../shared/operionPlatformKnowledge.js),
version `2026-11-02-platform-v1`. Ten reviewed feature entries describe:
aviation OCI purpose; upload/parsing; findings; search; financial impact and
recommendations; aviation/Globe; reports; Matt; account permissions; roadmap.

Each entry includes status, permissions, workflow, navigation and implementation
references. Statuses distinguish `implemented`, `configuration_required`,
`demo_only` and `roadmap`. Runtime navigation is prefixed for Demo or SaaS.
The model receives source identifiers for these facts, not permission to
invent current external aviation facts or production readiness.

Maintenance rule: changes to referenced features/readiness must update the
reviewed entries and version in the same change. The test verifies required
fields and referenced files exist; it does not automatically prove prose
accuracy. Maintainer review is still required.

Prepared navigation uses these same entries, with product-documentation
provenance and source evidence. It is not a second AI engine or a contractual
analysis substitute.

## 7. Account-context integration

The account reader obtains the current server-verified name, identity and
permissions, then a fresh catalog and latest available OCI run per contract.
Schema verification used the actual `contracts.title` definition in migration
001 and `analysis_runs.created_at` in migration 002. It does not confuse a
contract title with a document filename.

Bounds:

- Maximum 50 contracts and 200 candidate analysis runs.
- Maximum 45,000 characters for assembled account analyses.
- Maximum 60,000 characters for final answer input including history/docs.
- Exceeding any bound produces an explicit error directing a selected-contract
  review; there is no silent partial-portfolio answer.

Coverage is latest available analysis, not every amendment/version. Missing or
failed analysis is not absence of obligations/risk. No currency normalization,
automatic exposure ranking, inferred overdue status or external aircraft feed
was added. A large account may need selected-context review instead.

Reports remain browser-session views of completed responses, not a server-side
account report index. SaaS live flight/telemetry context and general external
research remain unavailable without an independently authorized data source.

## 8. OCI integration

Selected and account reasoning use canonical clauses, obligations, deadlines,
risks and evidence. The SaaS adapter also calls the existing financial-impact
and aviation-relationship readers; no parallel calculation engine was added.
Financial inputs, attribution, trigger dates, conditions and missing evidence
remain material limitations.

Valid citation identifiers establish source membership, not semantic
entailment, extraction accuracy or legal correctness. Human review is required.
Product documentation cannot establish a lease obligation. Recommendations do
not execute notices, change records or approve decisions.

## 9. Demo feature parity

Demo supports the same three question scopes through the same reasoning/session
factories, microphone lifecycle and video transport. Actual local HTTP tests
exercise capability -> router -> prepared context -> gateway -> response.
Only model generation and external media are injected.

Its catalog has four prepared agreements. Because the non-primary agreements
reuse lease excerpts, account context includes one representative sample
analysis and explicit per-contract coverage metadata, not four independent
reviews or multiplied exposure. The existing twenty Globe scenarios remain
selected-flight-only prepared contexts. No customer fallback is possible
through the Demo reader.

Provider errors, missing approvals and usage limits remain visible. Offline
prepared guidance is not passed off as generated avatar conversation.

## 10. Video and voice provider readiness

Existing configured design:

`captured microphone -> approved browser STT or separately approved OpenAI
Realtime input -> Operion reasoning -> validated answer -> Tavus Text Echo ->
Daily audio/video -> one video element`.

The introduction plays once and is not a live answer. Static portraits,
introduction replay, canvas test media and oscillator tones do not count as
genuine Matt output. The portrait is the launcher identity only.

No provider, face, fixed voice, billing or processing gate was activated.
Genuine video, audible fixed voice, lip-sync, emotional delivery, latency and
provider reconnection remain **BLOCKED / UNVERIFIED**. Echo bypasses perception
and does not establish emotion recognition. Persistent production Matt is not
claimed.

## 11. Physical-device test status

| Criterion | Status |
|---|---|
| Browser capture API with fake device tracks | Automated pass |
| Actual loopback microphone RTP transport | Automated pass; injected transcript |
| Actual human microphone and speech recognition | BLOCKED |
| Human-audible generated Matt voice | BLOCKED |
| Genuine generated Matt video and lip-sync | BLOCKED |
| Natural interruption/emotional response | BLOCKED with real providers |
| Physical iOS/Android/Safari behavior | NOT TESTED |

Installed desktop browsers are not physical mobile acceptance. Synthetic
transcripts are not measured transcription accuracy.

## 12. Desktop and mobile UX results

The final 51-test Chromium batch covers shared conversation/report continuity,
permissions, selected-context behavior, one-time-introduction preservation,
live consent, source display, interruptions, failure states, idle cleanup and
the new account/guide transport. Guide/report separation passes at 320, 390
and 1440 px. Existing overall Matt bounds pass at 320, 390, 768, 1024, 1440
and 1920 px. Portrait tests include device scale factors 3, 2 and 1.

Installed Edge and Chrome each pass six focused account/guide, idle and
portrait/context checks. Disconnect is visible during typed as well as spoken
interaction. Scope changes require reauthorization rather than silently
reusing a room. No production browser session was changed.

## 13. Cost controls

- Explicit identity/voice, processing, model and budget approval gates remain.
- SaaS requires existing intelligence allocation before avatar creation.
- Generation estimates above the existing threshold require confirmation.
- One room per user/organization owner; existing global process limit is three
  for the standard service and one for the bounded Demo service.
- Ten-minute absolute room lifetime; new three-minute inactivity cleanup.
  Accepted turns and approved speech negotiation count as activity, not polling.
  A continuously open speech connection does not extend an otherwise idle room.
- Browser timers visibly disconnect idle/expired media; server timers remain
  authoritative. Interruption and pending creation cleanup are retained.
- Failed/uncertain provider cleanup retains the owner lock.
- Demo retains origin-bound hashed capabilities, one-use start, ten turn
  attempts, three speech attempts, process allowance and peer throttling.
- Existing gateway usage/jobs track intelligence consumption. Session expiry
  metadata is not an independently reconciled avatar-provider invoice.

Process-local room/idle limits are not distributed or restart-proof spending
caps. Provider-side limits and measured billing reconciliation still require
approval and operational verification. Permission revocation blocks new reads;
an inaccessible old room may rely on idle/provider expiry for cleanup.

## 14. Remaining blockers, including Keep

1. External identity/fixed-voice activation, processing authority and budget.
2. Real provider/device acceptance, privacy/retention/residency review and
   deployment-specific security verification.
3. Distributed durable avatar allocation, invoice reconciliation and support
   procedures before broad or confidential use.
4. Large-account/context coverage limits and unverified real-model accuracy.
5. General live external aviation research, actual telemetry and global report
   retrieval are unavailable, not implied by the platform-guide wording.
6. Confidential paid pilot remains NOT READY.
7. Desktop acceptance safety gate and native editor Keep remain unresolved.

### Keep conflict: verified preservation, not a forced repair

The error says five files changed before their pending changes could be kept:
`mattDemoContext.js`, `mattAnswerService.js`, `Matt.jsx`, `useMattLive.js`,
`mattDemoRoutes.js`. Their current source existed before this extension.
All five were copied into the session's `platform-keep-recovery` directory
before editing; each recovery hash still matches the initial fingerprint.

The message indicates a stale file-version acceptance guard. No usable
current-session primary debug log was available, and the current chat log did
not identify the conflicting edit. The exact editor-internal cause is
therefore UNVERIFIED. Subsequent implementation edits intentionally produce
new versions; the original pending review should not be assumed current.

No Keep, Apply, Revert, Undo, Redo, checkpoint, editor-database manipulation or
index reset was used to force success. Safe follow-up is to compare the
current disk diff with the recovery snapshots and obtain a fresh editor review
or current diagnostics. Do not use bulk worktree Apply/Revert as acceptance.
The source implementation is persistent, but **native Keep is not claimed
fixed**.

## 15. Exact files changed in this extension

New:

- [shared/operionPlatformKnowledge.js](../shared/operionPlatformKnowledge.js)
- [shared/mattPreparedGuide.js](../shared/mattPreparedGuide.js)
- [services/mattContextScope.js](../services/mattContextScope.js)
- [services/mattAccountContext.js](../services/mattAccountContext.js)
- [test/matt-platform-isolation.test.js](../test/matt-platform-isolation.test.js)
- This report.

Updated relative to this task's starting state:

- [routes/mattLiveRoutes.js](../routes/mattLiveRoutes.js)
- [routes/mattDemoRoutes.js](../routes/mattDemoRoutes.js)
- [services/mattLiveService.js](../services/mattLiveService.js)
- [services/mattAnswerService.js](../services/mattAnswerService.js)
- [services/mattDemoContext.js](../services/mattDemoContext.js)
- [frontend/src/routes/Matt.jsx](../frontend/src/routes/Matt.jsx)
- [frontend/src/components/matt/useMattLive.js](../frontend/src/components/matt/useMattLive.js)
- [frontend/src/components/matt/MattSessionBoundary.jsx](../frontend/src/components/matt/MattSessionBoundary.jsx)
- [frontend/src/components/demo/OperionAssistant.jsx](../frontend/src/components/demo/OperionAssistant.jsx)
- [test/matt-live.test.js](../test/matt-live.test.js)
- [test/matt-demo.test.js](../test/matt-demo.test.js)
- [frontend/tests/matt-live-browser.test.mjs](../frontend/tests/matt-live-browser.test.mjs)
- [frontend/tests/matt-unified.test.mjs](../frontend/tests/matt-unified.test.mjs)
- [Earlier Demo report](./DEMO_MATT_FULL_FEATURE_PARITY_ACCEPTANCE_REPORT.md), historical/supersession link only.

Other dirty/untracked files predate this task. No dependency manifest,
configuration, environment file or protected worktree file was changed.

## 16. Exact tests run and results

Final comprehensive unit/backend/protocol command, from the isolated root:

```powershell
node --test test\matt-demo.test.js test\matt-platform-isolation.test.js test\matt-live.test.js test\matt-live-routes.test.js test\matt-realtime-speech.test.js test\matt-local-configuration.test.js test\analysisRunIntelligenceReadRoutes.test.js test\contract-assistant-service.test.js test\foundation-auth.test.js frontend\tests\matt-unit.test.mjs frontend\tests\matt-intelligence.test.mjs frontend\tests\matt-flight-intelligence.test.mjs frontend\tests\matt-live-client.test.mjs frontend\tests\matt-audio-permission.test.mjs frontend\tests\matt-realtime-speech.test.mjs frontend\tests\matt-demo-request.test.mjs
```

Result: **126 passed, 0 failed**.

Final browser command, from `frontend`:

```powershell
node --test --test-concurrency=1 tests\matt-live-browser.test.mjs tests\matt-unified.test.mjs tests\matt-browser.test.mjs
```

Result: **51 passed, 0 failed**. These tests run their configured local Vite
build/preview; this is not a publication or deployment. Builds were serialized.

Installed browser focused command, run once for each channel:

```powershell
$env:MATT_TEST_BROWSER='msedge'
node --test --test-name-pattern='account/guide|idle expiration|circular identity' tests\matt-live-browser.test.mjs
$env:MATT_TEST_BROWSER='chrome'
node --test --test-name-pattern='account/guide|idle expiration|circular identity' tests\matt-live-browser.test.mjs
```

Results: **Edge 6/6; Chrome 6/6**. Environment assignments were limited to their
test subprocesses; no environment/configuration file was edited.

Intermediate checks included the 62-test focused backend batch and the earlier
45-test browser regression. Initial failures were not counted as passes:
an old strict scope assertion needed the new scope fields; a validator import
accidentally loaded the database environment, fixed by separating pure scope
validation; browser checks exposed the hidden Disconnect control; new guide
checks needed correct selectors, settled scope/render state and top-level
registration. Incomplete focused harness runs were stopped, corrected and
superseded by the completed final runs above. Preview cleanup is explicit.

No live database, AI-provider, avatar-provider or real identity upload was used.

## 17. Protected file/hash verification

Verified after implementation and testing:

- **41/41 protected SHA-256 hashes unchanged** in the protected preview worktree.
- Protected worktree Git status matches the original saved status.
- **42/42 initial dirty/untracked files retained** in the isolated worktree.
- **5/5 original Keep-conflict recovery copies intact**, matching initial hashes.
- HEAD remains detached at `c043216525424a9bdd60f3ffeb6bfce2599703b9`.
- Git index remains empty; `git diff --check` passes.

Existing changes were extended only in the listed files, not discarded.
Recovery copies and initial hash manifests remain in the session workspace.

## 18. External service activation

**None.** No genuine AI/model, STT or avatar-provider calls; no identity or voice
uploads; no external spending; no customer contract processing. Test network
traffic was loopback/injected or blocked. No commit, push, merge, deployment,
branch switch, migration or production-data change was performed.

The implementation and this report are local and persistent. They do not
resolve the explicit provider, security, physical-device or editor-acceptance
blockers.
