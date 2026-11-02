# Matt external activation checklist

Date: 2 November 2026.
**LOCAL INTEGRATION IMPLEMENTED — AWAITING PROVIDER ACTIVATION.**
This checklist is not activation authorization. No external processing, paid
calls, identity uploads, account creation or agreement acceptance occurred.

## Public Demo addendum

The [Demo parity report](DEMO_MATT_FULL_FEATURE_PARITY_ACCEPTANCE_REPORT.md)
documents the shared-engine implementation and its additional approval gates.
Public Demo mode no longer prohibits a live connection. It uses a fixed synthetic
namespace, never a customer tenant or customer document reader.

- [ ] Approve the exact browser origins and non-confidential question processing.
- [ ] Approve the separate Demo processing/usage approval record, process-lifetime
      session allowance (1-12), intelligence allocation (1-3000 units), and
      single-process execution restriction. No values were configured here.
- The obsolete `MATT_DEMO_ENABLED` switch is no longer consulted. Demo is a
  first-class shared-engine environment; explicit processing, origin, namespace,
  allocation and general live-provider safety gates still apply. The local
  validator distinguishes allowed Demo from incomplete configuration; its
  `configured` result is not a provider health or physical-operation test.
- [ ] Include the fixed synthetic namespace in the existing live allowlist.
- [ ] Obtain account-level provider caps, usage monitoring and operator cleanup.
      Process counters reset on restart and do not coordinate across replicas.
      They are not durable billing controls or production readiness evidence.
- [ ] Review shared-proxy throttling, denial-of-service risk, consent wording and
      retention. Anonymous capability access is not a verified person's identity.
- [ ] Perform separately authorized real microphone/STT/Matt voice/video checks.
      Local synthetic success does not satisfy those checks.

## A. Can be completed locally now

- [x] Preserve isolated detached worktree and existing local edits.
- [x] Recheck 41 protected hashes and prior acceptance report.
- [x] Select primary architecture and document fallback using official APIs.
- [x] Implement separate real-time audio/session adapter and existing OCI wiring.
- [x] Test native fake-device capture and actual loopback WebRTC sending.
- [x] Test synthetic speech-start, final transcript, Operion request, avatar
      delivery, interruption, follow-up, cleanup and approval refusal.
- [x] Extend offline configuration validation with field names only.
- [x] Document data flows, fixed global provider origins and current limitations.
- [ ] Establish/review an operator-owned local-only Supabase/authentication/data
      environment for genuine acceptance. The application was not started
      against unknown existing environment credentials.

## B. Requires explicit user/organization approval

- [ ] Approve the processor split: OpenAI receives continuous microphone audio;
      existing model provider receives authorized OCI context; Tavus receives
      answer text and renders Matt. No Tavus microphone transmission is claimed.
- [ ] Approve the new real-time processor instead of browser SpeechRecognition;
      determine languages, speech notices, participant consent and meeting/
      third-party speech restrictions.
- [ ] Confirm legal authority for every data category, including contract-derived
      answers. An NDA and a frontend checkbox do not confer document authority.
- [ ] Confirm DPA/subprocessors, retention/deletion, transfers/residency, lawful
      basis, risk assessment and required GDPR advice with appropriate advisers.
- [ ] Explicitly authorize specific Matt likeness/voice assets and enrollment
      actions; verify copyright/licensing/voice/likeness rights. Do not use a
      generic avatar as acceptance of Matt.
- [ ] Approve bounded paid/provider testing, maximum total spend, currency/taxes,
      account-level caps/alerts and responsible operator.
- [ ] Authorize any account creation, subscription, terms/agreement or identity
      upload separately. None is implied by approval of architecture.
- [ ] Authorize any future commit/push/deployment separately. Current task
      expressly prohibits all publication.

## C. Requires provider configuration

- [ ] Approved OpenAI project/key permits `gpt-realtime` WebRTC and
      `gpt-4o-mini-transcribe` input transcription. Verify actual chosen
      configuration and quota, not merely a successful login.
- [ ] Confirm no-response input-session billing and whether an alternative
      transcription-only transport is warranted; do not swap a non-VAD model
      into the existing VAD adapter.
- [ ] Approved Tavus developer account supports private authenticated Text Echo
      calls, required duration/concurrency and the selected face model.
- [ ] Operator reviews the current face training path and assets against
      [official model/footage requirements](https://docs.tavus.io/sections/faces/which-training-path.md).
      The API takes one training image or video, not both. Video can create its
      own voice; images require an attached approved voice. Separate old consent
      video fields are legacy, not a universal new requirement.
- [ ] Enroll Matt only after approval. Verify ready/deployed face and fixed voice
      with a human identity/voice comparison. No source footage is uploaded here.
- [ ] Deploy the correct Echo PAL and voice ID, no unexpected greeting; retain
      mandatory provider AI disclosure. Verify deployed state, not draft edits.
- [ ] Confirm retention for recordings, transcripts, operational logs, identity
      assets, support access and deletion. Recording-off is not ZDR.
- [ ] Confirm provider-region/hosting obligations. Current implementation uses
      global origins and is not an implemented EU-resident solution. Stop if that
      conflicts with mandatory procurement requirements.
- [ ] Verify account-level cleanup/recovery support and handling of uncertain
      creation. Do not unlock an orphan-call warning without an account check.

Exact server-only local configuration, after approvals:

```text
MATT_SPEECH_PROVIDER=openai-realtime
MATT_REALTIME_ENABLED=true
MATT_REALTIME_APPROVAL_ID
MATT_AUDIO_PROCESSING_APPROVED=true
MATT_REALTIME_BUDGET_APPROVED=true
OPENAI_API_KEY

MATT_LIVE_ENABLED=true
MATT_LIVE_APPROVAL_ID
MATT_LIVE_ORGANIZATIONS
TAVUS_API_KEY
TAVUS_MATT_ECHO_PAL_ID
TAVUS_MATT_FACE_ID
TAVUS_MATT_VOICE_ID
MATT_ECHO_PAL_APPROVED=true
MATT_FIXED_VOICE_APPROVED=true
MATT_DATA_PROCESSING_APPROVED=true
MATT_BUDGET_APPROVED=true
AI_PROVIDER=mistral OR openrouter
MISTRAL_API_KEY OR OPENROUTER_API_KEY
```

The existing Operion model selection is separate from the new OpenAI audio
connection. Do not replace it or send OCI tool execution to OpenAI Realtime.
Allowlist only the authorized local organization. Never put server secrets in
`VITE_` variables, chat, source, screenshots or logs. Flags record operator
configuration, not proof of legal consent, rights or spending enforcement.

## D. Requires paid/external activation authorization

- [ ] Obtain account-specific avatar/Echo, speech/transcription and model costs.
      Public rates in the [comparison](MATT_PROVIDER_COMPARISON.md) are estimates.
- [ ] Authorize a small synthetic-data test with a named operator and hard
      account-side budget where available. Confirm that mute/idle still may cost.
- [ ] Review local environment values without copying production secrets.
      The repository has dotenv loaders: do not casually start from a directory
      containing unknown `.env` files.
- [ ] Run the offline validator with an explicit ignored local-only file:

      ```powershell
      node --env-file=.env.matt.local scripts\validate-matt-local.js
      ```

      It makes no external calls; exit 0 only means configured syntax, not
      readiness or permission to create rooms. Nothing was populated here.
- [ ] Follow the safe local application startup instructions in
      [the prior local report](MATT_LIVE_AUDIO_VIDEO_LOCAL_ACCEPTANCE_REPORT.md#16-local-startup-and-acceptance-instructions).
      Use local Supabase credentials/membership/synthetic evidence and explicit
      localhost API/frontend values. Inspect inherited environment and Vite env
      hierarchy. Backend has no explicit bind-host option; isolate the workstation.
- [ ] Explicitly connect one approved room, then consent/click microphone.
      Stock/sample assets may test provider mechanics only after external-call
      approval; they cannot establish Matt identity acceptance.

## E. Requires genuine end-to-end acceptance

All unchecked; NOT VERIFIED. Execute only after A-D are satisfied.

1. On actual Chrome hardware, play/skip the introduction once; ensure no loop.
2. Connect the approved room; verify actual Matt likeness and fixed voice.
3. Consent and click microphone; grant native permission if requested.
4. Check live captured track, connected RTC peer, outbound RTP and processor VAD.
5. Ask an unexpected question aloud. Compare actual transcript to speech.
6. Confirm authorized Operion selected-analysis processing and evidence.
7. Hear intelligible generated voice and observe corresponding new Matt video.
   Inspect mouth timing, identity, facial/eye behavior and spoken-text match.
8. Ask a follow-up without clicking microphone again; verify continuity.
9. Speak over Matt. Measure audible-stop latency, stop current playback, abort
   generation and confirm provider interruption before the next response.
10. Ask another unexpected question; verify voice/video recovery.
11. Test mute/unmute, tab/output-device volume, loss/recovery, disconnect,
    refresh, deny/revoke permission and device disconnection. Verify tracks end
    and account usage terminates; investigate any cleanup uncertainty.
12. Repeat on actual Edge and available mobile/Safari hardware. Do not claim
    hardware coverage from viewport/device emulation.
13. Only with separately approved data authority, repeat on an actual OCI
    contract question; human-check evidence and answer. No confidential upload
    is requested by this checklist or authorized by this task.
14. Record timestamps, devices, latency/accuracy failures, spend and review
    outcome without storing confidential speech/contracts in logs.

No lipsync, emotional-response, accuracy, ROI, security-certification,
production-readiness or confidential paid-pilot claim may follow from local
loopback success. Existing desktop acceptance safety gate remains unresolved.
