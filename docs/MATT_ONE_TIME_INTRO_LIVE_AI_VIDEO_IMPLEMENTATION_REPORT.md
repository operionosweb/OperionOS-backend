# Matt: one-time introduction and live AI video implementation

Research and verification date: 2 November 2026.

Development location: `OperionOS-matt-live-intro-2026-11-02`, an isolated, detached worktree based on `9bc748fd73a48e027a0d74007e4165fa7dfe9812`.

**Overall status: PARTIALLY IMPLEMENTED. Final verdict: LIVE MATT NOT READY.**

The one-time introduction and an actual, disabled-by-default Tavus Text Echo / Daily / Operion AI gateway integration are implemented locally. The integration uses real REST and SDK interfaces, not an animation presented as AI. Its tests use injected services and explicitly synthetic media. No genuine provider conversation or model generation was executed. External approvals, approved identity and voice, account configuration, operational controls and genuine end-to-end acceptance remain necessary. This report does not authorize activation or deployment.

## 1. Existing architecture and root cause

Status: VERIFIED.

- Published Matt used the supplied `reference.mp4` as looping identity footage. It was not generated video or synchronized speech.
- The shared Matt experience already connected the main page, workspace, floating assistant, findings and report to selected-contract intelligence. Demo flights used explicitly illustrative scenario data.
- Existing production contract answers came from the structured `answerContractQuestion` evidence-selection service, not a conversational language model.
- The existing AI gateway already supported Mistral/OpenRouter, organization budgets, confirmation, cache, job records and durable usage accounting. The separate phase-three OpenAI provider was not an implemented alternative.
- The existing LiveAvatar LITE module was an offline protocol boundary, not a complete session broker, media transport or approved TTS stack.
- Existing authentication, organization membership, contract permissions and analysis-run readers were reused. Platform-only visibility is not permission to read tenant contracts.

Replacing an unavailable message with prerecorded footage could not resolve the missing live generation/media stack. This implementation changes that stack rather than relabelling footage.

## 2. Implemented behavior and state model

Status: IMPLEMENTED.

The shared video stage now plays a non-looping introduction, then removes its prerecorded source. It displays either an actual connected audio/video stream or an explicit unavailable/connection boundary. There is no portrait, fake talking animation, browser-TTS-over-footage or repeated introduction used as a live response.

| State | Implemented behavior |
|---|---|
| INTRODUCTION | Owned, one-time playback with progress retention, sound opt-in and skip |
| READY | Connection boundary, or connected provider with both media tracks |
| LISTENING | Explicit browser speech recognition after separate privacy acknowledgement |
| PROCESSING | Authorized generation or waiting for the provider to start speech |
| SPEAKING | Provider started-speaking event for the selected remote participant |
| INTERRUPTED | Immediate local mute, generation cancellation and provider interruption |
| RECONNECTING | Explicit connect or transport-recovery state with timeout |
| ERROR | Visible failure; failed live media is not replaced with identity footage |

These are lifecycle states, not proof of correct facial animation or response accuracy. Existing findings/report reducer states remain separate from provider speaking states.

The floating launcher is now a video-icon control, not a second looping Matt player. The existing premium stage, context, evidence, findings, proposal and report surfaces remain in use.

## 3. File inventory

Status: IMPLEMENTED.

New implementation:

- [mattIntroduction.js](../frontend/src/components/matt/mattIntroduction.js): shared per-session introduction ownership, progress and completion.
- [tavusEchoClient.js](../frontend/src/components/matt/tavusEchoClient.js): real Daily transport, exact-text Echo, speaking/interruption protocol and cleanup.
- [useMattLive.js](../frontend/src/components/matt/useMattLive.js): authenticated session/turn lifecycle, consent, cancellation and generation confirmation.
- [tavusEchoProvider.js](../providers/tavusEchoProvider.js): server-only Tavus PAL verification and private conversation creation/termination.
- [mattLiveService.js](../services/mattLiveService.js): approval gates, owner/tenant session boundaries, bounded lifetime and scoped history.
- [mattAnswerService.js](../services/mattAnswerService.js): actual gateway generation from authorized intelligence, output-shape and evidence-ID checks.
- [mattLiveRoutes.js](../routes/mattLiveRoutes.js): protected status, session, turn, interrupt and termination endpoints.

Updated application surfaces:

- [MattEnvironment.jsx](../frontend/src/components/matt/MattEnvironment.jsx), [Matt.jsx](../frontend/src/routes/Matt.jsx), [MattProposal.jsx](../frontend/src/components/matt/MattProposal.jsx), [OperionAssistant.jsx](../frontend/src/components/demo/OperionAssistant.jsx) and [matt.css](../frontend/src/styles/matt.css).
- [apiClient.js](../frontend/src/lib/apiClient.js): optional keepalive for session cleanup.
- [aiGateway.js](../services/ai/aiGateway.js): optional cancellation signal forwarded to existing model providers; existing budget/accounting behavior retained.
- [index.js](../index.js): mounts the protected Matt router.
- Frontend manifest/lockfile: real `@daily-co/daily-js` dependency, version 0.87.0. Installed only in the isolated frontend after the manifest change.

New tests:

- [matt-live.test.js](../test/matt-live.test.js), [matt-live-routes.test.js](../test/matt-live-routes.test.js).
- [matt-live-client.test.mjs](../frontend/tests/matt-live-client.test.mjs), [matt-introduction.test.mjs](../frontend/tests/matt-introduction.test.mjs), [matt-live-browser.test.mjs](../frontend/tests/matt-live-browser.test.mjs).
- Test-only [daily-synthetic.js](../frontend/tests/fixtures/daily-synthetic.js) and [matt-introduction.jsx](../frontend/tests/fixtures/matt-introduction.jsx).

Updated related tests: Matt browser/studio/unified suites and the analysis-reader assistant fixture. The latter gained the explicit source-evidence link required by existing grounding behavior; production evidence requirements were not relaxed.

## 4. One-time introduction verification

Status: VERIFIED, within the tested browser/session boundaries.

- Native looping and native autoplay are disabled. The owning component explicitly starts playback, initially muted for browser compatibility.
- The existing supplied MP4 remains the introduction. No newly narrated introductory script or newly approved voice identity was created.
- Natural completion, skip and load/playback failure mark completion and remove the video.
- A module-level store coordinates ownership across mounted surfaces. `sessionStorage` retains progress/completion across compatible navigation and reload in the same tab.
- Introduction keys distinguish demo from the authenticated user; contract, flight and organization context changes do not deliberately start a new introduction.
- Remount during playback resumes saved progress rather than starting at zero. Progress is periodically persisted; a hard refresh can resume approximately one checkpoint earlier.
- Storage failures are logged and fall back explicitly to visit-memory retention. Cross-tab, cross-device and durable-account completion are not promised.
- Chromium decoded and advanced the actual MP4. A byte-range-capable local fixture exercised its actual `ended` event, not only a mocked event.
- Cross-surface tests covered skipped introduction -> findings -> workspace floating Matt -> expanded Matt, without restoring footage.
- The consent panel is scrollable from its beginning. Additional 320px/390px tests caught and corrected vertically centered, unreachable text.

## 5. Provider research and selection

Status: VERIFIED for the cited documentation; PARTIALLY IMPLEMENTED for the selected integration.

All sources below were accessed on 2 November 2026. Documentation describes interfaces; it does not demonstrate that this application's account, Matt identity or voice is configured correctly.

| Provider | Documented approach | Assessment |
|---|---|---|
| Tavus Text Echo + Daily | Operion supplies answer text; provider supplies matching TTS/rendered video over a private Daily room | Selected primary path: preserves Operion orchestration instead of delegating the answer to an unrelated avatar chatbot |
| LiveAvatar LITE | Renderer with separately supplied AI/TTS stack and streamed PCM audio | Fallback architecture only; requires its own approved STT/LLM/TTS and LiveKit/WebSocket integration |
| Sync | Asynchronous lipsync generation jobs, normally completing over minutes | Not selected for default realtime, interruptible conversation; batch generation is not realtime acceptance evidence |

Primary official sources:

- [Tavus Echo mode](https://docs.tavus.io/sections/conversational-video-interface/echo-mode).
- [Create conversation](https://docs.tavus.io/api-reference/conversations/create-conversation.md), [end conversation](https://docs.tavus.io/api-reference/conversations/end-conversation.md), [get PAL](https://docs.tavus.io/api-reference/pals/get-pal.md).
- [Private rooms](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/private-rooms.md), [call duration/timeouts](https://docs.tavus.io/sections/conversational-video-interface/conversation/customizations/call-duration-and-timeout.md), [TTS](https://docs.tavus.io/sections/conversational-video-interface/pal/tts.md).
- [Interaction protocols](https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview.md), [Echo schema](https://docs.tavus.io/sections/event-schemas/conversation-echo), [interrupt schema](https://docs.tavus.io/sections/event-schemas/conversation-interrupt), [speaking events](https://docs.tavus.io/sections/event-schemas/conversation-started-stopped-speaking). Rendered schema pages were consulted where Markdown responses were empty.
- [Daily app-message limits](https://docs.daily.co/reference/daily-js/instance-methods/send-app-message), [participant events](https://docs.daily.co/reference/daily-js/events/participant-events), [lifecycle events](https://docs.daily.co/reference/daily-js/events/lifecycle-events.md).
- [LiveAvatar LITE overview](https://docs.liveavatar.com/docs/lite-mode/overview), [LITE lifecycle](https://docs.liveavatar.com/docs/lite-mode/lifecycle.md): own AI stack, PCM16 24kHz mono input and interruption lifecycle. The overview documents one credit/minute; this is not an approved account quote.
- [Sync quickstart](https://sync.so/docs/quickstart).

Pricing and processing caveats:

- [Tavus pricing](https://www.tavus.io/pricing) displayed 25 free conversational minutes, Starter at $59/month for 100 minutes and Growth at $397/month for 1,250 minutes, with pay-as-you-go/no-overage-limit wording. This snapshot is not an account-specific Echo quote, an authorized subscription or a hard spending ceiling.
- [Tavus privacy policy](https://www.tavus.io/privacy-policy) distinguishes website policy from processing governed by business customer agreements. It does not establish an approved DPA, EU residency or Operion compliance.
- No account, subscription, identity upload, voice enrollment, purchase or provider/model call was performed.

## 6. Actual generation and integration status

Status: PARTIALLY IMPLEMENTED.

The implemented path is:

1. Authenticated browser supplies its existing bearer token and organization header.
2. Server checks verified user, active membership and `contract:read`.
3. Explicit approvals, organization allowlist, processing acknowledgement, configured model and minimum intelligence budget are checked before room creation.
4. Server verifies the approved PAL's fixed voice and absence of an automatic greeting, then requests a private, unrecorded, time-bounded conversation.
5. Browser joins with a scoped room credential through the actual Daily SDK. Microphone and camera transmission are disabled.
6. A question identifies an existing analysis run. Server-side readers obtain authorized clauses, obligations, deadlines, risks and evidence.
7. The existing gateway generates structured interpretation using the selected Mistral/OpenRouter path, organization budgeting and any required consumption confirmation.
8. Output shape and source IDs are validated before the exact accepted answer text is sent as `conversation.echo`.

The generated answer is explicitly labelled as interpretation requiring human review. Demo and disconnected structured answers remain labelled as such and are not spoken as fake live responses.

The PAL's fixed `voice_id` is checked through its API response. Echo pipeline mode still requires explicit operator approval and real account verification; the researched GET response did not establish a reliable automatic pipeline-mode check. Configuration flags record intended gates, not independently verified approvals.

## 7. Voice input and fixed voice

Status: PARTIALLY IMPLEMENTED.

- Typed questions and explicit browser speech recognition are wired into the same selected-contract workflow.
- Speech recognition has its own privacy acknowledgement because the browser/vendor may process microphone audio outside Operion. No approved private STT deployment is claimed.
- In connected live mode, final transcripts submit automatically. In demo/disconnected mode they populate the composer for review.
- There is no browser speech-synthesis answer path in Matt. Provider TTS, not a browser-selected substitute voice, is intended to voice accepted answers.
- Voice identity, pronunciation, stability, continuity with the introductory MP4 and actual microphone quality have not been accepted with a real provider.
- Text Echo bypasses perception/STT/LLM on the avatar side. Emotion recognition or emotionally responsive facial behavior is NOT IMPLEMENTED as a verified capability.
- Unsupported recognition, denial, transport failure and missing configuration are surfaced rather than silently replaced.

## 8. Audio/video synchronization and media transport

Status: PARTIALLY IMPLEMENTED.

The adapter waits for live audio and video tracks from the same remote participant and combines them into one `MediaStream`. Video-only input, lost tracks, extra remote participants and disconnects produce explicit failure. There is no independent browser-TTS clock.

Daily messages enforce its 4,096-byte UTF-8 limit, including Unicode expansion. This can reject an otherwise valid 2,000-character answer rather than silently truncating it.

Provider events are restricted to the selected participant, conversation identity when supplied, PAL role, recognized event type, safe monotonic sequence and inference identifier. The adapter tracks the provider-normalized identifier instead of assuming it equals the submitted turn ID. No webhook endpoint was introduced.

Connection/start, completion and interruption deadlines are 20 seconds, 120 seconds and 5 seconds respectively. These are failure bounds, not measured performance targets. Actual lip-sync offset, first-audio latency, frame continuity, emotional expression, network recovery and voice/video quality remain BLOCKED pending genuine acceptance.

## 9. Follow-ups, interruption, reconnect and cleanup

Status: PARTIALLY IMPLEMENTED.

- The server retains at most 12 user/assistant messages within one active session and analysis run. Switching analysis discards that live history.
- Follow-ups use the actual previous generated text, not only ordinal expansion of a prepared result.
- Interruption immediately mutes local playback, aborts generation through the existing gateway and sends the provider interruption event. A subsequent answer waits for the provider stopped-speaking acknowledgement.
- Cancellation suppresses late response publication and history changes. Already-incurred provider costs cannot be promised refundable.
- Context change, unmount, page exit, consent withdrawal and provider errors attempt client and server cleanup. Late successful session creation is explicitly terminated.
- Each owner is limited to one room; the process admits at most three including pending creations. Provider sessions and server timers are bounded to ten minutes. Failed termination retains the owner lock instead of admitting repeated paid rooms.
- Navigation ends the current provider session. Existing report/message state can remain in visit memory, but live history is not durable or transparently resumed in a new room.
- Reconnect is an explicit new authorized connection after failure/cleanup, not a claim of seamless persistent Matt.
- Page-exit keepalive and remote termination are best effort. Process death/network failures can prevent confirmation; provider-side duration limits are a backstop, not proof of perfect cleanup.

## 10. OCI, Globe, evidence and aviation scope

Status: IMPLEMENTED for the existing authorized-reader connection; PARTIALLY IMPLEMENTED for broader intelligence continuity.

No new disconnected general chatbot was added. Existing contract selection, document/version resolution, analysis-run readers, source cards, review findings, proposals and full report remain the surfaces for answers.

Only existing authorized analysis is used; Matt does not start extraction automatically. Context input is limited to 60,000 serialized characters and fails explicitly instead of silently truncating a lease set.

The prompt restricts generation to supplied evidence and treats documents/questions/history as untrusted data. Established answers require known evidence IDs; unsupported answers must return no citations. Identifier validation does not prove semantic entailment, legal correctness, resistance to every prompt injection or measured accuracy.

Existing illustrative Globe/flight follow-ups are preserved and labelled as scenarios. No real-time flight feed, new exposure computation, general aviation knowledge engine, amendment reconciliation, translation, OCR completeness or independent OCI deployment integration was invented. The live model is limited to the authorized selected analysis; it is not operationally aware of all flights or systems.

## 11. Security, privacy and spending boundaries

Status: PARTIALLY IMPLEMENTED. This is a description of implemented boundaries, not a penetration test or certification.

- All new routes apply authentication, membership and contract-read authorization. User/organization scope comes from middleware, not request-body identity.
- Sessions are both user- and organization-bound, with opaque IDs. Foreign sessions/runs are rejected before model use.
- Master Tavus/model keys stay server-side. The authorized browser necessarily receives a private-room join token; it is not a master API key.
- Provider API origin is fixed. Returned media URLs are restricted to HTTPS on `tavus.daily.co`, without credentials, query or fragment. This validation is not verification of deployed TLS or production tenant isolation.
- Responses use no-store; logs use error codes rather than source text or keys.
- Selected evidence, question and history go to the configured model. Accepted answer text goes to Tavus. Browser STT can add another processor.
- Fixed voice, Matt likeness/identity rights, processing authority, applicable agreements, subprocessors, retention/deletion, transfers, residency and sensitive-data minimization require actual review.
- An NDA or checkbox is not sufficient authority to process client-owned lease contracts.
- Model intelligence budgeting/confirmation is reused. It does not cap avatar minutes or account charges.
- In-memory room limits are per process, not distributed quotas or hard monetary spending caps. Hard provider/account ceilings, multireplica coordination, abuse/rate controls, monitoring, recovery and a tested operator termination procedure remain production blockers.
- No claim is made for security certification, production-grade isolation, verified TLS, confidential-data suitability or complete vendor deletion.

## 12. Tests, build and verification methods

Status: VERIFIED for the checks below, not for genuine live performance.

Backend/protocol/gateway/authorization command, from repository root:

```powershell
node --test test\matt-live.test.js test\matt-live-routes.test.js test\ai-foundation.test.js test\ai-durable-state.test.js test\analysisRunIntelligenceReadRoutes.test.js test\contract-assistant-service.test.js test\foundation-auth.test.js frontend\tests\matt-live-client.test.mjs
```

Result: **67 tests, 67 passing, 0 failing**. Includes actual loopback Express middleware, user/tenant boundaries, injected provider HTTP contracts, cancellation forwarding, budget prerequisites, explicit cost confirmation, source-ID rejection, owner locks, private URL rejection and protocol handling. No external provider/model request was made.

Serial Chromium command, from frontend:

```powershell
node --test --test-concurrency=1 tests\matt-live-browser.test.mjs tests\matt-introduction.test.mjs tests\matt-media.test.mjs tests\matt-studio.test.mjs tests\matt-browser.test.mjs tests\matt-unified.test.mjs
```

Result before the final layout regression additions: **55 tests, 55 passing, 0 failing**. Covers actual introductory MP4 playback/completion, navigation retention, media boundaries, authorization UI, evidence/report behavior and responsive studio layouts.

The additional consent-panel tests initially found clipping at 320px/390px. After correcting overflow alignment, the final targeted rerun of `matt-live-browser.test.mjs` and `matt-studio.test.mjs` passed **28/28**, including all three new viewport tests and the prior live/studio cases. Across the related browser suites there are now **58 distinct tests**; this is not a claim that one final 58-test command was run.

Browser live tests build an explicitly test-only Daily alias with synthetic tracks/events and mocked generated answers. They exercise the real UI lifecycle, exact-text handoff, voice submission, follow-up, interruption, consent withdrawal and teardown. They are NOT evidence of a real model answer, real Matt footage, provider lip synchronization or emotional responsiveness.

Final normal `npm.cmd run build` succeeded after the layout fix, without that alias. The bundle contains the real Daily SDK. Synthetic-provider markers were absent from the normal bundle. Vite retained large-chunk warnings; successful compilation does not resolve performance acceptance.

Changed server/client JavaScript syntax checks and `git diff --check` succeeded. The existing test runners' helper servers/browser contexts were closed.

## 13. Mandatory genuine end-to-end acceptance

Status: BLOCKED.

The mandatory real sequence has NOT been executed:

1. Introduction plays once and genuinely ends.
2. Approved Matt identity and fixed voice join the private provider room.
3. A spoken question is recognized with approved processing.
4. Operion generates a real answer from authorized synthetic analysis evidence.
5. The same answer is heard through Matt's actual moving, lip-synchronized provider video.
6. A follow-up uses the prior turn; interruption stops real speech/video; reconnect and teardown are verified.
7. Main, floating/workspace, desktop and mobile paths are checked without intro replay or silent state loss.
8. Measured latency, lip-sync, voice consistency, emotional behavior, source correctness and billing/cleanup are recorded against agreed acceptance criteria.

No synthetic track, prepared response, video-only stream, mocked provider event or successful build substitutes for these steps. No measured latency, accuracy, ROI or synchronization result is claimed.

## 14. Outstanding external and operational dependencies

Status: BLOCKED.

Required before genuine live acceptance:

- Explicit authorization for provider/model requests and their maximum cost.
- Approved account/plan and verified hard spending controls.
- Rights-cleared Matt identity and fixed voice; any new enrollment/upload separately authorized.
- Verified Echo PAL configuration with no competing LLM/greeting and correct private-room behavior.
- Security/privacy/legal review of actual contracts and processors; approved test-data boundaries.
- Existing model credentials and organization intelligence budget; recording/retention settings confirmed.
- Browser/media compatibility and actual latency, lip-sync, expression and interruption evaluation.
- Production session/rate-limit, cleanup, monitoring, support and incident procedures.
- A decision on live-history persistence/continuity; the current in-memory session is not durable Matt.

The confidential paid pilot remains NOT READY. The desktop individual-file acceptance safety gate remains unresolved. No Kilo worktree Apply/Revert mechanism was used as an acceptance substitute.

## 15. Exact conditional activation procedure

Status: NOT IMPLEMENTED as an operational activation; the following is a gated procedure, not authorization.

1. Review the isolated files individually using an approved safe process. Do not deploy merely because this report exists.
2. Obtain the approvals in section 14, including a finite monetary ceiling and provider/model processing permission. Establish operator termination and cost monitoring.
3. In an approved test environment, configure server-only `TAVUS_API_KEY`, `TAVUS_MATT_ECHO_PAL_ID`, `TAVUS_MATT_FACE_ID` and `TAVUS_MATT_VOICE_ID`. Confirm the actual account's current PAL/face APIs and Echo behavior.
4. Configure the existing supported model through `AI_PROVIDER` (`mistral` or `openrouter`) and its existing server credential. Allocate organization intelligence budget through the existing approved process.
5. Only after approvals exist, configure `MATT_LIVE_APPROVAL_ID`, explicit `MATT_LIVE_ORGANIZATIONS`, and `MATT_ECHO_PAL_APPROVED`, `MATT_FIXED_VOICE_APPROVED`, `MATT_DATA_PROCESSING_APPROVED`, `MATT_BUDGET_APPROVED` as `true`. These flags do not create legal approval or enforce a cash ceiling.
6. Leave `MATT_LIVE_ENABLED` disabled until account, controls and approved synthetic analysis are ready; then enable it only for the allowlisted test organization.
7. Authenticate as an authorized organization member with contract-read permission. Complete/skip the intro, acknowledge the actual processing, and explicitly connect. Public demo intentionally cannot activate a paid room.
8. Run the real sequence in section 13 with synthetic, non-confidential evidence. Approve any displayed estimated generation consumption explicitly. Record actual costs, media output, evidence checks, failures and cleanup.
9. Keep production/confidential activation blocked if any mandatory criterion fails. Deployment or identity/provider changes require separate authorization.

No configuration values, environment files, subscriptions or production settings were changed during this task.

## 16. Git, preservation and deployment state

Status: VERIFIED.

- Development work is uncommitted and unstaged in the isolated detached worktree. Its base remains `9bc748fd73a48e027a0d74007e4165fa7dfe9812`.
- Original preview worktree: all **41/41** recorded SHA-256 file fingerprints match the pre-existing preservation record; its saved Git status is unchanged.
- Publication worktree remains clean at `9bc748fd73a48e027a0d74007e4165fa7dfe9812`.
- Read-only remote inspection confirmed `refs/heads/main` at that same published revision.
- No commit, push, merge, production deployment, provider/model request, identity upload or paid activation occurred. No Keep/Undo/Redo/checkpoint/Apply/Revert acceptance action was performed.
- Existing recovery copies and preserved worktrees were not modified. The new frontend has its own installed dependencies; the original frontend dependency target was not replaced.

**Final verdict: LIVE MATT NOT READY.**

The implementation replaces the looping-video approach with a tested once-only introduction and a real, gated integration path. It does not yet demonstrate operational live Matt. Calling it ready, emotionally responsive, or complete would exceed the available evidence.
