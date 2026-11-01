# Matt real-video readiness and Globe repair

Historical local-repair record. The later authorized unified Matt/global Globe
release supersedes its local-only/no-publication status and static globe lighting.
See [the release report](unified-matt-global-globe-release-2026-11-01.md) for current
scope, tests and publication. The real-video provider block remains unchanged.

## Scope and verdict

Work in the existing isolated `OperionOS-matt-stitch-preview-2026-11-01`
worktree. Existing Matt/Stitch/Proposal changes are preserved. No commit, push,
deployment, provider asset upload, paid request or production-data change.

**Matt's real synchronized video pipeline remains BLOCKED and incomplete.**
The Globe imagery repair is a separate actual code change, not a provider mock.
Validation evidence is recorded below after execution.

## 1. Current technical audit

Current code was inspected, not assumed from previous reports:

- `Matt.jsx`: existing authenticated organization/contract permission gates,
  authorized catalog, document/version/analysis selection, scoped intelligence
  search/assistant requests and AbortSignal cancellation.
- `mattDemoAdapter.js`: one prepared illustrative lease, using the existing
  deterministic `answerContractQuestion` service. It is not an open-ended LLM.
- `mattState.js`: request-ID stale-event rejection, nine existing interaction
  states, up to 20 in-memory messages and ordinal finding follow-ups. Messages
  are not passed as an unrestricted LLM conversation.
- `mattVoice.js`: native browser recognition, explicit privacy consent,
  reviewed transcript, cancellation and explicit recognition failures.
  Published-candidate native synthesis is still not an audio-producing TTS API.
  Studio output does not use that synthesis or the generic reference video.
- `MattEnvironment.jsx`: approved reference portrait; studio has no fake
  response-specific video. Normal candidate behavior is preserved.
- `MattProposal.jsx`: evidence, typed risk findings, clearly labeled human-review
  suggestions and existing evidence navigation. No generated mitigation/notice
  backend or action execution is claimed.
- `aiGateway.js`: scoped text intelligence jobs with budget/reservation/cache and
  Mistral/OpenRouter providers. This is not a speech/video streaming service or
  authorization to spend provider dollars.

| Requirement | Status |
|---|---|
| Existing scoped intelligence retrieval and evidence | VERIFIED by offline mocked-transport browser tests and actual pure-service tests |
| Selected-finding follow-ups and stale-response protection | VERIFIED in existing tests |
| Native recognition consent/cancellation/error handling | VERIFIED with injected browser events; real microphone service not verified |
| Matt/Demo styling, Proposal and 2px mobile gutters | VERIFIED locally in prior increment, retained |
| Unexpected general questions / clarification / unrestricted natural conversation | NOT IMPLEMENTED by current deterministic assistant |
| Fixed voice producing PCM audio | BLOCKED |
| Custom Matt provider identity | BLOCKED |
| Actual synchronized stream, lip/face/body motion | BLOCKED |
| Provider reconnect, buffering and video interruption | NOT IMPLEMENTED; no real provider events exist |
| Text-hidden video/voice continuity | BLOCKED |

No new fake speaking/preparing/reconnecting state is added just to satisfy a
checklist. Existing studio states reflect actual intelligence/recognition events.
Published native `SPEAKING` means reading aloud, not synchronized video.

## 2. Provider verification and decision

Direct official documentation was rechecked during this task.

### Primary: LiveAvatar LITE (conditional)

- Backend token creation/start; browser receives session-scoped WebRTC credentials,
  not the master API key.
- Keeps Operion's STT/intelligence/TTS orchestration separate from the renderer.
- Accepts base64 PCM16, 24 kHz, mono; approximately one-second chunks, maximum
  1 MB WebSocket frame. Must wait for `session.state_updated: connected`.
- First audio chunk's event ID identifies an utterance; response `source_event_id`
  correlates speaking/ended/interrupted events.
- `agent.interrupt` clears buffered audio/pending video; buffer-cleared event
  acknowledges the interrupt.
- Default LiveKit/WebRTC, H264; actual desktop/mobile browser/NAT/network
  acceptance remains untested.
- Video custom identity needs two-minute footage and consent recording. The
  provided approximately 32.58-second reference is insufficient. Image-derived
  identity exists but is not automatically accepted as the required human
  performer; actual identity/motion quality needs explicit approved trials.
- No guarantee of semantically appropriate full-body gestures from these APIs.
- Sandbox is documented as credit-free but allows only the Wayne stock identity
  and approximately one-minute sessions. It does not establish Matt acceptance,
  still requires an API key, and was not used.

This remains the primary choice because audio/utterance correlation and explicit
buffer interruption are documented while preserving Operion authority. It is
not a claim that a configured account or accepted Matt avatar exists.

### Fallback: Tavus Echo

Text Echo bypasses perception/STT/LLM and sends text to Tavus TTS.
Audio Echo bypasses all except realtime replica rendering. Text/audio Echo
disables the microphone in that transport, so Operion must provide its own input
recognition. Microphone Echo streams supplied audio and requires interrupt logic
inside the audio stream. Uses Daily/WebRTC. Custom identity and fixed voice,
utterance interruption, actual mobile quality and account terms need verification.

Tavus now documents PAL-based creation in its Echo guide; an old persona example
must not be copied blindly. Full pipeline is recommended by Tavus for their
optimized turn-taking, but it would introduce extra orchestration/perception;
do not replace Operion's scoped intelligence just to use that shortcut.

### Sync: batch-only alternative, not live fallback

Official estimated 30-second output times: lipsync-2 1-3 minutes, pro 2-5 minutes,
sync-3 10-15 minutes. Completed/failed/rejected job statuses do not supply
realtime conversational interruption or instant response continuity.
Useful for asynchronous response-quality experiments after approval, not the
required natural interactive engine. Source gestures are not new semantic actions.

### Additional evaluated alternative: Simli Trinity-2

Current docs describe waist-up custom photo-generated identity including torso/
hands, portrait/landscape output, live camera/background changes, WebRTC/LiveKit,
PCM16 16 kHz input, first-frame-resolved `start()`, speaking/silent events and
`ClearBuffer()` for interruption. Avatar generation is documented as typically
four hours. **On-command animations are explicitly coming soon**, not implemented.
Client DEBUG logs audio chunks; would require restricted production logging.

This is technically interesting but not established as superior for Matt:
no approved identity/voice, measured human quality, account pricing, region/DPA or
full conversational acceptance. It does not displace the primary/fallback based
on marketing or a prerecorded demo.

### Direct official references

- [LiveAvatar lifecycle](https://docs.liveavatar.com/docs/lite-mode/lifecycle.md)
- [LiveAvatar events](https://docs.liveavatar.com/docs/lite-mode/events.md)
- [LiveAvatar configuration](https://docs.liveavatar.com/docs/lite-mode/configuration.md)
- [Identity requirements](https://docs.liveavatar.com/docs/core-concepts/avatars.md)
- [Sandbox limitations](https://docs.liveavatar.com/docs/sandbox-mode.md)
- [Billing](https://docs.liveavatar.com/docs/faq/credits.md)
- [WebRTC requirements](https://docs.liveavatar.com/docs/faq/firewall.md)
- [Tavus Echo](https://docs.tavus.io/sections/conversational-video-interface/echo-mode.md)
- [Tavus developer pricing](https://www.tavus.io/pricing)
- [Sync latency](https://sync.so/docs/product/generation-times.md)
- [Sync billing](https://sync.so/docs/product/billing.md)
- [Simli SDK contract](https://docs.simli.com/api-reference/javascript/reference.md)
- [Simli Trinity-2](https://docs.simli.com/api-reference/trinity-2.md)
- [Simli animations limitation](https://docs.simli.com/api-reference/trinity-2/animations.md)

## 3. Access, identity, audio and privacy gates

Local environment-file names/process variable names were checked without exposing
values. No recognized LiveAvatar/HeyGen/Tavus/Sync/ElevenLabs/Simli/Replicate
credential entry was found. This does not establish that the owner has no account
elsewhere. No authenticated provider account call, remote secret export or identity
upload was attempted.

No approved provider account/quota, trained custom identity, fixed voice/audio
configuration, DPA/region/retention/rights consent or trial budget was supplied.
Changing a plan, accepting agreements or sending identity/customer/audio assets
is not authorized. These gates cannot be bypassed with stock avatars, fake PCM,
independent browser TTS, a public provider credential field or simulated sessions.

## 4. Authorized implementation

### Globe root cause and repair

Both Globe components previously created viewers without a base imagery layer.
The only imagery depended on external map tiles; their untextured globe and space
background were pale blue. Thus a failed external imagery load could leave aircraft
over a bright nongeographic surface. Default Standard used a light street map
even in Globe mode. There was no same-origin geographic base.

Live browser inspection found that the satellite selection was currently rendering
geographic imagery. This does not disprove the reported intermittent/default
failure; no claim is made that every live failure was reproduced.

The repair adds `globeImagery.js`, shared by Demo/public and customer viewers:

- Real **Natural Earth** geodetic imagery already bundled in installed Cesium.
  No new imagery download/dependency/credential or stock globe image is added.
- Same-origin `/cesium/Assets/Textures/NaturalEarthII/` tiles, levels 0-2, correct
  south-origin TMS row (`reverseY`) and geographic tiling.
- Standard **Globe** uses that geographic Earth base directly; Standard **Map**
  retains detailed street tiles. Satellite/topographic retain their selected
  external detail layer above the Earth base.
- Dark space backdrop keeps Earth's silhouette distinct from the light Demo UI.
- Map styles never remove the geographic base without replacing it; listeners
  and layers are scoped and removed safely on mode/style/unmount changes.
  Base/detail layers are inserted below existing weather overlays so changing
  style does not obscure independently enabled weather imagery.
- Remote detail failures explicitly report degraded detail, not "Access Blocked";
  default Globe does not call that external provider. No failure is disguised as
  an available detailed satellite/road map.
- Actual customer data/auth/aircraft selection, camera controls, weather and
  scoped contract intelligence are untouched.

Files:
- Created `frontend/src/components/aviation/globeImagery.js`.
- Updated `frontend/src/components/demoRedesign/CesiumFlightGlobe.jsx`.
- Updated `frontend/src/components/aviation/ProductionFlightGlobe.jsx`.
- Added compact imagery error presentation in `frontend/src/styles/globe-intelligence.css`.
- Added `frontend/tests/globe-imagery.test.mjs` and
  `frontend/tests/globe-earth-imagery.test.mjs`.
- Updated `frontend/tests/globe-intelligence.test.mjs` with a blocked-satellite
  acceptance check and bounded GPU repaint comparison; extracted the existing
  PNG decoding logic into `frontend/tests/helpers/pngPixels.mjs`.
- This report.

### Matt work

Accepted isolated design/Proposal/gutters preserved. Current source and official
provider contracts reverified. No provider stub or fake implementation added.
There is no safe approved account/identity/audio/data-processing configuration
against which a working session can be built and demonstrated.

## 5. Exact next implementation sequence after approval

1. Verify approved provider account, custom Matt identity (not stock), avatar slot,
   allowed regions/DPA/retention and explicit fixed voice consent.
2. Set server-only API access through owner-controlled secret management.
   Select an approved TTS returning PCM16/24kHz/mono; verify trial spend cap and
   idle/concurrent session metering. Do not treat intelligence credits as dollars.
3. Add scoped authenticated backend session start/stop and utterance control,
   enforce organization/permission/consent/time/concurrency/spend limits before
   paid operations, and end sessions on revoke/logout/navigation.
4. Preserve current authorized analysis endpoints; add approved conversation
   orchestration for general questions/clarification with scoped evidence and
   labeled interpretations, rather than canned unexpected-question answers.
5. Produce actual response audio, forward it to the renderer without independent
   local TTS, and mount synchronized remote media in the accepted scene.
6. Drive preparing/speaking/interrupted/reconnecting from backend/provider events,
   correlate utterance IDs, reject stale events and verify decoded/audible output.
7. Abort input/request/audio stream and send `agent.interrupt`; wait for actual
   buffer-clear acknowledgment. End/reconnect with explicit errors and no automatic
   charged-session creation loop.
8. Verify unpredictable questions, finding follow-up, interruption, scope change,
   text-hidden continuation, desktop/mobile/WebRTC network failures, identity and
   natural human motion; measure first audio/video and total end-to-end latency.

Planning estimate, not a completion commitment: approximately 5-10 engineering
days after all approvals/access/identity/audio prerequisites, plus provider
identity turnaround and iterative human-quality/mobile/privacy acceptance.

## 6. Running-cost assumptions

Current LiveAvatar official credit table: LITE **1 credit/session-minute**;
Essential **$99/month, 1,100+10 credits, $0.095/credit overage**; Business
**$475/month, 6,000+10 credits, $0.09/credit overage**.
Full-use included LITE capacity implies approximately $0.089/min Essential or
$0.079/min Business before TTS/STT/LLM/avatar-slot/storage/network/operations.
Actual idle/session/concurrency and owner plan must be verified; unused included
minutes increase effective cost. No overage enablement is authorized.

Tavus developer Starter **$59/month, 100 conversational minutes, 3 custom
trainings, 3 concurrent streams**; Growth **$397/month, 1,250 minutes, 7 trainings,
10 streams**. These are plan inclusions, not verified Echo/account invoices;
pay-as-you-go Starter has no advertised overage cap, so an Operion cap is essential.

Sync legacy lipsync-2 plus TTS approximately **$2.59-$3.24 per 60 seconds of
output**, plus subscription/other costs; alternative credit billing differs.
No Simli account quote is claimed. No provider spend incurred in this task.

## 7. Real-video demonstrations

All seven requested synchronized-video tests are **BLOCKED**, not passed:
unexpected Operion question, aviation question, follow-up, speaking interruption,
contract intelligence delivery, text disabled and mobile interaction.
Existing evidence/text/mock-recognition tests cannot substitute for them.

No generated video, A/V synchronization, natural mouth/face/body movement,
fixed voice, mobile real-media playback or measured live-video latency demonstrated.

## 8. Validation and publication evidence

### Executed checks

| Check | Actual result |
|---|---|
| Existing Matt browser/reducer/voice checks | 24 passed |
| Studio/Proposal/visibility/consent checks | 19 passed |
| OCI/customer/recovery/authentication regressions | 36 passed |
| Backend contract assistant pure-service tests | 4 passed |
| Imagery selection/lifecycle/weather ordering unit checks | 3 passed |
| Aircraft picking and touch controls | 4 passed |
| Real Earth pixel-render checks | 2 passed, covering four routes at each width |
| Globe fleet/alerts/contracts/responsive browser checks | 15 passed across the full run and focused rerun |

**107 distinct targeted tests passed across these executions, not one full
repository-suite run.** The original 24-check Globe run passed 23 and failed the
byte-identical frame comparison; the corrected comparison and satellite check
subsequently passed. The final focused Globe run passed all 7 selected checks,
including a rebuilt frontend, both pixel-render checks and weather ordering.
No full backend-suite or live provider acceptance result is claimed.

Frontend production-style, studio-preview and OCI builds completed through the
browser-suite build hooks. No package manifest or lockfile changed.

### Actual rendering and responsive evidence

- Earth imagery was tested at **390px and 1440px** on `/`, `/product`,
  `/demo/dashboard` and `/demo/live-tracking`, blocking every non-loopback
  request. Bundled geographic tile responses were HTTP 200.
- Tests sampled the rendered screenshot, requiring more than 100 distinct
  central RGB colors and over 40% nonwhite colored samples. This checks actual
  textured rendering, not merely a mounted canvas.
- Both mobile and desktop screenshots were visually inspected: recognizable
  continents, blue oceans, the Earth's curved silhouette and aircraft against
  dark space. Evidence files: `globe-earth-390.png` and `globe-earth-1440.png`
  in the session evidence folder, outside the repository.
- Blocked satellite detail explicitly reported degradation while retaining
  geographic Earth. Returning to Standard removed the degraded-detail status.
- Globe panel/control/contract tests covered **320, 360, 375, 390, 430, 768,
  1024, 1280, 1440 and 1920px**, without horizontal overflow.
- Matt Studio/Proposal tests covered **320, 360, 390, 430, 768, 1024, 1440
  and 1920px**. Demo's exact **2px mobile card/widget gutters** remain verified.
  Evidence navigation, finding follow-ups, optional text, consent and cancellation
  passed. These are not real synchronized-video acceptance tests.
- Customer Globe scoped association and authentication tests passed. Direct
  geographic pixel assertions were on public/Demo surfaces; customer imagery
  uses the same tested helper, but a separate authenticated pixel demonstration
  is not claimed.

### Test corrections and limits

The initial forced-software WebGL framebuffer test timed out on desktop.
Screenshot-based pixel analysis, reusing the existing PNG decoder, removed the
expensive GPU-readback approach. Both widths then passed, including the final run.

The existing contract-inspection test assumed byte-identical GPU output.
Diagnostics measured 231-232 changing pixels out of 720,360, with unchanged canvas
dimensions and only localized repaint differences. The test now waits for
network idle, still requires the same canvas/dimensions, and limits changes to
0.1% of pixels and mean RGB-channel delta to 0.01 on the 0-255 scale.
This remains a strict visual framing check; camera/app behavior was not changed
to make the test pass. Diagnostic logging was removed.

The existing [Stitch integration report](matt-stitch-design-integration-2026-11-01.md)
records the exact authorized extraction boundaries, Demo components and accepted
Matt changes. No unrelated Stitch navigation or simulated controller was imported.

### Publication and safety

`git diff --check` passed. The original published Matt worktree remains clean,
and the isolated preview retains uncommitted changes. GitHub main was independently
checked again after implementation:
`cdadd1f8d3eb55502738db0c5b012a5e93e89213`.

No commit, push, deployment, hosting/DNS/Supabase change, database write, provider
asset upload or provider spend occurred. Test-owned preview servers and browsers
closed. **The Globe is repaired locally; production has not received this fix.**

## 9. Final requirement status and next authorized work

| Requirement | Status |
|---|---|
| Current Matt architecture and provider contract audit | VERIFIED |
| Primary LiveAvatar LITE / fallback Tavus Echo decision | VERIFIED as a conditional recommendation, NOT IMPLEMENTED as a session |
| Approved provider access/account/quota | BLOCKED |
| Custom Matt identity and fixed audio-producing voice | BLOCKED |
| Existing Visual/Proposal integration and responsive Demo alignment | VERIFIED locally |
| Globe geographic repair and external-imagery failure behavior | VERIFIED locally |
| Seven requested real-video demonstrations | BLOCKED |
| Real lip/face/body motion and audio/video synchronization | BLOCKED |
| Existing scoped follow-ups and mocked/native cancellation checks | VERIFIED in tests |
| Actual provider-video continuity/interruption/reconnection | NOT IMPLEMENTED |
| Text-hidden synchronized video/voice continuity | BLOCKED |
| Desktop/mobile layout and targeted builds/tests | VERIFIED locally |
| Deployment of these local changes | NOT IMPLEMENTED; publication prohibited |
| GitHub/production preservation | VERIFIED |

Next: obtain explicit owner approval and access for the custom Matt identity,
fixed voice, data-processing terms and capped trial budget before implementing
and measuring the real response pipeline. Separately authorize publication if
the local Globe repair should reach production. Do not treat this report or
passing layout tests as acceptance of a working human video assistant.
