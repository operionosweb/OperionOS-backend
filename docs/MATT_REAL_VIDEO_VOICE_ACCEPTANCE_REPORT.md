# Matt real video/voice acceptance and reproducible device procedure

Date: 2 November 2026. **Real provider and physical-device acceptance BLOCKED.**

No paid room, provider inference, microphone, speakers, likeness enrollment or
external account was activated. The public production page and deployment
console were not used to authorize testing. This is a procedure, not a record
of a successful genuine Matt conversation.

## 1. Evidence classification

Use only these labels in the eventual run log:

- **Verified physically**: a human-operated actual device has supplied and
  reproduced the required evidence.
- **Verified with provider test session**: an approved real provider actually
  performed the operation, with bounded synthetic data and recorded outcome.
- **Verified through automated simulation only**: injected media/model/STT or
  fake-device/loopback evidence, never physical/provider acceptance.
- **Not tested**: no applicable execution evidence.
- **Blocked by approval/configuration**: required authority or configuration
  has not been demonstrated.

| Requirement | Current classification | Evidence boundary |
|---|---|---|
| Deliberate consent/connect/microphone action | Verified through automated simulation only | Existing browser lifecycle tests |
| Physical user's microphone and real spoken transcript | Blocked by approval/configuration | No physical input or actual STT run |
| Real-time input transport | Verified through automated simulation only | Prior actual loopback RTP; injected transcript, not real transcription |
| Authorized OCI/model orchestration | Verified through automated simulation only | Injected model and fictional data; see security audit limitations |
| Generated approved fixed Matt voice | Blocked by approval/configuration | No real provider output |
| Generated approved Matt talking video | Blocked by approval/configuration | Reference footage/portrait cannot satisfy it |
| Lip synchronization and identical spoken response | Blocked by approval/configuration | Same-participant A/V architecture is not a measured lip-sync pass |
| Identity preservation and natural facial/eye motion | Not tested | No generated Matt likeness comparison |
| Natural timing, barge-in and emotional delivery | Not tested | Echo does not establish emotion recognition |
| Follow-ups/interruption/recovery | Verified through automated simulation only | Real-provider quality and timing still unknown |
| Chrome/Edge physical sound and devices | Not tested | Installed-browser fake-device tests are not physical tests |
| Actual mobile/Safari microphone and playback | Not tested | Viewport tests do not establish device support |
| Idle/disconnect/room termination | Verified through automated simulation only | Remote account usage reconciliation not performed |

No row is currently "Verified physically" or "Verified with provider test
session." No measured transcription accuracy, voice quality, latency or ROI is
claimed.

## 2. Existing pipeline and the acceptance gap

The current intended architecture is:

1. A deliberate microphone click acquires a browser audio track.
2. The selected speech adapter processes it:
   - default browser recognition (vendor behavior requires review); or
   - separately approved OpenAI Realtime send-only input.
3. Final transcript enters Operion's existing scoped question orchestration.
4. The selected context adapter retrieves reviewed platform facts and
   authorized OCI or prepared Demo evidence.
5. The existing model gateway generates an answer under allocation and
   confirmation rules.
6. Answer shape and cited identifiers are checked.
7. The existing Text Echo path sends that exact answer text to Tavus.
8. Daily supplies audio and video from the same participant to one element.

The optional OpenAI input path suppresses autonomous model answers; Operion
generates the response. Text Echo receives answer text, not the microphone.
Combining output A/V avoids an independently dubbed track but does not prove
matching articulation or synchronized rendering.

The [integration design](./MATT_LIVE_INTEGRATION_DESIGN.md) and
[external activation checklist](./MATT_EXTERNAL_ACTIVATION_CHECKLIST.md)
describe implemented adapters. Their historical descriptions are not evidence
that a provider account, PAL, face or voice is ready.

## 3. Safe readiness validation executed in this pass

From the isolated local worktree:

```powershell
node scripts\validate-matt-local.js
node --test test\matt-local-configuration.test.js
```

Observed:

- Overall and configuration status: **BLOCKED**.
- Validator exit: **1**, the expected blocked result.
- Network requests: **0**; live session created: **false**.
- Four validator/redaction tests passed.
- Default speech selector: `browser`. Its printed `VERIFIED` means selected
  configuration only, not browser permission, supported physical STT or
  approved third-party processing.
- Demo process allowance/allocation: zero in the inherited process environment.

The validator intentionally does not auto-load the repository environment.
These results describe only its inherited process environment, not all
possible ignored files, production settings or provider accounts.

Missing inherited live configuration names:

```text
MATT_LIVE_ENABLED
MATT_LIVE_APPROVAL_ID
MATT_LIVE_ORGANIZATIONS
TAVUS_API_KEY
TAVUS_MATT_ECHO_PAL_ID
TAVUS_MATT_FACE_ID
TAVUS_MATT_VOICE_ID
MATT_ECHO_PAL_APPROVED
MATT_FIXED_VOICE_APPROVED
MATT_DATA_PROCESSING_APPROVED
MATT_BUDGET_APPROVED
MISTRAL_API_KEY
```

Additional missing Demo names:

```text
MATT_DEMO_ENABLED
MATT_DEMO_APPROVAL_ID
MATT_DEMO_SINGLE_PROCESS_APPROVED
MATT_DEMO_ALLOWED_ORIGINS
MATT_DEMO_MAX_SESSIONS
MATT_DEMO_INTELLIGENCE_BUDGET
MATT_DEMO_ORGANIZATION_ALLOWLIST
```

The last name is a validator condition requiring the fixed Demo namespace in
the live allowlist, not a newly invented secret or an instruction to create a
same-named environment variable. Current model default is Mistral; an approved
OpenRouter selection would instead need its existing corresponding credential.
No values, keys, room tokens or SDP are included here.

## 4. Provider-readiness and approval checklist

All unchecked items require evidence, not merely setting an approval flag.

| Gate | Evidence required before a genuine run | Current status |
|---|---|---|
| Independent security findings | Review/fix identified issues and adversarial rerun; explicit test risk decision | See separate audit; no blanket security acceptance |
| Provider accounts/credentials | Operator confirms authorized project and account entitlements without disclosing keys | Not verified |
| Matt visual identity | Rights/likeness authorization and deployed face identity compared locally to approved reference | Blocked; no upload |
| Fixed voice | Rights and named approved voice confirmed against actual provider output | Blocked |
| Echo integration | Deployed intended PAL/face/voice, private authenticated room, no unexpected greeting | Not verified |
| Speech configuration | Explicit choice of browser vendor or separately gated Realtime project/model/transport | Not physically verified |
| Video/streaming | Actual private room, subscribed same-participant playable A/V, session expiry and recovery | Simulation only |
| WebRTC/network | Supported secure context, ICE/TURN/firewall and permission behavior on each actual device | Not tested physically |
| Data authority | Organization authorizes the particular synthetic/contract-derived data flow | No new processing authorized |
| DPA/GDPR/privacy | Appropriate advisers approve processors/subprocessors, lawful basis, notices, transfers/residency and access | Not established by code |
| Retention/deletion | Written rules for microphone, transcripts, model inputs/outputs, caches, recordings, identity assets and operational logs | Provider verification pending |
| Budget | Named operator, approved total currency/spend, account-side caps/alerts and emergency termination | No spend authorized |
| Device access | Human tester has actual Chrome, Edge and identified supported mobile hardware plus mic/output | Not supplied |
| Local environment | Reviewed isolated auth/database with fictional accounts; no unknown production credentials | No app startup authorized here |

If Realtime input is chosen, its existing enablement, approval, audio-processing,
budget and server credential gates must also be satisfied. Do not copy
production keys, put credentials into `VITE_` variables, accept agreements or
activate services to make a checklist green.

An NDA and a frontend checkbox do not establish document-processing authority.
Recording disabled does not establish zero retention. Global API endpoints do
not establish EU-only hosting. These questions require confirmation, not legal
conclusions from this report.

## 5. Reproducible physical acceptance procedure

**Do not execute until separately approved.** No approval is implied by these
instructions. First keep acceptance/rollout held for the assurance gaps
described in the [tenant audit](./MATT_TENANT_ISOLATION_SECURITY_AUDIT.md).

### A. Prepare one approved, bounded run

1. Record run ID, operator, device/OS/browser versions, selected microphone,
   output device, speech path, environment (Demo/SaaS), approved identity/voice,
   start time and hard spending limit. Do not record keys or bearer tokens.
2. Use two isolated fictional SaaS organizations and the fixed prepared Demo
   namespace. Supply approved non-confidential fixtures only. Establish a
   ground-truth sheet with clauses, amounts/currencies, trigger dates and
   source IDs. Avoid client contracts and ordinary user speech in recordings.
3. Confirm account-side zero active rooms/calls, remaining budget and emergency
   hangup access. Confirm local backend/frontend bind/network isolation with
   an operator; do not casually start from the root with unknown `.env` values.
4. Agree acceptance thresholds before paying for a run. At minimum: no wrong
   identity, no fabricated critical amount/date/clause, no extra spoken
   response, no foreign canary, confirmed teardown. Record timing measurements
   rather than inventing a pass threshold after observing them.
5. Ensure human consent and approved retention for any evidence recording.
   A synthetic-only audiovisual capture can be retained if explicitly approved.

### B. Run the same script in each environment and browser

Perform separately in **desktop Chrome**, **desktop Edge** and each **supported
physical mobile browser**. Record unsupported browser paths as blocked or not
implemented, not passed using a different desktop browser. Repeat for Demo and
SaaS; do not reuse provider rooms, credentials or histories between them.

| Step | Human action | Required evidence/pass condition |
|---|---|---|
| 1 | Load Matt; do not consent or click microphone | No paid room or microphone activation merely from page load |
| 2 | Play or skip introduction, then open floating/expanded assistant | Introduction occurs once; it is never looped/substituted as a response |
| 3 | Deliberately consent/connect | Exactly one authorized private room; verify actual approved Matt identity and voice |
| 4 | Deny microphone, then retry after explicit permission | Denial visible; no false listening status; native retry works |
| 5 | Speak an unexpected synthetic question | Physical track and actual transcript match speech; no injected transcript or speech synthesis |
| 6 | Ask platform and account questions in their respective scopes | Correct status/navigation; authorized catalog; sources and limitations visible |
| 7 | Ask for a source clause and conditional deadline | Original fictional source shown; no unsupported current overdue date or amount |
| 8 | Observe generated voice and video | The same new answer is audible and visibly articulated by Matt, not stock/reference footage |
| 9 | Ask a follow-up | Relevant authorized continuity, no unrelated source or account |
| 10 | Interrupt while Matt speaks | Audible output stops, generation/provider interruption acknowledged, next answer is not overlapped |
| 11 | Mute/unmute and change output device | Actual audible behavior matches control; no duplicate independent voice track |
| 12 | Deny autoplay, then use explicit audio enable | Visible recovery; no speaking claim from a silent blocked player |
| 13 | Briefly interrupt network, then restore | Explicit reconnect state; stale answer suppressed; no unbounded paid-room creation |
| 14 | Select an allowed different scope/account | Old output/context invalidated; any new room is separately deliberate and authorized |
| 15 | Revoke permission/membership during an active run | New reads denied; check outstanding request, room and RTC teardown against security audit requirements |
| 16 | Ask about selected prepared Globe flight, main and floating Matt | Correct selected fictional context only; SaaS real telemetry must be unavailable unless explicitly implemented/authorized |
| 17 | Disconnect, close tab, then test idle in a separate approved room | Local tracks stop; backend and provider account confirm calls ended; retries do not duplicate rooms |
| 18 | Reconnect only after confirmed cleanup | New owner-bound session, no stale private history or output |

If optional Realtime input is used, physically test full-duplex speech/barge-in.
If browser recognition is selected instead, record its actual behavior; do not
claim the Realtime path was tested or substitute mock transcripts.

### C. Establish same-response video/audio evidence

For each retained synthetic turn:

- Correlate transcript, authorized source IDs, generated answer, turn ID and
  outgoing Echo text. At the application boundary the Echo text must equal
  the validated answer; do not infer this from hearing a plausible sentence.
- A human transcribes the actual audible response and checks names, negations,
  dates, currencies and numbers against that answer. Record omissions,
  additions, repeated fragments and interruptions explicitly.
- Verify audio/video belong to the same current participant and room. Watch
  sustained new lip/face motion; compare distinctive words/plosives against
  the audible speech. With approved capture, measure A/V onset and sync drift
  at several positions, not just the first frame.
- Compare likeness/voice to approved references without uploading them in
  this task. Generic replacement identity or static/unrelated looping footage
  fails even if the request returned HTTP 200.
- Record response start/end latency and interruption-to-silence timing.
  Naturalness/emotional appropriateness require human review; no emotion
  sensing or persistent affective memory is established by Text Echo.

### D. Stop conditions and closing evidence

Stop the affected test/rollout immediately for any unauthorized canary reaching
another context, response, cache or provider session. Preserve redacted
synthetic evidence and classify the failure as critical. Stop also for an
unexpected processor, wrong identity/voice, unapproved spending, ambiguous
authority, duplicate/orphaned room or uncertain cleanup.

Do not silently fallback to a photo, introduction replay, independent TTS,
generic avatar or another provider. Before another run, reconcile all provider
calls and spending through the authorized operator.

## 6. Blank execution register

No rows below have been executed:

| Run/environment/browser/device | Speech path | Physical input/transcript | Generated voice/video/identity | Exact-response/sync | Follow-up/interruption/reconnect | Cleanup/provider usage | Classification/reviewer |
|---|---|---|---|---|---|---|---|
| Demo / Chrome / device TBD | TBD | Not tested | Blocked | Blocked | Simulation only | Simulation only | Not executed |
| SaaS / Chrome / device TBD | TBD | Not tested | Blocked | Blocked | Simulation only | Simulation only | Not executed |
| Demo / Edge / device TBD | TBD | Not tested | Blocked | Blocked | Simulation only | Simulation only | Not executed |
| SaaS / Edge / device TBD | TBD | Not tested | Blocked | Blocked | Simulation only | Simulation only | Not executed |
| Demo / supported mobile TBD | TBD | Not tested | Blocked | Blocked | Not tested physically | Not tested physically | Not executed |
| SaaS / supported mobile TBD | TBD | Not tested | Blocked | Blocked | Not tested physically | Not tested physically | Not executed |

**Conclusion:** the intended genuine pipeline has code and simulation evidence,
but actual microphone-to-generated-Matt operation remains unproven. No full
real-time acceptance or confidential paid-pilot readiness can be awarded.
