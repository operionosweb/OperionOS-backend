# Demo Matt full-feature parity: local acceptance report

Date: 2 November 2026.

For the subsequent platform/account scope extension and current test results,
see the [platform-wide acceptance report](./MATT_PLATFORM_WIDE_INTELLIGENCE_AND_SECURITY_ACCEPTANCE_REPORT.md).
This document records the earlier Demo milestone.

**DEMO MATT IMPLEMENTED — PROVIDER ACTIVATION REQUIRED.**

This is a local implementation verdict, not genuine provider/device acceptance
or permission to publish. The confidential paid pilot and desktop acceptance
safety gate remain NOT READY/unresolved.

## 1. Exact original causes

The original restriction was a combination, not merely a misleading label:

1. [useMattLive.js](../frontend/src/components/matt/useMattLive.js) explicitly
   installed the message "Live video is disabled for this public prepared-data
   demo. No provider session has been created.", rejected `demo` in `connect`,
   and exposed no connection function for Demo.
2. Its request adapter always used authenticated `/api/matt` requests.
   [mattLiveRoutes.js](../routes/mattLiveRoutes.js) correctly requires verified
   SaaS identity, organization membership and contract-read permission. A public
   browser did not possess that authority. Removing authentication was not a fix.
3. [Matt.jsx](../frontend/src/routes/Matt.jsx) always chose browser-prepared Demo
   answers, even if a future Demo live stream were connected.
4. No bounded, server-authorized public Demo context/session existed.
5. Actual provider identity, fixed voice, processing authority and spending
   approvals remain absent/unverified. Removing the Demo prohibition cannot
   honestly solve those external dependencies.

The forbidden Demo-only message and connect rejection have been removed from
application code. The actual Demo session can now be created through the shared
service when its explicit configuration is approved. Missing configuration
produces an actionable operator error; no fake session is created.

## 2. Shared architecture and data boundary

| Surface | SaaS | Demo |
|---|---|---|
| Coordinator/UI | Same `MattExperience` and `useMattLive` | Same components |
| Capture/input | Same microphone and browser/approved real-time adapters | Same adapters, permission and privacy controls |
| Request authority | Existing Supabase user, membership and contract-read gate | Server-issued origin/peer-bound, short-lived Demo capability |
| HTTP lifecycle | Existing `createMattLiveRouter` | Same router factory behind Demo authorization |
| Session/history/interruption | Existing `createMattLiveService` | Same factory; one concurrent Demo room |
| Evidence context | Authorized canonical OCI analysis readers | Fixed prepared-data reader; no customer database reader |
| Reasoning | Existing `createMattAnswerService` and AI gateway implementation | Same factories and output validation |
| Model budget | Existing organization allocation/store | Separate synthetic namespace and bounded in-memory allocation |
| Speech input | Browser service or explicitly approved OpenAI Realtime | Same selection and separate real-time approval gates |
| Voice/video | Tavus Text Echo, Daily, one remote A/V element | Same provider/client/output path |
| Findings/report | Existing session store, evidence cards and report | Same presentation, with fictional-data limitations |

Flow:

```text
explicit consent / Connect
 -> Demo status + one-use capability
 -> shared session router / shared live service
 -> native captured microphone track
 -> selected speech adapter / final transcript
 -> shared turn endpoint
 -> server-resolved prepared context
 -> existing evidence-grounded answer service + budgeted AI gateway
 -> validated answer text
 -> existing Tavus Text Echo / Daily audio and video
```

No separate Demo chatbot, LLM pipeline, speech renderer or intelligence engine
was created. A separate budget **instance of the existing gateway implementation**
keeps anonymous Demo expenditure and conversations out of customer budget/job
storage. It is not a customer organization with elevated permissions.

### Single source of prepared data

- [mattDemoContracts.js](../shared/mattDemoContracts.js): existing prepared
  contract records moved intact out of the React provider.
- [globeScenarioData.js](../shared/globeScenarioData.js): existing fictional
  route/contract/evidence scenarios extracted without Cesium/browser dependencies.
- Existing frontend modules re-export/use these records; frontend-only route
  position/heading calculations remain in the Globe wrapper.
- [mattDemoContext.js](../services/mattDemoContext.js) registers four prepared
  agreement IDs and twenty prepared flight IDs. Opaque internal analysis UUIDs
  are server-generated mappings, not accepted public customer analysis IDs.
- `readMattDemoContext` checks the fixed synthetic namespace and returns cloned
  context, never a database/customer lookup.
- Context includes clauses, obligations, deadlines, risks, source excerpts,
  financial assumptions, review recommendations, and selected aircraft/flight
  scenario. Explicit scenario evidence distinguishes assumed financial inputs
  from executed-contract excerpts.
- Other agreement types reuse primary lease excerpts. Both UI and prompt state
  that these are not independent analyses. No complete amendment reconciliation,
  live tracking, verified exposure or measured accuracy is implied.
- Globe answers receive only their selected flight's scenario, not the primary
  lease or a browser-supplied flight object.

When live Matt is disconnected, the pre-existing prepared review path remains
available and labelled. It is not presented as generated AI speech/video.
When connected, Demo questions and follow-ups go to the shared server engine;
prepared frontend answers are not substituted for failed live generation.

## 3. Public access and abuse controls

[mattDemoRoutes.js](../routes/mattDemoRoutes.js) is mounted before generic CORS,
the 50 MB body parser, and tenant middleware. SaaS routes retain all existing
authentication, membership and permission checks.

| Control | Implementation |
|---|---|
| Origins | Exact explicit HTTPS origins, or explicit HTTP loopback origins; no wildcard. Browser GET may use the exact Referer origin when Origin is absent. Other mutations require Origin. |
| Capability | Cryptographically random 32-byte value, only SHA-256 digest retained by server, no-store responses; no localStorage or URL credential |
| Binding | Exact origin, socket peer digest, random Demo owner and returned parent session ID |
| Validity | 20-minute capability; room start within 60 seconds; one start attempt per capability |
| Parent lifecycle | Existing 600-second room lifetime, expiry cleanup, explicit disconnect and page-leave cleanup |
| Concurrent cost | One Demo room including pending creations and unresolved cleanup |
| Process allowance | Explicit operator allocation of 1-12 capability authorizations for the entire process lifetime; no automatic hourly global refill |
| Per-peer access | Three issued capabilities per hour |
| Request throttle | 240 requests/hour/peer; bounded map capacity; no caller-controlled forwarding header used as identity |
| Safe termination | Authenticated DELETE/interruption remains available after request throttle is exceeded |
| Turn budget | Ten question attempts per capability, including unsuccessful generation/confirmation requests |
| Speech budget | Three speech-create attempts per capability; shared single-active-child rules and expiry |
| Intelligence | Dedicated hard-limited allocation of 1-3000 existing gateway units; readiness checked before avatar/speech cost |
| Input | 64 KB JSON body, bounded question/SDP validation, exact permitted fields/query keys |
| Scope attacks | SaaS Authorization/x-org-id, body tenant/user/evidence fields, customer UUIDs, foreign sessions and unknown Demo aliases rejected |
| Privilege | Capability grants only this Matt namespace; no upload, customer/admin route or mutation privilege |
| Errors | Explicit, redacted failure codes; no provider content/credentials in diagnostics |

Capabilities authenticate a bounded anonymous session, not a person's real
identity. Origin checks are browser protections, not authentication of a human;
non-browser clients can spoof headers. Public callers can exhaust the allowance.
An attacker behind a common proxy may deny access to other visitors.

**These are process-local controls, not distributed production controls.**
Restart resets allocations and loses provider handles; replicas do not share
quotas. Socket-based throttling deliberately shares a bucket behind a proxy
rather than trusting spoofable forwarding headers. Operator approval explicitly
attests single-process execution. Durable edge/account controls, restart policy,
provider caps, monitoring and incident cleanup must be assessed before public
external activation. Uncertain provider cleanup remains a blocker, not success.
No production-grade isolation, TLS audit or security certification is claimed.

## 4. Configuration and provider activation

No environment file or production setting was changed. The field-only offline
[validator](../scripts/validate-matt-local.js) now includes Demo readiness and
limits without reading environment files or contacting any provider.

Existing live approvals/keys/identity/voice/model configuration remain required.
For Demo, operators must additionally approve:

```text
MATT_DEMO_ENABLED
MATT_DEMO_APPROVAL_ID
MATT_DEMO_SINGLE_PROCESS_APPROVED
MATT_DEMO_ALLOWED_ORIGINS
MATT_DEMO_MAX_SESSIONS
MATT_DEMO_INTELLIGENCE_BUDGET
```

The existing `MATT_LIVE_ORGANIZATIONS` allowlist must explicitly include the
fixed synthetic namespace `00000000-0000-4000-8000-00000000de00`.
It is a reserved local Demo namespace, not a customer tenant-selection option.
`MATT_DEMO_ORGANIZATION_ALLOWLIST` is a diagnostic name, not a new secret/key.

Real-time speech still needs the independent fields documented in the
[activation checklist](MATT_EXTERNAL_ACTIVATION_CHECKLIST.md). Missing approval
does not silently fall back to another processor. Browser STT remains the
existing default, not a claim that external speech processing is already active.

Current inherited-process validation: live BLOCKED; Demo BLOCKED; configured
session allowance 0; configured Demo intelligence allowance 0. No external
configuration was activated by these changes.

### Cost and privacy

At the maximum approved process allowance, twelve 600-second rooms could
represent approximately 120 room-minutes, excluding uncertain creation,
provider rounding, cancellation/billing behavior or operator restarts.
Muted/idle rooms may still be billable. Ten answer attempts and three speech
attempts are not euro/dollar caps. Model intelligence units are not measured
provider invoices. See the existing [provider comparison](MATT_PROVIDER_COMPARISON.md)
for sourced pricing assumptions; no new quote or measured cost is asserted.

Prepared evidence is non-confidential, but visitors' spoken/typed questions may
contain personal or confidential material. UI consent explicitly excludes
customer information; this wording cannot prevent all inappropriate speech.
Provider DPAs, retention, lawful processing, identity/voice rights and public
usage authority require approval. No likeness asset was uploaded.

## 5. Floating Matt identity

[OperionAssistant.jsx](../frontend/src/components/demo/OperionAssistant.jsx)
now uses the existing local
[executive-office.jpg](../frontend/public/matt/executive-office.jpg), not a new
face, generated image or generic video icon.

- Circular 40 px clipping container, face-centered crop/zoom, high-resolution
  source suitable for tested device densities.
- Existing light palette, subtle border/shadow, explicit keyboard focus ring.
- Existing button labels/expanded state, Enter activation, Escape dismissal and
  focus restoration retained. Decorative image has empty alternative text.
- No fake live/available dot, loop, animation or second avatar player.
- The portrait is a launcher identity icon, never a substitute for live Matt.
- Opens the same `MattExperience` component; contract, authorized organization
  and selected prepared Globe flight context are retained through expansion.
- All four prepared agreement IDs remain selectable after expansion; this fixes
  the previous non-primary agreement reset to the primary lease.
- Mobile safe-area/navigation/consent offsets and desktop layout remain in use.

The integrated local browser screenshot was inspected: Matt's actual face is
clear inside the circular launcher. No external image service was involved.

## 6. Automated versus genuine acceptance

Verified locally:

- Actual HTTP origin, capability, scope, expiry, quota and invalid-request
  behavior with the real router/session/answer/gateway implementations.
- Actual frontend -> local HTTP capability -> shared router -> prepared reader
  -> shared answer service/gateway -> client delivery; model and avatar output
  injected, not external.
- Actual native fake-device `getUserMedia` tracks.
- Actual browser `RTCPeerConnection` sender/receiver and increasing microphone
  RTP in both Demo and SaaS, with injected transcript/VAD events.
- Actual application interruption, follow-up, mute, replacement/reconnection,
  consent withdrawal, recovery and cleanup paths.
- Prepared flight/contract evidence, fictional limitations and history reset
  across distinct analysis contexts.
- Launcher identity, keyboard action, context/expansion and responsive bounds.

Not verified:

- Physical human microphone/speaker, genuine STT/model inference or actual
  Tavus/Daily Matt voice/video.
- Approved production face/fixed voice, lip-sync, emotional delivery,
  emotion recognition, latency, perceived quality or reliability.
- Physical mobile/Safari behavior, production TLS/tenant isolation, durable
  account-wide limits or paid-pilot security readiness.

Synthetic avatar output is a canvas plus oscillator tone, **not Matt speaking**.
The actual HTTP-chain test injects a model adapter; it proves wiring, not AI
answer quality. Real-time tests inject transcripts after real RTP transport;
they do not prove transcription accuracy. Source-ID validation does not prove
factual entailment. Tavus Echo has no perception: no emotion recognition claim.

### Test results

- Backend/shared-unit/audio/contract regression batch: **107/107 passed**.
- Demo configuration/transport regression after diagnostic extension:
  **16/16 passed**.
- Chromium live/permission/browser batch, including real local HTTP chain:
  **37/37 passed**.
- Chromium once-only introduction/shared workspace/media batch:
  **16/16 passed** in the earlier combined 38-test run; the later new HTTP test
  was separately verified in the 37-test batch above.
- Shared Globe data and aircraft geometry: **6/6 passed**.
- Installed Chrome live/permission/Demo suite: **23/23 passed**.
- Installed Edge live/permission/Demo suite: **23/23 passed**.
- Full Globe contextual browser/data/geometry batch: **23/23 passed**.
  Includes every prepared aircraft card, selected-flight Matt and widths
  320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px.
- Final focused HTTP/RTP/portrait batch: **5/5 passed**. Portrait/context tests
  used actual browser device scale factors 3 at 320 px, 2 at 390 px and 1 at
  1440 px; source resolution, circular bounds and keyboard interaction passed.

Initial wider checks found two test issues, not silently ignored: an obsolete
assertion forbade any launcher image, and the added HTTP fixture returned a
conversation ID inconsistent with its synthetic Daily messages. Both were
corrected; the full affected 37-test batch then passed. A first Globe browser
invocation lacked its required local preview and failed with connection refused;
it was rerun against a verified responsive loopback preview.

### Acceptance scenario status

| Requested steps | Local outcome |
|---|---|
| 1-3: Demo entry, Matt, no Demo-only prohibition | Verified in browser |
| 4: Authorized session | Real local HTTP lifecycle verified with injected provider; genuine external session BLOCKED |
| 5-6: Microphone/audio received | Fake-device capture and actual loopback RTP verified; physical/external STT BLOCKED |
| 7: Answer from prepared data | Shared context/gateway wiring verified with injected model; real inference BLOCKED |
| 8: Genuine voice/live video | BLOCKED; not replaced by synthetic acceptance |
| 9-11: Follow-up, interrupt, continue | Shared automated/synthetic lifecycle verified; genuine provider behavior BLOCKED |
| 12-13: Contract clause/evidence | Prepared reader, HTTP and UI routing verified; no real-contract accuracy claim |
| 14-16: Globe selected context | Selected-flight isolation and shared live request verified using prepared data |
| 17-19: Floating portrait/shared assistant | Verified at 320, 390 and 1440 px, keyboard and expansion |
| 20: No customer data access | Positive/negative route/context tests passed; not a production penetration test |

## 7. Local startup and repeatable checks

Working directory:
`C:\Users\meeli\Operion OS GitHub\OperionOS-matt-live-intro-2026-11-02`.
Use `npm.cmd` on this Windows host. Do not copy secrets into these instructions.

Safe offline configuration diagnosis, no environment-file loading/network:

```powershell
node scripts\validate-matt-local.js
```

Exit 1 is expected while blocked. Presence/syntax alone never establishes
real-provider acceptance. This command does not start the application.

Focused server/transport checks:

```powershell
node --test test\matt-demo.test.js test\matt-live.test.js test\matt-live-routes.test.js test\matt-realtime-speech.test.js test\matt-local-configuration.test.js frontend\tests\matt-demo-request.test.mjs
```

Frontend tests build temporary local frontend output and run their own preview;
all remote browser requests are aborted or intercepted:

```powershell
Set-Location frontend
node --test --test-concurrency=1 tests\matt-live-browser.test.mjs tests\matt-browser.test.mjs tests\matt-unified.test.mjs tests\matt-media.test.mjs tests\matt-introduction.test.mjs
```

Run these serially because multiple suites write the same ignored frontend
output. Installed Chrome/Edge use `MATT_TEST_BROWSER=chrome` or `msedge` in that
test process. No provider is contacted by the fixture.

For static local UI/Globe inspection only:

```powershell
Set-Location frontend
node --input-type=module -e "import {preview} from 'vite'; await preview({preview:{host:'127.0.0.1',port:4192,strictPort:true}})"
```

Verify HTTP responsiveness before running Globe tests. Stop this specific helper
after inspection. Do not expose it publicly or mistake test-built synthetic
Daily output for a release build.

Do not casually run the real backend against existing unknown environment
credentials. Genuine full-application startup requires an operator-reviewed
local auth/data environment, approved provider configuration and a separately
authorized bounded acceptance session. No such session was authorized here.

## 8. Changed surfaces and preservation

Task-specific implementation/extensions:

- `index.js`: bounded Demo namespace before generic middleware.
- `routes/mattDemoRoutes.js`: public boundary, capability, limits, shared router.
- `services/mattDemoConfiguration.js`, `services/mattDemoContext.js`: approvals
  and fixed prepared source mapping.
- `services/mattLiveService.js`: configurable global room limit, default SaaS
  behavior unchanged.
- `services/mattAnswerService.js`: shared fictional-context prompt/limitations
  and available prepared review suggestions.
- `shared/mattDemoContracts.js`, `shared/globeScenarioData.js`: shared source data.
- Frontend Demo provider/Globe wrapper and `mattDemoAdapter.js`: consume shared
  records without browser/backend data duplication.
- `useMattLive.js`, `mattDemoRequest.js`, `Matt.jsx`, `MattEnvironment.jsx`:
  authorized Demo transport, shared submit/lifecycle, honest consent/scope text.
- `OperionAssistant.jsx`, `mattFloating.css`: portrait launcher.
- Backend Demo/validator tests and frontend Demo transport/live/permission tests.
- Offline validator, this report and directly related architecture/checklist
  addenda. Prior acceptance evidence remains historical, not rewritten as live
  success.

All prior 25 local files still exist: 15 byte-identical and 10 intentionally
extended (three directly related documentation addenda, seven implementation/
test/diagnostic extensions). Their earlier speech/media/lifetime work remains
in place; no reset, clean, revert or acceptance action was used.

Final safety checks:

- 41/41 protected SHA-256 fingerprints match.
- Original preview worktree status: zero differences from saved baseline.
- Older publication worktree: clean.
- Current worktree: detached at
  `c043216525424a9bdd60f3ffeb6bfce2599703b9`.
- Index: zero staged changes. `git diff --check`: clean.
- Complete local inventory: 20 modified tracked and 22 untracked files. This
  includes preserved work from earlier milestones, not 42 newly changed files.
- No commit, push, merge, deployment, production configuration/infrastructure
  change, identity upload, paid provider/model call, subscription or agreement
  action occurred. Production was not operated on by this task.
- Temporary loopback preview stopped after testing; no backend/provider helper
  is left running.

Complete combined local inventory:

```text
Modified tracked:
frontend/src/components/demo/OperionAssistant.jsx
frontend/src/components/matt/MattEnvironment.jsx
frontend/src/components/matt/mattMicrophone.js
frontend/src/components/matt/tavusEchoClient.js
frontend/src/components/matt/useMattLive.js
frontend/src/demo/DemoDataProvider.jsx
frontend/src/demo/globeIntelligenceData.js
frontend/src/demo/mattDemoAdapter.js
frontend/src/routes/Matt.jsx
frontend/src/styles/mattFloating.css
frontend/tests/fixtures/daily-synthetic.js
frontend/tests/matt-audio-permission.test.mjs
frontend/tests/matt-browser.test.mjs
frontend/tests/matt-live-browser.test.mjs
frontend/tests/matt-live-client.test.mjs
index.js
routes/mattLiveRoutes.js
services/mattAnswerService.js
services/mattLiveService.js
test/matt-live-routes.test.js

Untracked:
docs/DEMO_MATT_FULL_FEATURE_PARITY_ACCEPTANCE_REPORT.md
docs/MATT_EXTERNAL_ACTIVATION_CHECKLIST.md
docs/MATT_LIVE_AUDIO_VIDEO_LOCAL_ACCEPTANCE_REPORT.md
docs/MATT_LIVE_INTEGRATION_DESIGN.md
docs/MATT_PROVIDER_COMPARISON.md
docs/MATT_REALTIME_ARCHITECTURE_ASSESSMENT.md
docs/MATT_REALTIME_LOCAL_TEST_REPORT.md
frontend/src/components/matt/mattDemoRequest.js
frontend/src/components/matt/mattRealtimeSpeech.js
frontend/tests/matt-demo-request.test.mjs
frontend/tests/matt-realtime-speech.test.mjs
providers/openaiMattSpeechProvider.js
routes/mattDemoRoutes.js
scripts/validate-matt-local.js
services/mattDemoConfiguration.js
services/mattDemoContext.js
services/mattSpeechConfiguration.js
shared/globeScenarioData.js
shared/mattDemoContracts.js
test/matt-demo.test.js
test/matt-local-configuration.test.js
test/matt-realtime-speech.test.js
```

## 9. Remaining external dependencies and verdict

1. Operator-approved Tavus account, Matt face/fixed voice, Echo mode and
   separately approved STT/model processing and budget.
2. Approved Demo origins, allocation and single-process deployment boundary;
   durable provider/edge cost controls and restart/cleanup policy.
3. Real human device/provider acceptance for microphone, transcription, answer,
   speech/video, follow-up, interruption, synchronization and termination.
4. Human review of fictional versus real-world claims and available evidence;
   privacy/security/procurement review before any confidential pilot.
5. Separate explicit authorization before publication. This task authorized none.

**DEMO MATT IMPLEMENTED — PROVIDER ACTIVATION REQUIRED.**
No genuine speech/video success, production readiness, paid pilot readiness,
security certification, emotional responsiveness or measured ROI is claimed.
