# Matt provider activation and acceptance checklist

Date accessed/reviewed: 2 November 2026. **PREPARATION ONLY — NOT AUTHORIZATION.**
All activation steps below are unexecuted. No provider account, identity
training, paid session or external inference was initiated.

## 1. Implemented chain and boundaries

```text
Deliberate connect + microphone action
→ native captured microphone
→ browser captured-track speech OR separately approved OpenAI Realtime input
→ final transcript
→ shared Operion reasoning with authorized OCI/prepared Demo context
→ validated answer and evidence IDs
→ Tavus Text Echo
→ Daily subscribed audio/video from the same participant
→ one browser player
```

Actual adapters inspected:

- [Microphone](../frontend/src/components/matt/mattMicrophone.js): secure context,
  explicit device acquisition, denial/revocation cleanup.
- [Speech configuration](../services/mattSpeechConfiguration.js) and
  [OpenAI adapter](../providers/openaiMattSpeechProvider.js): server
  `POST https://api.openai.com/v1/realtime/calls`, multipart SDP/session;
  `gpt-realtime` with `gpt-4o-mini-transcribe`, server VAD and autonomous
  responses disabled. Call handle retained for `/hangup`.
- [Realtime client](../frontend/src/components/matt/mattRealtimeSpeech.js):
  send-only audio, final-turn association, unexpected model/output rejection.
- [Tavus adapter](../providers/tavusEchoProvider.js):
  `https://tavusapi.com/v2`, PAL inspection, private authenticated conversation,
  approved face and fixed voice, no greeting, recording disabled, bounded room.
- [Daily output](../frontend/src/components/matt/tavusEchoClient.js): exact answer
  via `conversation.echo`, a single remote A/V participant, interruption and
  network recovery. Daily input devices are disabled; the microphone is not
  sent to Tavus through this adapter.

The existing Operion model gateway is separate from OpenAI audio input. It uses
the selected Mistral/OpenRouter configuration. No alternate assistant engine,
external web research tool, generic avatar or browser-TTS response is added.

Same-participant tracks do not prove physical lip synchronization. No runtime
biometric check proves the configured face is Matt. That requires rights,
operator verification and actual human review. Natural expression is a provider
capability to evaluate, not an emotion-recognition or persistent-memory claim.

## 2. Current safe readiness result

Executed this pass:

```powershell
node scripts\validate-matt-local.js
```

Expected exit **1**; overall/configuration **BLOCKED**; Demo `allowed: true`,
`readiness: configuration_incomplete`; zero network and no live room.
Exact output is retained in session evidence, `final92641-readiness.json`.

The validator reads inherited process variables only. It does not load ignored
environment files, inspect a deployed account or validate provider entitlements.
Thus "missing" below means missing in this check, not absent everywhere.

| Mandatory for live output/reasoning | Current inherited result |
|---|---|
| MATT_LIVE_ENABLED; MATT_LIVE_APPROVAL_ID; MATT_LIVE_ORGANIZATIONS | Missing |
| TAVUS_API_KEY | Missing |
| TAVUS_MATT_ECHO_PAL_ID; TAVUS_MATT_FACE_ID; TAVUS_MATT_VOICE_ID | Missing |
| MATT_ECHO_PAL_APPROVED; MATT_FIXED_VOICE_APPROVED | Missing |
| MATT_DATA_PROCESSING_APPROVED; MATT_BUDGET_APPROVED | Missing |
| Selected model credential: MISTRAL_API_KEY by default | Missing; OpenRouter would require its existing OPENROUTER_API_KEY instead |
| Exact model/API entitlements, deployed PAL/face/voice | Not checked against provider |

Additional mandatory public Demo requirements remain:

```text
MATT_DEMO_APPROVAL_ID
MATT_DEMO_SINGLE_PROCESS_APPROVED
MATT_DEMO_ALLOWED_ORIGINS
MATT_DEMO_MAX_SESSIONS
MATT_DEMO_INTELLIGENCE_BUDGET
fixed Demo UUID in MATT_LIVE_ORGANIZATIONS
```

All are unsatisfied in the inherited check. The validator calls the last
condition `MATT_DEMO_ORGANIZATION_ALLOWLIST`; it is not a new secret variable.
The obsolete `MATT_DEMO_ENABLED` switch is not consulted.

Default speech selection is `browser`. The selected configuration's
`VERIFIED` output does **not** prove device support or approved speech processing.
If the existing Realtime adapter is explicitly chosen, all of these are
mandatory:

```text
MATT_SPEECH_PROVIDER=openai-realtime
MATT_REALTIME_ENABLED=true
MATT_REALTIME_APPROVAL_ID
MATT_AUDIO_PROCESSING_APPROVED=true
MATT_REALTIME_BUDGET_APPROVED=true
OPENAI_API_KEY
```

No such selection or flag change occurred. Never put secrets in `VITE_`
variables, source, reports, screenshots or chat.

## 3. Mandatory approvals and account evidence

- [ ] Resolve the software/security limitations in the final acceptance reports.
  Do not treat passing fixture tests as deployed isolation certification.
- [ ] Name the operator, processor projects, approved environment, test data,
  maximum total spend/currency/tax allowance and emergency stop owner.
- [ ] Obtain explicit authority for microphone speech, questions, source
  excerpts and contract-derived answers. Use synthetic data for initial runs.
  An NDA or checkbox does not establish contract-processing authority.
- [ ] Have appropriate legal/data-protection advisers confirm DPA,
  subprocessors, lawful basis, notices, rights, international transfers,
  residency, access, retention/deletion and incident handling. No certification,
  verified EU-only deployment or legal-compliance conclusion is supplied here.
- [ ] Approve Matt likeness and voice rights, and each required upload/enrollment
  action separately. Existing footage is not evidence that enrollment or
  commercial use has been authorized.
- [ ] Confirm deployed face, voice and Text Echo PAL entitlement. Operator must
  compare actual likeness/voice to approved references; no stock substitute.
- [ ] Confirm provider rate/concurrency quotas and private room tokens, no
  automatic greeting, appropriate AI disclosure, no unexpected recording.
- [ ] Confirm current API/model support for the exact adapter payloads. Official
  docs evolve; successful mock responses are not account capability evidence.

### Identity onboarding

[Tavus's current primary training-path documentation](https://docs.tavus.io/sections/faces/which-training-path.md)
describes choosing a Phoenix model, then **one image or one video**, not both.
Video training can derive voice from audio; image-based faces require an
attached voice. Therefore:

- If an already-approved deployed Matt face and fixed voice exist, verify them;
  do not retrain unnecessarily.
- If they do not exist, approved training/enrollment is a mandatory external
  prerequisite. Exact model/asset requirements and rights must be confirmed.
- This task did not inspect private account assets or upload the attached
  footage, so it cannot determine whether onboarding is already complete.
- No new training path or alternative provider is implemented here.

## 4. Costs: public reference, not a quote or spending authorization

Primary public sources accessed 2 November 2026:

- [Tavus pricing](https://www.tavus.io/pricing): Developer Starter **US$59/month**
  plus usage, 100 included conversational-video minutes and up to 3 concurrent
  streams; Growth **US$397/month**, 1,250 minutes and up to 10 streams. The
  displayed CVI overage references are **US$0.37/min** and **US$0.32/min**,
  respectively, with a 30-second conversation minimum and six-second billing
  increments described on the page.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing):
  `gpt-realtime` audio input **US$32/1M tokens**, cached audio input
  **US$0.40/1M**; text input/output **US$4/US$16 per 1M**. Audio output is
  listed as US$64/1M but is not intended in this input-only chain.
  `gpt-4o-mini-transcribe` is listed at an estimated **US$0.003/min**.

These are references, not verified account-specific Text Echo entitlements or a
complete bill. The transcription estimate alone is **not the cost of the
implemented Realtime session**. No-output inference behavior, cached input,
transcription charges, retries, identity training, bundled transport, idle
minutes, included-minute eligibility and taxes must be confirmed by the operator.
No separate Daily subscription requirement is inferred merely from using its SDK.

Planning example only: eight ten-minute device/environment runs equal 80 room
minutes; multiplying by public overage yields **US$29.60** at $0.37/min or
**US$25.60** at $0.32/min for that component alone. This is neither a total nor
an expected invoice: plans, included allowances, minimums and retests change it.
Do not treat these amounts as an approved budget.

Budget worksheet before activation:

```text
Total = plan/training charges
      + actual billable avatar room minutes × confirmed account rate
      + Realtime audio/text token charges + applicable transcription
      + Operion Mistral/OpenRouter token usage
      + any separately confirmed transport/support/transfer costs
      + taxes/FX + explicitly approved retest contingency.
```

Unknown token volumes, chosen model tariffs and account state prevent an honest
total forecast. Internal intelligence units are not euros/dollars or provider
billing caps.

## 5. Usage constraints and retention

Local design limits (not proof of global enforcement): one Demo room and three
general service rooms per process by default; ten-minute absolute room;
three-minute idle timeout; Demo capabilities twenty minutes with one-use start
within sixty seconds, ten attempted turns and three speech attempts; approved
process allowance 1–12, intelligence allocation 1–3,000, peer access/request
throttles. Process restarts/replicas do not share durable currency limits.

- [ ] Confirm the actual account limits are no lower than the approved test
  plan; keep one test room at a time even if a plan permits more.
- [ ] Obtain account-side caps/alerts and an operator reconciliation procedure.
  Mute and idle connected time may still be billable.
- [ ] Verify retention/deletion separately for microphone/transcripts, model
  inputs/outputs/cache/jobs, avatar answer text, logs/recordings, likeness/voice
  training assets and backups. Recording disabled is not zero retention.
- [ ] Record deletion request/result evidence without storing confidential data.

## 6. Exact future activation sequence — do not run now

1. Close the final software/security acceptance gaps and obtain the missing
   editor versions or explicitly retain the unresolved acceptance hold.
2. Obtain the approvals in section 3 and a signed-off numeric cost worksheet.
3. Operator verifies existing provider projects and assets without sharing keys.
   Any account creation, agreement, purchase or training needs separate consent.
4. Prepare isolated local auth/database with two fictional tenants and approved
   prepared Demo data; review dotenv/Vite inheritance before startup.
5. Only after approval, configure server-only ignored local values above,
   fixed Demo namespace and exact loopback origin; do not copy production keys.
6. Run the existing validator using that explicitly approved local environment.
   A syntactic success is not a health check and does not authorize connections.
7. Operator verifies zero active calls, account caps and deployed fixed assets.
8. Deliberately consent/connect **one** room. Review private-session metadata
   locally, never paste tokens. Confirm real identity/voice and same-participant
   media; stop for any mismatch.
9. Consent/click microphone, ask an unexpected synthetic question, and execute
   the [physical matrix](./MATT_PHYSICAL_DEVICE_ACCEPTANCE_TEST_PLAN.md).
10. Disconnect, confirm both server and provider calls ended, reconcile costs,
    document result and delete evidence under the approved retention policy.

No provider health probe or implicit room creation should be added to a public
status request.

## 7. Exact rollback/stop procedure — future authorized run only

1. Stop input immediately: disable microphone, interrupt output and disconnect;
   do not retry an uncertain create/cleanup.
2. Operator disables new live sessions using the existing general live
   enablement gate and prevents new public access through approved operational
   controls. Do not restore an artificial Demo-only switch or generic avatar.
3. Operator terminates every recorded Tavus conversation and Realtime call
   through the existing end/hangup paths or authorized provider console.
4. Confirm tracks/peer/data channel are stopped and no remote active usage
   remains. A vanished UI is insufficient.
5. Preserve only redacted synthetic failure evidence; hold rollout. Reconcile
   possible orphan calls/spend before releasing locks or restarting.
6. Revoke/rotate a compromised test credential through its authorized owner.
   Quarantine any unexpected data flow; follow approved incident/deletion steps.
7. Restore only reviewed local configuration after a separate restart decision;
   rerun focused regressions/validator before any new explicit test approval.

No Git reset/revert, deployment, identity deletion or destructive recovery
action is part of rollback. Optional improvements such as alternative
processors, emotion sensing and new controls are outside this task.

## Primary-source verification notes

The generic old OpenAI WebRTC URL returned 404 and the marketing pricing URL
returned 403. The current [Realtime overview](https://developers.openai.com/api/docs/guides/realtime)
and documentation pricing page were accessible. The overview still identifies
`/v1/realtime/calls` for WebRTC; a shared voice guide also displays newer Live
examples. That is not permission to migrate the implemented adapter or to assume
account compatibility. Exact account/API behavior remains an activation gate.
