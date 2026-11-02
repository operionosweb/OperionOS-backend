# Matt, aviation Contract Intelligence and Globe: local development report

Date: 2 November 2026. Scope: the existing isolated preview worktree.

Publication addendum: this report records the local development phase.
The founder subsequently authorized production publication of this completed
cycle. See the [publication and readiness report](OPERION_LIVE_MATT_OCI_PILOT_READINESS_REPORT.md)
for the clean release candidate, current verification results and deployment
status. Historical no-publication statements below describe the earlier phase,
not the later authorization.

**The requested genuine, responsive, synchronized Matt avatar is NOT complete.**
The local visibility, layout, evidence and deadline improvements below are real.
The supplied looping footage is an explicitly labelled identity preview, not
fulfilment of the live-avatar requirement. The confidential paid pilot remains
**NOT READY**. The desktop individual-file acceptance safety gate is unresolved.

Status meanings: **VERIFIED** means the particular local test described passed,
not production certification. **IMPLEMENTED BUT NOT VERIFIED** identifies
unexercised deployment behaviour. **BLOCKED** identifies an unavailable approval
or dependency. **NOT IMPLEMENTED** identifies absent functionality.

## 1. Initial audit

The existing permission-gated Matt experience, workspace, floating assistant,
prepared demonstration engines, flight adapter, deterministic ingestion and
intelligence stages were inspected. No replacement contract engine was added.
The first bounded baseline had 50 passing deadline/core/Globe checks.

Existing work already included shared Matt navigation and scoped, visit-only
conversation continuity. Production access uses authorized contract documents,
versions and analysis runs; demonstration paths use prepared fictional records.
These are not equivalent to unrestricted, persistent AI conversation.

## 2. Matt UX issues identified

- Competing light/dark cockpit CSS, crowded scope information and repeated controls.
- Proposal content visible before the user requested detailed review.
- Findings competing with video rather than behaving as secondary context.
- A static launcher portrait despite moving stage footage.
- Consent-aware launcher placement without equivalent downward panel placement.
- Playback errors without a clear retry path.
- Mobile status/disclosure collisions and desktop disclosure/dock collisions
  when text input expanded.

## 3. Redesign implemented

**VERIFIED locally:** a consolidated light-blue, video-first stylesheet; dominant
stage; docked desktop controls; mobile controls immediately after the stage;
progressive scope search; one findings toggle; optional response text; collapsed
review actions; simpler proposal sections instead of nested decorative cards.

Returning to a session with a completed result restores its findings. Opening
source evidence does not mark its interpretation legally verified. No generated
notice, guaranteed saving, signed inspection or real customer finding was copied
from the visual mockup.

The launcher now uses the supplied muted identity video. Stage playback errors
are explicit and retryable. The platform-only Super Admin surface remains
separate from tenant contract access.

## 4. Desktop and mobile verification

**VERIFIED locally:** Studio at 320, 360, 390, 430, 768, 1024, 1440 and 1920 pixels:

- No horizontal page overflow; stage height at least 360 pixels.
- Desktop stage retains at least 65% of layout width with findings open.
- Mobile primary controls follow the stage within 60 pixels.
- Visible buttons and summaries retain at least 44-pixel height.
- Name, status and media disclosure do not overlap.
- Expanded desktop text input does not cover the media disclosure; a
  ResizeObserver measures the actual dock height.
- Two-pixel Demo outer gutters remain. A scrollable report's inner content
  reserves its visible scrollbar width rather than hiding text under it.

Desktop/mobile screenshots were captured and visually inspected. A mobile
status overlap and a wrapping rail Close button found during inspection were
fixed before the final Studio run. Floating-panel browser assertions verify
that the panel is wholly on screen at 390 and 1440 pixels while consent is shown.

Real devices, Safari, Firefox, microphone hardware and deployed sessions were
not tested.

## 5. Real-video development progress

Two bounded implementation steps are **VERIFIED locally**, not live Matt:

1. [LITE protocol boundary](../providers/liveAvatarLiteProtocol.js), with no
   default network transport or session creation. It requires an injected sender
   and observer, waits for a connected session, validates PCM16/24 kHz/mono and
   packet size, correlates utterance IDs, seals speech, rejects late speaking
   events, distinguishes an interrupt request from provider acknowledgement,
   exposes errors/warnings and permits explicit listening/heartbeat commands.
2. [Media component](../frontend/src/components/matt/MattEnvironment.jsx) can
   attach one supplied browser MediaStream carrying live audio and video to one
   video element. It does not loop or mute that stream and does not substitute
   identity footage on failure. Missing tracks, playback failures and signalled
   track loss are explicit. Cleanup detaches listeners/media; the transport
   owner remains responsible for ending its session and stopping owned tracks.

The media test plays an actual **locally generated synthetic** canvas/audio
stream in Chromium and injects a remote-track-removal event. This proves browser
source handling, not human likeness, measured A/V synchronization, WebRTC
transport, provider interruption or emotional responsiveness.

The application has **no connected provider session or approved speech source**.
Its default remains a disclosed prerecorded identity preview. The protocol is
not connected to a token endpoint, authorized session broker, TTS, WebSocket,
LiveKit or Matt's production conversation pipeline.

## 6. Provider status and blockers

Public documentation was reviewed; no generation API or provider session was used.

| Candidate | Verified documentation | Recommendation / actual status |
| --- | --- | --- |
| LiveAvatar LITE | Rendering-only mode; PCM16 24 kHz mono; connected gate; correlated speech events; interruption and buffer acknowledgement | Preferred architectural candidate for keeping Operion's intelligence separate. Offline protocol tests only; actual integration **BLOCKED**. |
| Tavus Audio Echo | Bypasses all layers except realtime replica rendering; text/audio Echo disables its microphone transport; Echo is incompatible with perception | Conditional alternative. Operion would still own input, orchestration and interruption. **NOT IMPLEMENTED**. No emotional-perception claim. |
| Sync documented generation API | Video/audio input, asynchronous jobs, typically minutes to completion | Not a suitable default for this low-latency, interruptible requirement. **NOT IMPLEMENTED**; no asset uploaded. |

Primary sources:

- [LiveAvatar overview](https://docs.liveavatar.com/docs/lite-mode/overview.md)
- [LiveAvatar lifecycle](https://docs.liveavatar.com/docs/lite-mode/lifecycle.md)
- [LiveAvatar configuration](https://docs.liveavatar.com/docs/lite-mode/configuration.md)
- [LiveAvatar command/event contract](https://docs.liveavatar.com/docs/lite-mode/events.md)
- [Tavus Echo](https://docs.tavus.io/sections/conversational-video-interface/echo-mode.md)
- [Tavus pipeline modes](https://docs.tavus.io/sections/conversational-video-interface/quickstart/pipeline-modes.md)
- [Sync quickstart](https://sync.so/docs/quickstart.md)

Required before an external trial: explicit provider choice and activation
approval; server-side credentials; provider-accepted Matt identity and performer
rights/consent; approved fixed voice; authorized data flows, retention, residency
and spending limits. A vendor document is not proof that Operion has these.

Genuine generated human video, accepted identity/voice, measured latency and lip
sync, provider barge-in, reconnect, and sustained-session quality remain
**BLOCKED**. Emotional responsiveness is **NOT IMPLEMENTED**. No unsupported
claim of full-body gesture control or certified privacy/security is made.

## 7. Contract Intelligence improvements

**VERIFIED in focused offline tests:**

- Shared strict calendar validation rejects impossible ISO dates in profile
  metadata, deadline calculations and fuel-scenario inputs.
- ISO absolute dates are recognized; invalid numeric dates retain ambiguity.
- A date inside a relative notice expression is not mislabeled as the due date.
  Mixed unanchored intervals/calendar dates require review.
- Invalid anchors/offsets/directions, date-only hourly calculations, calendar
  overflow and unstated month-end/leap-day conventions cannot generate dates.
- Named-date definitions include Expiration Date. Conflicting or unresolved
  definitions remain ambiguous with all candidate sources; clause ordering does
  not silently decide which amendment governs.
- Deadline parser identity advances to `phase3d-deadline-parser-v2`. This is not
  a backfill or permission to reprocess completed customer analyses.
- Assistant findings require an explicit evidence relationship. Lexical overlap
  alone no longer attaches arbitrary evidence or establishes an answer.
- Unsupported findings are excluded with an explicit limitation, and no longer
  crowd supported findings out of the four-result limit.
- Grounded findings carry evidence identities and `requires_review` status.
  Existing source excerpts, pages and locators are retained separately.

The existing aviation-topic, risk, recommendation and narrow fuel-mechanism core
was retained, not replaced. This increment does not implement full amendment
reconciliation, multiple-obligation-per-clause extraction or predictive risk.

## 8. OCI functionality actually exercised

**VERIFIED locally:** real extraction of the existing synthetic DOCX fixture,
ordered text retention, malformed document rejection, deterministic segmentation,
obligation candidates, temporal parsing/materialization, risk screening,
profile construction, search/assistant behaviour and evidence provenance.

Pipeline/repository tests use offline doubles; workspace browser tests use
synthetic authorization and profile endpoints. Four workspace browser tests
exercise traceable local fuel scenarios, invalid inputs, unsupported/missing
mechanisms and absence of mutation calls.

Uploaded confidential documents, live database persistence, real authorization
in production, complete OCR, translation and full executed-lease processing
remain **IMPLEMENTED BUT NOT VERIFIED** where corresponding code exists, or
**NOT IMPLEMENTED** where the complete capability is absent. No confidential
document was requested or processed.

## 9. Accuracy and traceability

The regressions establish specific safety behaviours, **not an extraction
accuracy percentage**. There is no evaluated representative lease corpus,
measured recall, legal approval or ROI evidence.

Original text remains distinct from interpretation, review actions and
hypothetical arithmetic. Missing evidence cannot be replaced by similar words.
Conflicting dates do not receive a guessed precedence. Financial scenarios
require explicit inputs/provenance and are not invoices or confirmed exposure.

Remaining limitations include bounded regex grammars, one obligation candidate
per clause in the existing extractor, incomplete amendment/schedule treatment,
unverified page locations where ingestion does not supply them, and business-day
results needing an applicable calendar. Existing confidence numbers are not
statistically calibrated accuracy.

## 10. Globe improvements and checks

**VERIFIED:** selected-flight submit now passes the context-expanded follow-up,
not the raw question. An explicit referenced finding takes precedence over
incidental legal/financial words, so "the second finding" does not silently
switch to an unrelated exposure topic.

The existing 20 fictional routes, six inhabited continents, scenario-specific
cards, typed hypothetical amounts, conditional legal research leads, solar
lighting and imagery fallback were preserved.

Actual Chromium WebGL tests exercised every aircraft card, filters, contextual
contracts, alert selection, imagery failure, public/Demo entry points and ten
responsive widths. Noon/midnight central luminance measured **162.9 / 55.8** in
the fixed test view: this is a rendering check, not an astronomy accuracy metric.

The new selected-flight browser regression verifies the actual floating Matt
flow, ordinal follow-up, correct obligation/source and retained aircraft card.
Its first assertion incorrectly expected an internal ID in narrative text;
it was corrected to the actual contract title, with aircraft context and source
locator checked separately. The focused rerun passed.

Connecting operational telemetry to executed OCI contract records remains
**NOT IMPLEMENTED** by these fictional fixtures. Route endpoints do not establish
legal applicability; official legal URLs remain conditional research leads.

## 11. Unified assistant architecture

**VERIFIED locally with mocked transport:** main Matt, workspace Matt, floating
Matt and full report reuse the existing experience and scoped conversation.
Globe uses its own selected-flight context through the same component. No new
parallel contract engine, permission bypass or automatic extraction was added.

Conversation continuity is memory-only for the current visit. Genuine
cross-session persistent Matt and unrestricted generated conversation are
**NOT IMPLEMENTED**. Hiding text does not create speech; preview response audio
is unavailable and browser TTS is not presented as synchronized video.

The earlier platform-only visibility repair is retained: server-authorized
platform administration does not confer organization contract-read permission.
Offline browser tests assert no tenant contract/document/analysis requests from
the no-organization presence-only session.

## 12. Tests and builds

| Validation | Final evidence |
| --- | --- |
| Focused ingestion, clauses, obligations, deadlines, risks, profile, assistant, aviation core, protocol and Globe pure modules | 224/224 |
| Matt state/voice/intelligence and aviation JSX rendering | 16/16 |
| Studio desktop/mobile, proposals, media disclosure and controls | 20/20 |
| Matt routes, permission guards, consent panel, cancellation and responsive layout | 14/14 |
| Unified main/workspace/floating/report continuity | 7/7 |
| Fuel workspace browser flow | 4/4 |
| Isolated media component: local synthetic A/V and missing-audio rejection | 2/2 |
| Globe WebGL/UI suite | 16 existing checks passed; new selected-flight check passed in focused rerun |

**304 distinct checks passed across focused runs**, excluding repeated runs and
the initial baseline. This is not a claim that one full-repository suite passed.
The initial 17-test Globe run was 16 pass / 1 failed test assertion before the
correction described above.

Vite builds were actually executed by the browser suites; this was not
source-only inspection. Dist-writing suites ran serially to avoid Windows
cleanup collisions. The isolated media fixture builds in memory. All previews
were loopback-only, checked for HTTP readiness and closed after validation.
No new dependency, provider SDK, migration or deployment was needed.

Representative commands:

```powershell
node --test frontend\tests\matt-studio.test.mjs
node --test frontend\tests\matt-browser.test.mjs
node --test frontend\tests\matt-unified.test.mjs
node --test frontend\tests\matt-media.test.mjs
node --test frontend\tests\aviation-contract-core-browser.test.mjs
node --test --test-name-pattern="selected-flight Matt" frontend\tests\globe-intelligence.test.mjs
```

The Globe suite requires an existing loopback Vite preview supplied through
`CORPORATE_TEST_URL`; the temporary validation runner started and closed it.
Browser API doubles, injected recognition events and generated local media are
not proof of live provider, microphone-service or production-database readiness.

## 13. Remaining work

1. Obtain the explicit provider/identity/voice/privacy/budget decisions above.
2. Implement an authorized server-side session broker and audio orchestration,
   using existing tenant/budget boundaries rather than exposing master keys.
3. Connect the approved renderer transport to the tested media component; test
   genuine answer-specific speech/video, interruptions, failed-session cleanup,
   reconnect and desktop/mobile quality with the accepted Matt identity.
4. Evaluate representative permitted aviation documents with expert reviewers;
   measure errors, misses and traceability before claiming accuracy or capacity.
5. Connect verified aircraft/contract records only under confirmed data authority.
   Keep simulations labelled; obtain the unresolved safe acceptance decision.

No confidential pilot commencement date or market-validated price is promised.

## 14. Files changed in this bounded increment

Pre-existing dirty changes in the worktree were preserved. This list describes
this increment, not ownership of every change visible in Git.

| Files | Increment |
| --- | --- |
| [Matt route](../frontend/src/routes/Matt.jsx) | Progressive findings/proposal/scope, retained report, contextual flight submit, measured dock. |
| [MattEnvironment](../frontend/src/components/matt/MattEnvironment.jsx) | Playback failure/retry, optional single A/V stream, source/error lifecycle. |
| [Floating assistant](../frontend/src/components/demo/OperionAssistant.jsx) | Video launcher and explicit asset error. |
| [Studio CSS](../frontend/src/styles/mattStudio.css), [base CSS](../frontend/src/styles/matt.css), [floating CSS](../frontend/src/styles/mattFloating.css) | Light hierarchy, responsive stage/rail/dock, overlay fixes, consent-aware panel. |
| [Globe intelligence](../frontend/src/demo/globeIntelligenceData.js) | Referenced-finding precedence. |
| [Calendar validator](../domain/contractIntelligence/calendarDate.js) | Shared strict ISO calendar validation. |
| [Aviation core](../domain/contractIntelligence/aviationContractCore.js), [profile service](../services/phase3/intelligence/contractProfileService.js) | Reuse shared validation. |
| [Deadline service](../services/phase3/intelligence/deadlineIntelligenceService.js) | Relative/date safety, anchor conflicts, parser version. |
| [Assistant service](../services/phase3/intelligence/contractAssistantService.js) | Explicit evidence relationships, exclusions and source identities. |
| [LITE protocol](../providers/liveAvatarLiteProtocol.js) | Offline rendering-protocol boundary; no default connection. |
| [Parser tests](../test/deadline-intelligence-parser.test.js), [stage tests](../test/deadline-intelligence-stage.test.js), [profile tests](../test/contract-profile-service.test.js), [assistant tests](../test/contract-assistant-service.test.js), [protocol tests](../test/live-avatar-lite-protocol.test.js) | Safety/provenance regressions. |
| [Studio tests](../frontend/tests/matt-studio.test.mjs), [browser tests](../frontend/tests/matt-browser.test.mjs), [flight tests](../frontend/tests/matt-flight-intelligence.test.mjs), [Globe browser tests](../frontend/tests/globe-intelligence.test.mjs) | Intentional UX changes, geometry, launcher/panel and contextual continuity. |
| [Media tests](../frontend/tests/matt-media.test.mjs), [synthetic media fixture](../frontend/tests/fixtures/matt-media.jsx) | In-memory build and actual local browser media-source tests. |
| This report, [video-readiness record](matt-real-video-readiness-and-globe-repair-2026-11-01.md), [core record](aviation-contract-core-increment-2026-11-01.md) | Current bounds/results and links to this update. |

The earlier authorization/layout/workspace repairs and other dirty test/docs
files were not reverted, staged or represented as newly authored here.

## 15. GitHub, production and verdict

No commit, push, merge, branch/index operation, production change, dependency
installation, provider activation, identity upload, paid AI request or
confidential processing was performed. No Kilo Apply/Revert/Keep/Undo acceptance
mechanism was used. Source edits remain local in the isolated worktree.

**Verdict:** locally verified UX and intelligence reliability improvements, plus
an offline protocol/media foundation. **Not a completed live-avatar delivery,
not production acceptance, and not approval for a confidential paid pilot.**
