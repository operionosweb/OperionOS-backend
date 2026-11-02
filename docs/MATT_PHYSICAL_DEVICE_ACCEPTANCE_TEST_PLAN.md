# Matt physical-device acceptance test plan

Date: 2 November 2026. **PLAN ONLY — provider and physical runs NOT EXECUTED.**

## 1. Four evidence classes that must remain separate

| Class | Can prove | Cannot prove |
|---|---|---|
| Automated application/browser | Real component behavior and local HTTP authorization with controlled fixtures | Actual provider capability, human audibility or deployed RLS |
| Simulated media | Captured fake-device track, loopback RTP, state/cleanup protocol | Real STT, generated Matt identity/voice, lip sync |
| Genuine provider-backed | Approved external session using actual model/STT/avatar | Physical device result unless human hardware was actually used |
| Physical-device | Named hardware, microphone/output/browser and human observed A/V | Unexecuted devices, all inputs, production security or legal compliance |

Record each operation's class, not merely a whole-run "pass." Never classify a
synthetic voice/canvas, reference MP4, stock avatar or browser TTS as genuine Matt.

## 2. Preconditions

All unchecked:

- [ ] Resolve or explicitly hold software/security issues in the final reports.
- [ ] Obtain separate approval for providers, likeness/voice, test processing,
  accounts/agreements, exact budget and evidence retention; follow the
  [activation checklist](./MATT_PROVIDER_ACTIVATION_AND_ACCEPTANCE_CHECKLIST.md).
- [ ] Prepare two isolated fictional SaaS tenants with canary contracts,
  distinct amounts/currencies, clauses, suppliers, deadlines and operational
  facts. Have a human-approved truth sheet including source identifiers.
- [ ] Use prepared Demo fixtures only. Do not request confidential contracts.
- [ ] Assign a tester and independent reviewer, one active room at a time,
  provider-console termination access, remaining spend and emergency stop owner.
- [ ] Confirm HTTPS or loopback secure context. For a phone accessing a desktop
  server, the desktop's `localhost` is not the phone's localhost; use a reviewed
  secure local test origin/network. Do not expose a public tunnel or change TLS
  configuration without authorization.
- [ ] Record OS/browser versions, headset/speaker/mic model, permissions and
  selected speech path; do not assume installed browser versions from UA alone.

## 3. Required device/environment matrix

Every row is **NOT EXECUTED / BLOCKED BY APPROVAL**:

| Physical device/browser | Demo | SaaS | Speech-support gate |
|---|---|---|---|
| Desktop Chrome, current supported version | Pending | Pending | Default captured-track recognition requires desktop Chromium ≥135 and recognition API |
| Desktop Edge, current supported version | Pending | Pending | Same feature checks; actual recognition/vendor policy must be verified |
| Android device / Chrome | Pending | Pending | Default browser speech adapter intentionally rejects mobile; separately approved Realtime path required for current software |
| iPhone/iPad / Safari | Pending | Pending | Default browser speech adapter intentionally rejects mobile; separately approved Realtime path required for current software |

The [actual capability predicate](../frontend/src/components/matt/mattMicrophone.js)
does not support mobile captured-track browser recognition. This is a known
software constraint, not a failed physical run or evidence Safari cannot do
WebRTC. The [Realtime predicate](../frontend/src/components/matt/mattRealtimeSpeech.js)
requires secure context, `RTCPeerConnection` and `getUserMedia`; actual iOS/
Android permissions, autoplay and network behavior still need physical testing.
No automatic alternate-processor fallback is permitted.

## 4. Per-run evidence header and proposed thresholds

Before spending, fill in: run ID; environment; device/OS/browser; tester/reviewer;
input/output devices; speech adapter; approved face/voice/PAL; synthetic dataset
version; start/end UTC; allowed spend; timeout/abort owner; evidence retention.
Use redacted application turn IDs for correlation; never retain bearer/room
tokens, raw SDP, private keys or confidential speech.

These are **proposed acceptance thresholds, not measured performance or a
contractual SLA**. Approve them before the run:

- Zero foreign canaries in context, output, report, history or provider payload.
- Zero wrong identity/voice and zero reference-video/TTS substitutions.
- Every critical name, negation, amount, currency, date and clause in the
  audible response must match the validated Echo text and truth sheet.
- Suggested A/V offset: absolute offset ≤150 ms at early/middle/late speech
  landmarks; no increasing drift across the turn.
- Suggested interruption: audible output stops ≤1 second after interruption
  event; measure physical speech onset separately from processor detection.
- Suggested answer onset: ≤5 seconds from final accepted transcript to first
  audible answer; record STT/processing/render components independently.
- Suggested reconnect: recover within the implemented 20-second output grace
  period or fail explicitly and stop the run; never spawn duplicate rooms.
- Suggested teardown: actual provider usage closed within 30 seconds of
  Disconnect; if not, stop and investigate before another room.

If different tolerances are required, record them before execution and retain
the original results. Do not adjust thresholds after observing a failure.

## 5. Repeatable script for every matrix cell

| # | Human operation | Required observation/evidence |
|---|---|---|
| 1 | Load main Matt without consent/connect | No device acquisition or paid session; one-time introduction clearly separate |
| 2 | Skip/watch introduction; consent and deliberately connect | Exactly one authorized private room; actual approved Matt identity and voice |
| 3 | Deny microphone | Visible denial, not listening; no hidden alternate recognition |
| 4 | Change native permission then explicitly retry | Real captured microphone; verify actual speech, not injected transcription |
| 5 | Speak an unexpected synthetic contract question | Human compares transcript to speech and source-grounded answer to truth sheet |
| 6 | Hear and watch the answer | Genuine Matt generated voice and corresponding talking video, no static/replayed substitution |
| 7 | Check same-answer articulation | Exact validated text → Echo payload → audible words; inspect plosive/mouth landmarks and measured A/V offset |
| 8 | Ask a follow-up | Relevant authorized history/source continuity, not unrelated tenant or contract |
| 9 | Speak over Matt, then ask a new question | Real input detection, output interruption, no overlapping old/new answer; measure stop timing |
| 10 | Mute/unmute; test headset then speaker | Actual selected output audible as intended; no duplicate independent TTS/audio |
| 11 | Deny/block autoplay, then use explicit audio enable | Honest blocked status and successful human-initiated recovery |
| 12 | Briefly interrupt Wi-Fi/network, restore | Capture/output states honest; no stale answer or duplicated paid room; explicit failure if grace expires |
| 13 | Move main ↔ contract workspace ↔ floating ↔ report | Shared architecture, expected scope/cleanup; do not assume one paid room persists across navigation |
| 14 | Select/switch/close prepared Globe aircraft, expand and leave | Current prepared aircraft only; simulated/historical/estimated/hypothetical/unknown facts distinguished |
| 15 | Switch to a different authorized fictional organization | Old requests, histories and reports unavailable in new context; fresh deliberate session if needed |
| 16 | Revoke contract-read permission while generation is pending | No pending answer/credentials/SDP returned after failed recheck; verify actual remote teardown |
| 17 | Revoke while an old answer is displayed / while idle | Explicitly test retained text/report and continuing RTC. Request-bound rechecks alone do not prove continuous revocation |
| 18 | Expire/replay credentials and application/provider identifiers | Denied before unauthorized data/model/output; no privileged fallback |
| 19 | Disconnect; close tab; idle-expire separate approved room | Local tracks/peers stop; server and provider-console usage both confirm termination |
| 20 | Reconnect only after cleanup confirmed | Fresh session, no stale private history or old room reuse; reconcile usage/cost |

The idle test should observe the existing three-minute idle deadline; absolute
expiry test uses the ten-minute room limit. Do not extend these to keep a demo
looking active. Account-side usage continues to need verification after browser
crash, credential expiry or loss of network.

## 6. Source/voice/video checks

- Use at least one unexpected utterance per environment, not only prepared
  buttons. Preserve a redacted transcript of actual speech where approved.
- Correlate question, authorized source snapshot, validated answer, exact Echo
  text and generated response by turn. Source-ID validity alone is insufficient.
- Audio and video must be current tracks from the same private-room participant.
  Check likeness/voice against locally approved references without new uploads.
- Have the reviewer transcribe actual audio and compare numbers/negations;
  inspect lip movements at multiple timestamps, not only initial playback.
- Evaluate natural facial/eye motion and appropriate delivery. Do not infer
  emotional understanding, emotion sensing or persistent affective memory.
- Unsupported or unavailable information must remain unavailable; no invented
  delays, routes, legal conclusions or financial totals.

## 7. Failure/stop and recovery

Stop immediately for any unauthorized canary, unapproved processor, identity/
voice mismatch, duplicate/orphaned room, unexpected spend, doubtful data
authority or uncertain cleanup. A cross-context canary entering another
customer's context/output/cache/provider session is critical.

Use the activation checklist's rollback: stop input/output, block new sessions
through approved operator controls, terminate recorded provider calls, verify
zero active usage and reconcile spend. Do not auto-retry, reset source/Git,
delete recovery originals, replace Matt with stock media or weaken assertions.

## 8. Blank results register

| Run/device/environment | Permission/denial | Real STT | Audible fixed voice/identity | Generated video/sync | Follow-up/barge-in | Recovery | Revocation/report | Disconnect/expiry usage | Class/verdict |
|---|---|---|---|---|---|---|---|---|---|
| Desktop Chrome / Demo + SaaS | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Blocked |
| Desktop Edge / Demo + SaaS | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Blocked |
| Android Chrome / Demo + SaaS | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Blocked |
| iOS Safari / Demo + SaaS | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Not run | Blocked |

A browser/device row passes only after its executed evidence is reviewed.
Unexecuted rows cannot be inferred from another browser or a mobile viewport.
