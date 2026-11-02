# Matt live integration design

Date: 2 November 2026. Local implementation, disabled pending explicit approval.
Read the [architecture assessment](MATT_REALTIME_ARCHITECTURE_ASSESSMENT.md) and
[provider comparison](MATT_PROVIDER_COMPARISON.md) for decision/evidence.

## Minimal adapter boundaries

| Boundary | Actual implementation | Contract |
|---|---|---|
| Physical audio capture | Existing [mattMicrophone.js](../frontend/src/components/matt/mattMicrophone.js) | `acquire/pause/disable/dispose`, one captured track; selectable capability predicate |
| Speech input | Existing browser adapter or new [mattRealtimeSpeech.js](../frontend/src/components/matt/mattRealtimeSpeech.js) | `listen(track)/stop/dispose`, event/final transcript callbacks, speech-start interruption |
| Server speech provider | [openaiMattSpeechProvider.js](../providers/openaiMattSpeechProvider.js) | Injected `create(sdp)` -> server handle/SDP, `end(handle)` |
| Session manager | Existing [mattLiveService.js](../services/mattLiveService.js) | Parent ownership/lifetime, approved speech attachment, cancellation, cleanup and bounded history |
| Intelligence | Existing [mattAnswerService.js](../services/mattAnswerService.js) and AI gateway | Authorized OCI context, model budget/confirmation, existing output/evidence validation |
| Voice/video output | Existing Tavus provider and [tavusEchoClient.js](../frontend/src/components/matt/tavusEchoClient.js) | Exact answer text, one remote A/V participant, interrupt/cleanup |
| UI coordinator | [useMattLive.js](../frontend/src/components/matt/useMattLive.js) and [Matt.jsx](../frontend/src/routes/Matt.jsx) | Configured adapter selection and ordinary question/result flow |

No separate engines were invented for clauses, exposure or evidence. Voice and
video remain a combined output adapter because separating them would risk
desynchronization without adding value. A different speech adapter implements
the same captured-track/event contract and server create/end interface; a new
avatar adapter implements the existing output boundary. Other providers still
need concrete adapters/tests; this is not universal drop-in compatibility.

## Configuration and fail-closed behavior

Existing live gates, identity/voice approvals, organization allowlist and model
budget still apply. New [mattSpeechConfiguration.js](../services/mattSpeechConfiguration.js)
selects `browser` by default, preserving prior behavior. Explicit
`MATT_SPEECH_PROVIDER=openai-realtime` additionally requires:

```text
MATT_REALTIME_ENABLED=true
MATT_REALTIME_APPROVAL_ID=<operator approval record>
MATT_AUDIO_PROCESSING_APPROVED=true
MATT_REALTIME_BUDGET_APPROVED=true
OPENAI_API_KEY=<server only>
```

Missing gates block the selected path. Unsupported providers are rejected.
No failed RTC connection falls back silently to browser speech or a prerecorded
avatar. The public Demo now uses the same session engine with a server-only
prepared-data context and separately approved bounded access. Without those
approvals it creates no speech or avatar sessions. See the
[Demo parity report](DEMO_MATT_FULL_FEATURE_PARITY_ACCEPTANCE_REPORT.md).

The [offline validator](../scripts/validate-matt-local.js) includes selected
speech field names without printing key/approval values. Its overall result
remains BLOCKED regardless of syntax. No file auto-load/network is added.

## Server protocol

Existing authentication, organization membership and `contract:read` middleware
protect every route, including the new routes in
[mattLiveRoutes.js](../routes/mattLiveRoutes.js).

```text
GET    /api/matt/status
POST   /api/matt/sessions
POST   /api/matt/sessions/:id/speech   { consent: true, sdp: audio-only offer }
DELETE /api/matt/sessions/:id/speech
POST   /api/matt/sessions/:id/turns    { analysisRunId, question, confirmation }
POST   /api/matt/sessions/:id/interrupt
DELETE /api/matt/sessions/:id
```

Speech creation requires an existing owner-bound Matt session, live organization
approval, separate speech configuration and explicit consent. Audio-only SDP is
bounded to 60,000 characters; video offers and malformed input are refused.
One speech connection or pending creation is allowed per parent. It shares the
parent's maximum ten-minute lifetime rather than starting another ten minutes.

The backend sends multipart `sdp` + a server-controlled `session` to the fixed
OpenAI `/v1/realtime/calls` origin. Standard credentials never leave the server.
It retains the call ID from Location; browser gets SDP answer/expiry and an
opaque local connection identifier, not the provider call handle. Targeted
cleanup includes that identifier so an older connection cannot end a newer
replacement. Owner checks apply even to idempotent stale cleanup.
Create/hangup requests have 20-second deadlines and redirects are refused.
No raw provider error, SDP, transcript, token or key is written to application logs.
SDP can expose network information and must not be captured in ordinary telemetry.

Configuration: `type=realtime`, `model=gpt-realtime`,
`output_modalities=["text"]`, no tools; input transcription uses
`gpt-4o-mini-transcribe`; server VAD threshold 0.5, prefix 300ms, silence 600ms;
both automatic response flags false. These are implementation settings, not
validated natural-conversation thresholds. No `response.create` is sent.

This intentionally uses a documented conversation-session transport with
inference suppressed; it does not claim that a transcription-session object is
supported by the unified SDP endpoint's documented `realtime` request schema.

## Input and conversation lifecycle

1. After a successful approved Matt connection, the UI selects the advertised
   speech adapter and resets speech consent. No external audio starts on load.
2. Explicit speech consent and microphone click start native capture directly.
   The same existing track is passed to the RTC sender; no second device opens.
3. Before negotiation/connection the track is disabled. Browser creates one
   send-only audio transceiver and event data channel; no output track is used.
4. LISTENING requires connected peer + open channel + live/enabled captured track
   + increasing outbound audio RTP bytes. Permission alone is insufficient.
   RTP establishes sending, not transcription accuracy or remote understanding.
5. Provider VAD speech-start immediately pauses/mutes the current avatar response,
   aborts existing request/generation and requests Tavus interruption while input
   stays active. Backend interruption waits for generation cancellation, bounded
   to five seconds; failure explicitly prevents continued normal conversation.
6. Only a matching, not-previously-completed final item transcript of 3-500
   characters reaches the ordinary Matt submission path. Deltas are not questions.
   Stale/reordered older finals are suppressed. A final waits for interruption
   acknowledgement; another speech start invalidates the older pending final.
7. Final transcripts use the existing selected contract/analysis lookup and
   authenticated `turns` route. Operion alone generates/validates the answer.
8. Existing Tavus Text Echo receives that exact answer, not the microphone.
   Existing playback checks require subscribed playable audio/video from the
   same participant. Only actual successful playback can claim SPEAKING.
9. Input remains active during output for the next unexpected question/barge-in.
   Typed questions and explicit Stop interrupt input; it is resumed by a new
   microphone click. Error/cost-confirmation flows remain explicit, not autonomous
   spending approval. Scope/analysis changes cannot inherit another tenant's room.
10. Input disconnect disables capture transmission, invalidates the active item
    and allows bounded same-peer recovery. New outbound packets are required
    after recovery; failure closes speech instead of repeatedly creating paid
    sessions. No automatic re-creation/ICE-restart spend loop is implemented.

The UI reports input state separately from microphone permission and output
audibility. Physical microphone revocation ends capture and speech; stop,
consent withdrawal, pagehide and unmount close peers/tracks.

## Output, identity and cancellation

The existing one-time introduction component/store is not changed here.
Output A/V remains one Daily stream on one video element, with preserved mute,
autoplay retry, interruption latch and replacement/reconnect behavior from the
previous local work. No unrelated TTS is mixed with generated video.

Face and fixed voice IDs are operator-approved, not selected from a generic
fallback. No likeness/audio source is read or uploaded by the new adapter.
Stock assets could later exercise provider transport only after external-call
approval; stock success would not establish Matt identity/voice acceptance.

Realtime input speech-start does not give the speech provider permission to
answer. Unexpected `response.created`, incoming remote media, malformed events
or transcription failure close input and surface an explicit error.

## Cleanup and failure handling

- Parent termination attempts both speech hangup and avatar termination even
  if one fails. Owner lock stays until cleanup succeeds.
- Browser disconnect does not abandon a pending server create response:
  late-created calls are terminated. Concurrent speech-close requests share
  cleanup; a pending/active/closing call blocks another one.
- Creation network uncertainty or a missing call handle locks reconnection
  for operator account review; it is not retried as success.
- Session expiry, explicit speech stop and parent termination close the call.
  Hangup failure is reported, not silently ignored.
- Limits/locks are process-local. Worker restart, lost handle/network timeout,
  distributed replicas and account-wide caps need operational controls. A
  ten-minute local timer is not an absolute provider spending guarantee.

## Privacy, performance and remaining implementation limits

Only audio reaches OpenAI STT; authorized transcript/context reaches the existing
model gateway; generated answer text reaches Tavus. Approved contracts need
not be uploaded to avatar storage, but answer text and spoken questions may
still contain confidential information. User consent is not a substitute for
organizational processing authority, DPAs or legal advice.

Current global origins are fixed. EU-only routing, ZDR, certification, verified
production controls and hard spend enforcement are not implemented/established.
Observability is field/code-based with no content logs; production RTP, latency,
usage metering/alerts and reviewer tooling are not claimed delivered here.

Serial endpointing -> final STT -> full Operion answer -> provider TTS/render
adds delay. Measure speech-stop-to-first-audible-word and interruption-to-silence,
including p50/p95 across devices and network conditions before setting SLAs.
Echo has no perception: facial/eye movement, lip-sync and emotional delivery
require genuine observation, not a synthetic test. No new live Globe data,
financial-exposure engine, complete OCR/amendment handling or persistent memory
is introduced. See [activation checklist](MATT_EXTERNAL_ACTIVATION_CHECKLIST.md).
