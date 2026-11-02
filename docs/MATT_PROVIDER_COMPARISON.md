# Matt provider and architecture comparison

Research date/access date for all sources: 2 November 2026.
Facts below describe published interfaces, not account access or measured quality.
No provider, identity or audio-processing API was called.

## Options and recommendation

| Option | Verified technical route | Strength | Principal limitation | Decision |
|---|---|---|---|---|
| A. Tavus full pipeline + Operion custom LLM | Tavus STT, turn taking, TTS/avatar over Daily; custom LLM must expose streaming `/chat/completions` | One conversational media path; provider manages turn taking | Must implement and secure a session-scoped public SSE endpoint; disable speculative work until cancellation/cost scope is established | Fallback design, not implemented |
| B1. Realtime input + Tavus Text Echo | OpenAI `/v1/realtime/calls`, server VAD/input transcription, automatic answers disabled; Operion gateway; exact text to Tavus TTS/avatar | Operion validates complete answer before voice/video; reuses reviewed OCI path; no public LLM callback | Two peers, extra STT and rendering latency, separate processor agreements and costs | Primary, gated local implementation |
| B2. Realtime reasoning/TTS + Tavus audio Echo | Generate approved audio externally, deliver base64 audio or pre-generated microphone audio to renderer | Could centralize conversational voice generation | External spoken output must not precede Operion tool/answer validation; PCM framing, buffering, voice rights and cancellation/sync needed | Viable design direction, not implemented |
| C. Anam custom-LLM or audio-passthrough avatar | Server-side streaming custom LLM, client-controlled response streams, or external audio/avatar integration | Different avatar model/identity pipeline and custom voice options | New provider enrollment, output adapter, transport and acceptance; no evidence it improves Matt identity fidelity or aviation workflow today | Evaluated alternative; not selected |

Daily is the transport/track layer here, not Operion reasoning, an STT product
selection or a guarantee of generated speech. OpenAI Realtime alone supplies no
Matt talking-head video and is not sufficient as the final product.

### Requirements matrix

`Documented` means a provider capability exists; `conditional` means integration,
configuration, rights or agreements are required. No column means live verified.

| Requirement | A: full Tavus/custom Operion LLM | B1: primary | B2: separate voice/audio Echo | C: Anam |
|---|---|---|---|---|
| Real microphone input | Documented CVI/Daily input | WebRTC audio sender implemented locally | Separate speech pipeline required | Documented conversational input |
| Genuine conversational AI | Conditional Operion SSE integration | Existing Operion generation after final STT | Must constrain reasoning/tools to Operion | Conditional custom Operion integration |
| Natural voice | Provider TTS, quality unmeasured | Approved Tavus voice, quality unmeasured | External approved custom TTS needed | Provider/custom voice documented |
| Dynamic talking video | Documented | Existing Tavus adapter | Documented audio Echo rendering | Documented |
| A/V association/sync | Single provider session; real lip-sync unverified | Same Daily participant/element; live sync unverified | Must associate external audio/rendering correctly | Provider media; real sync unverified |
| Custom Matt identity | Authorized face enrollment required | Same requirement, no replacement | Same requirement | Authorized new avatar enrollment required |
| Custom Matt voice | Rights and deployed voice ID required | Existing fixed-voice validation reused | Additional external voice ownership/format work | Custom voices documented; rights/configuration required |
| Conversation continuity | Provider history + Operion scope design | Existing bounded per-analysis Operion history | Application-owned state needed | Provider/custom-LLM state design needed |
| User interruption | Documented turn taking; callback cancellation work | VAD -> Operion abort + Tavus interrupt implemented locally | Interrupt logic must be embedded in audio stream | SDK/turn behavior documented; adapter acceptance needed |
| Operion OCI integration | Secure scoped callback not implemented | Existing authenticated routes/readers, no new engine | Must add authoritative tool bridge | Secure scoped integration not implemented |
| WebRTC | Daily | OpenAI input + Daily output | Renderer/agent transport integration | Documented SDK/real-time integration |
| Low latency | Provider optimization claim, not measured here | Additional sequential stages; not measured | May stream faster but gating/buffer complexity | Provider claim, not measured here |
| GDPR suitability | BLOCKED pending agreements/configuration | BLOCKED for speech, model and avatar data flows | BLOCKED across additional TTS/STT processors | BLOCKED pending agreement/configuration |
| Aviation enterprise suitability | Not established | Not established; existing OCI is a useful boundary, not certification | Not established | Not established |
| Cost transparency | Public plans, account-specific quote required | Public component rates; actual no-response billing needs verification | More separately charged services | Public plans/agreement; external LLM/TTS additional |

## Verified provider details

### Tavus

[Echo documentation](https://docs.tavus.io/sections/conversational-video-interface/echo-mode):
Text Echo bypasses perception/STT/LLM and feeds text to TTS. Base64 audio Echo
bypasses all but rendering. Both disable transport microphone input. Microphone
Echo passes pre-generated audio to rendering and requires interruption logic in
that stream. **Sending user audio to Microphone Echo is not a conversation.**
Echo is incompatible with perception; do not claim emotion recognition.

[LLM configuration](https://docs.tavus.io/sections/conversational-video-interface/pal/llm.md):
custom LLM uses model/base URL/key, OpenAI-compatible `/chat/completions` and SSE.
Speculative inference is on by default. Per-tenant static headers are not proof
of per-user/analysis authorization; a fallback must bind a short-lived session
capability and validate it server-side. Do not rely on provider message content
to establish tenant identity.

[STT](https://docs.tavus.io/sections/conversational-video-interface/pal/stt.md):
full pipeline offers automatic real-time STT; English is default without
language configuration. Engine capabilities do not prove aviation terminology
accuracy. [Daily tracks](https://docs.daily.co/reference/daily-js/types/daily-track-state)
distinguish subscription/playable state from a persistent track's existence.

[Face enrollment](https://docs.tavus.io/sections/faces/which-training-path.md)
and [create face](https://docs.tavus.io/api-reference/faces/create-face.md):
choose model and approved image OR video, never both. Video can create a voice;
image-based faces need an approved voice. Phoenix paths differ in framing,
footage restrictions and preview watermark behavior. Current docs mark the old
separate consent-video API field legacy, not a universal required new field.
Rights and actual provider consent requirements remain mandatory.
[Voice documentation](https://docs.tavus.io/sections/conversational-video-interface/voices.md)
requires rights to training audio and supports fixed `voice_id`; external
voice IDs have different precedence. Existing integration rejects unapproved
external voice overrides.

### OpenAI

[WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?api=realtime),
[create call](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create)
and [hangup](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup)
document server-authorized multipart SDP negotiation and server call termination
using the returned Location handle. No master key needs to enter the browser.

[VAD](https://developers.openai.com/api/docs/guides/realtime-vad) and
[call session reference](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create)
document speech-start/stop events and disabling both automatic response flags
while retaining VAD. The implementation uses `gpt-realtime` plus
`gpt-4o-mini-transcribe`, text-only output modality, no tools, no response requests.
This is a constrained Realtime session, **not** a dedicated transcription-session
endpoint or an OpenAI voice-answer agent.

[Transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription):
the newer recommended `gpt-live-transcribe` does not support server/semantic VAD
and requires explicit audio-turn commit. It must not be substituted into the
implemented VAD flow just because it is newer. A dedicated transcription-only
transport may be a later cost optimization after its turn handling is implemented.

### Anam

[Custom LLM](https://anam.ai/docs/personas/llms/custom-llms.md),
[client-controlled response example](https://anam.ai/docs/javascript-sdk/examples/custom-llm.md),
[custom avatars](https://anam.ai/docs/personas/avatars/custom-avatars.md) and
[custom voices](https://anam.ai/docs/personas/voices/custom-voices.md) describe
server/client integration and identity/voice configuration. These capabilities
do not establish Matt appearance fidelity, approved voice or a secure OCI bridge.
No Anam SDK, account or identity was added.

## Cost structure: estimates, not measured usage

[OpenAI pricing](https://developers.openai.com/api/docs/pricing) lists:

- `gpt-realtime` audio input $32 / million tokens, audio output $64 / million;
  text input $4 / million, output $16 / million.
- `gpt-4o-mini-transcribe` estimated $0.003 per audio minute.
- Newer live transcription is listed at $0.017/minute, but has different turn
  semantics and is not this implementation.

Do not assume disabling responses makes the connection free or that all costs
equal the transcription rate. Verify actual input/session metering for this
no-response configuration, cancellations, silence and retries with the provider.
No OpenAI output voice is requested by the primary implementation.

[Tavus pricing](https://www.tavus.io/pricing) lists Developer Starter $59/month
with 100 conversational minutes and Growth $397/month with 1,250. Public CVI
overage is $0.37/minute and $0.32/minute respectively, with a 30-second minimum
and six-second rounding described. Starter has no overage limit. Obtain an
account-specific Echo quote; do not assume advertised full-pipeline allowances
or rates necessarily cover this exact split.

Illustration only: a 10-minute session would have about $0.03 mini-transcription
cost if all 10 minutes are transcribed, plus any Realtime input/session charges,
Operion model usage, avatar duration/rounding, subscription allocation and taxes.
At the published Starter CVI overage rate, 10 minutes would be $3.70 for that
component IF it applies to the approved Echo account. This is not a total quote,
budget cap, commitment, currency conversion or free-call authorization.

For A, budget avatar/full-pipeline minutes + Operion custom-model calls and
callback hosting; for B2 add separate STT/TTS/audio-rendering charges; for C use
[Anam billing documentation](https://anam.ai/docs/resources/billing-and-limits.md)
and agreement plus external LLM/TTS. Idle/muted sessions can remain billable.
No latency or cost advantage is asserted without measurement.

## Privacy/commercial acceptance

[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data):
API data is not used for training by default, but default abuse-monitoring
retention can be up to 30 days. ZDR/modified monitoring require eligibility and
approval; endpoint limitations still matter.
[Tavus privacy](https://www.tavus.io/privacy-policy) is not an executed business
DPA. [Anam privacy controls](https://anam.ai/docs/security/privacy.md) distinguish
recording-off from Enterprise ZDR and exclude avatar source images/knowledge
uploads from that ZDR promise.

None proves Operion's GDPR compliance, EU-only processing, verified production
TLS, tenant isolation, security certification or aviation enterprise readiness.
Current primary uses global provider origins, not an implemented regional
deployment. Mandatory commercial suitability remains blocked until assessed.
