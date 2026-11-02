# Matt microphone and audio acceptance

Date: 2 November 2026.

**Final verdict: MATT AUDIO NOT READY.**

Implementation and automated browser boundaries are verified below. A real user has not heard a genuine provider-generated Matt response in this task. No live provider/model call, identity upload or paid activation was performed.

The user explicitly selected the existing Operion-controlled browser speech architecture and authorized pushing tested improvements with live-provider activation still gated and an honest NOT READY status. This supersedes the attachment's no-push instruction, but not its prohibition on paid calls and identity uploads.

## 1. Root cause and evidence

Status: VERIFIED for source defects and configuration boundaries; BLOCKED for diagnosing an actual paid provider session.

The previous implementation had these distinct causes of unavailable/silent behavior:

1. **No explicit device capture.** The microphone button called `SpeechRecognition.start()` after an asynchronous interruption. It did not call `getUserMedia`, own a microphone `MediaStream`, or connect a captured track to recognition. Browser recognition availability was incorrectly sufficient to enter the microphone path.
2. **Intentionally muted introductory footage.** The supplied MP4 starts muted for browser autoplay compatibility. Inspection found both `vide` and `soun` track handlers in the 17,658,395-byte file; its audio track is not proof of intelligible or audible speech. Its explicit introduction-sound action remains available. It is not a generated answer.
3. **No public live voice session.** The public demo deliberately does not create an avatar or model session. Prepared findings cannot produce genuine Matt speech merely by unmuting the introduction.
4. **Fatal autoplay handling.** Any rejection of the live media element's `play()` was treated as a fatal media failure. The parent then disposed the provider session. A normal browser autoplay refusal therefore could destroy the room instead of offering user-initiated audio recovery.
5. **Incomplete output recovery.** Provider started-speaking events only unmuted the element; they did not explicitly retry playback or restore zero volume. There was no recoverable Enable Matt audio control, and provider state was not gated on successful local playback.

These are source-confirmed defects/boundaries, not a claim that a real Tavus account was observed generating a silent stream. Actual provider audio, WebRTC packet delivery, operating-system routing and speaker hardware remain unverified. No paid conversation was opened to manufacture that evidence.

## 2. Architecture decision and Tavus/Daily findings

Status: VERIFIED for official documentation; IMPLEMENTED for the selected local integration.

[Tavus Echo documentation](https://docs.tavus.io/sections/conversational-video-interface/echo-mode), accessed 2 November 2026, explicitly states:

- Text Echo disables transport microphone input and bypasses perception, speech recognition and the provider LLM.
- Text Echo sends supplied text to provider TTS/rendering.
- Microphone Echo bypasses STT, LLM and TTS; it renders incoming audio rather than answering a user's question through Operion.

Consequently, enabling the Daily microphone and switching to Microphone Echo would not satisfy the required assistant workflow. It could make Matt repeat the user's voice. This was explained to the user, who selected the following architecture:

```text
Microphone button
  -> native audio-only getUserMedia
  -> captured MediaStreamTrack
  -> supported browser SpeechRecognition.start(track)
  -> final transcript
  -> authenticated Operion selected-analysis AI gateway
  -> validated answer text
  -> Tavus Text Echo
  -> Daily remote audio + video from the same participant
  -> shared media element
  -> device speakers/headphones, pending genuine acceptance
```

User microphone audio is deliberately NOT published to Daily/Tavus Text Echo. Browser recognition may send it to the browser vendor's speech service, requiring explicit privacy acknowledgement. No new server STT vendor was selected or activated.

Daily's existing automatic remote-media subscription and participant events are used; audio and video must both be present from the same remote participant. A private room, video element or green state alone is not proof of audible speech.

## 3. Files changed

Status: IMPLEMENTED.

This audio/microphone increment changes:

- [mattMicrophone.js](../frontend/src/components/matt/mattMicrophone.js): new capture ownership, permission/device states, retry, pause/reuse, revocation and release.
- [mattAudio.js](../frontend/src/components/matt/mattAudio.js): new provider-audio validation, unmute, volume restoration, awaited playback and explicit failure.
- [mattVoice.js](../frontend/src/components/matt/mattVoice.js): accepts the captured audio track; LISTENING waits for recognition startup with a live enabled track.
- [useMattLive.js](../frontend/src/components/matt/useMattLive.js): recoverable audio status, Enable/Mute controls, playback-state gating, interruption pause and cleanup.
- [MattEnvironment.jsx](../frontend/src/components/matt/MattEnvironment.jsx): delegates live playback to the recoverable output path rather than tearing down on autoplay denial.
- [Matt.jsx](../frontend/src/routes/Matt.jsx): integrates capture, state/guidance, explicit disable and session/permission lifecycle.
- [matt-audio-permission.test.mjs](../frontend/tests/matt-audio-permission.test.mjs): new unit coverage.
- [matt-live-browser.test.mjs](../frontend/tests/matt-live-browser.test.mjs): native fake-device capture, captured-track handoff, denial/retry, output recovery and cleanup tests; optional installed Chrome/Edge channels.
- [daily-synthetic.js](../frontend/tests/fixtures/daily-synthetic.js): explicitly synthetic non-silent test tone, not a Matt voice.
- [matt-browser.test.mjs](../frontend/tests/matt-browser.test.mjs), [matt-studio.test.mjs](../frontend/tests/matt-studio.test.mjs): simulated media-device launch flags and correct one-time-introduction expectations.

Publication also includes the previously isolated, tested once-only introduction and gated live integration described in [the earlier implementation report](./MATT_ONE_TIME_INTRO_LIVE_AI_VIDEO_IMPLEMENTATION_REPORT.md). That report is a historical snapshot; this report supersedes its microphone, audio-recovery and Git/publication descriptions.

## 4. Microphone permission implementation

Status: IMPLEMENTED.

- No capture request occurs at page load or connection. The Microphone click, after explicit speech-service acknowledgement, directly initiates native `getUserMedia` before waiting for interruption/network completion.
- Constraints request audio with echo cancellation/noise suppression and `video: false`. No camera permission is requested.
- Native browser permission is used; there is no simulated production permission prompt. The browser controls whether to prompt, deny through site/OS policy, or reuse its existing grant.
- The Permissions API observes microphone revocation when supported. Capture remains authoritative if permission-status querying is unsupported; that limitation is logged.
- A granted live stream is reused for another question, avoiding an extra capture or prompt. Between ordinary questions its track is disabled, not stopped. The control explicitly distinguishes retained/paused capture from listening.
- Explicit Stop/Disable microphone releases the tracks. Re-enabling obtains a new stream; the browser can reuse its prior permission without another prompt.
- Pending capture is shared. A late grant after cancellation/unmount is stopped and never attached to a stale conversation.
- Permission denial provides site-permission and device-privacy instructions. Missing/busy devices provide actionable retry guidance.

| State | Meaning / behavior |
|---|---|
| NOT_REQUESTED | This Matt capture controller has not requested device access |
| REQUESTING | Native capture request is pending; UI does not claim listening |
| GRANTED | A live microphone track was obtained; permission is separate from listening |
| DENIED | Browser/device policy refused access; settings guidance and retry |
| DEVICE_NOT_FOUND | No usable microphone; connect/enable a device and retry |
| DEVICE_BUSY | Device could not be opened/interrupted; check other apps/device and retry |
| UNSUPPORTED | Captured-track browser support or secure-context APIs are missing |
| REVOKED | Permission removed or track/device ended; release capture and stop recognition |
| ERROR | Other capture failure; explicit diagnostic and retry |

The separate disabled/retained/listening indicator prevents GRANTED from implying active recognition or a connected avatar.

## 5. Captured-track compatibility and limitations

Status: VERIFIED for documented support; PARTIALLY IMPLEMENTED across browsers.

[MDN SpeechRecognition.start](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start) and [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json), accessed 2 November 2026, document `start(audioTrack)` and desktop Chrome support from version 135, with Edge mirroring Chromium. Android Chrome and Safari do not document this parameter as supported.

Optional WebIDL arguments can be silently ignored. The production path therefore conservatively limits captured-track recognition to desktop Chrome/Chromium/Edge 135+, with a recognition API present, on HTTPS or trusted localhost. It does not silently fall back to `start()` and open another untracked microphone.

Safari, iOS Safari, Android browsers, older Chromium and unsupported engines receive explicit guidance to use typed questions. They are NOT claimed to have working captured-stream voice input. The existing browser-recognition service itself may additionally depend on vendor support/network/policy.

Recognition receives the same captured `MediaStreamTrack`. LISTENING waits for its startup event and a still-live, enabled track. In disconnected/demo contexts, UI explicitly describes transcript review only, not a live avatar conversation. Getting a stream and passing it to recognition are not proof that a real speech service transcribed physical-device speech.

## 6. Audio output and lifecycle

Status: IMPLEMENTED.

- A live answer uses only the actual provider's audio/video stream. No browser TTS, prerecorded speech or independent voice is substituted.
- The shared player validates an enabled live audio track, clears mute, restores volume to 1, awaits `play()` and checks playback state.
- `NotAllowedError` becomes visible, recoverable guidance with **Enable Matt audio**, not fatal room disposal. Retry occurs in the explicit user-action path without an application reload.
- The Microphone click also attempts permitted playback unlock before asynchronous capture/network work. It does not bypass browser policy.
- A provider started-speaking event is displayed as SPEAKING only after successful local playback initiation. Muted/blocked output does not show that live-speaking state.
- Explicit **Mute Matt audio** retains the user's mute preference across provider answers. **Enable Matt audio** restores playback.
- Interruption immediately mutes and pauses the player, aborts generation and sends provider interruption. New response playback resumes through the same stream after acknowledgement.
- Follow-ups reuse the same room and microphone capture. Session termination, navigation/unmount, page exit, privacy withdrawal, device revocation and fatal session failure stop capture and remove live media resources.
- Failed or missing audio is explicit. No claim is made that element playback proves operating-system speaker output, a correct headset route, voice identity or lip-sync.

## 7. Automated test results

Status: VERIFIED for the executed checks.

Final backend, gateway, authorization, protocol, permission and voice unit command, from repository root:

```powershell
node --test test\matt-live.test.js test\matt-live-routes.test.js test\ai-foundation.test.js test\ai-durable-state.test.js test\analysisRunIntelligenceReadRoutes.test.js test\contract-assistant-service.test.js test\foundation-auth.test.js frontend\tests\matt-live-client.test.mjs frontend\tests\matt-audio-permission.test.mjs frontend\tests\matt-unit.test.mjs
```

Result: **89/89 passed**.

Final serial browser regression command, from frontend:

```powershell
node --test --test-concurrency=1 tests\matt-live-browser.test.mjs tests\matt-introduction.test.mjs tests\matt-media.test.mjs tests\matt-studio.test.mjs tests\matt-browser.test.mjs tests\matt-unified.test.mjs
```

Result: **63/63 passed**.

Additional installed-browser executions of the 12-case live boundary suite:

| Browser | Installed version | Result | Important limitation |
|---|---|---|---|
| Desktop Chrome | 156.0.8078.74 | 12/12 passed | Headless, simulated microphone and permission UI; mocked speech/provider |
| Desktop Edge | 156.0.4314.58 | 12/12 passed | Same limitations |
| Bundled Chromium | Playwright installation | Full 63-case run passed | Same live-media limitations; actual intro MP4 decoding tested |
| Desktop Safari | Not available here | BLOCKED | No device/browser claim |
| Android Chrome | No physical device available | BLOCKED | Captured-track feature intentionally unsupported |
| iOS Safari | No physical device available | BLOCKED | Captured-track feature intentionally unsupported |
| Bluetooth/headset/physical speakers | No authorized human listening result | BLOCKED | No physical audibility claim |

Coverage includes click-only permission acquisition; already-held stream reuse; simulated denial/missing/busy failures and retry; insecure/unsupported browser rejection; late-grant cleanup; permission/device revocation; actual captured-track handoff; no premature LISTENING; provider-track attachment; volume/mute; explicit autoplay recovery; follow-ups; interruption; consent withdrawal and termination.

The original clipping and test timing/lifecycle failures were fixed rather than reported as passing. The one-time intro is allowed to finish naturally during a longer layout test; the expected terminal state is the honest live boundary, not perpetual video.

Both `npm.cmd run build` and `npm.cmd run build:oci` passed. The normal main production bundle contains the real Daily SDK and no synthetic-provider/test-capture markers. Vite large-chunk warnings remain; they are not audio acceptance.

## 8. Mocked versus genuine evidence

Status: VERIFIED as distinguished below.

Genuine local browser execution:

- Actual Chrome/Edge/Chromium media APIs return browser `MediaStreamTrack` objects, using explicitly simulated audio devices.
- The captured track passed to the recognition mock is the same browser track.
- Actual HTML media playback, pause, volume and mute properties are exercised.
- A Web Audio analyser observes samples above 0.001 from a deliberately synthetic 0.05-gain tone on the attached remote audio track. Its silent analysis sink prevents duplicate monitoring output. This proves nonzero test signal routing, not real provider speech or human hearing.
- The supplied MP4 is actually decoded and tested for one-time playback.

Simulated, NOT genuine live acceptance:

- Browser permission UI is automatically handled by explicit test flags. No human-observed first-run native permission prompt was verified.
- Permission denials, busy/missing devices and autoplay refusal are deliberately injected.
- Browser speech results are mocked; no real speech-recognition vendor call or physical spoken question was used.
- Daily provider events/tracks and generated answers are synthetic/mocked, with unrelated external network requests blocked by tests.
- No real Tavus speech, model generation, voice identity, lip synchronization, emotional expression or operating-system speaker output was accepted.

The initial synthetic-signal check failed because its analyser had not been driven through a connected graph/time window. The final check uses a connected silent sink and bounded sample polling; it passed in Chromium, Chrome and Edge. No lowered signal threshold was used to disguise silence.

## 9. Mandatory real-device acceptance

Status: BLOCKED.

The decisive sequence has not been completed: clean site permission -> actual native prompt -> physical microphone speech -> real transcription -> Operion generation -> actual Matt audio/video -> human hearing -> follow-up -> interruption -> recovery.

No human listening or actual device permission-prompt claim is justified by the test counts. A genuine acceptance run requires the following separately authorized conditions:

- Approved Matt identity/fixed voice and configured Echo PAL.
- Approved processing agreement, browser speech-service policy, model/avatar account and bounded provider spending.
- An allowlisted test organization with authorized synthetic analysis and intelligence budget.
- Permission to make genuine model/avatar calls; no confidential contracts are needed or permitted by this task.
- A human with a physical microphone and speakers/headphones who can confirm hearing the matching answer.

## 10. Exact user actions

Status: IMPLEMENTED for available controls; BLOCKED for full live operation.

After publication:

1. Reload the page to receive the new application bundle.
2. The intro plays once, initially muted. Use **Enable introduction sound** to hear that prerecorded introduction; this is not a live answer.
3. For voice input, use current desktop Chrome or Edge over HTTPS. Open **Voice and privacy settings** and acknowledge the browser speech-service processing notice only if permitted.
4. Click **Microphone**. The browser requests native device access when its permission policy requires it. If denied, allow it in browser site permissions and OS microphone settings, then click again. No camera access is needed.
5. In public demo/disconnected mode, speech is for transcript review only. **It will not produce a genuine spoken Matt response.**
6. Only after separately approved live configuration, an authenticated authorized user can connect live Matt. If output is blocked, click **Enable Matt audio** and check tab mute, system volume, output-device selection and headset connection.
7. Use **Stop microphone** / **Disable microphone**, **Interrupt / stop**, **Mute Matt audio** and **Disconnect live Matt** for their labelled functions.

No reload is needed merely to retry permission or unlock audio after the application has loaded.

## 11. Remaining blockers and readiness

Status: BLOCKED.

- Real Matt voice/audio, microphone-to-transcript accuracy, response correspondence, lip-sync and interruption acceptance remain unproven.
- Public demo is deliberately not a paid live provider conversation.
- Mobile/Safari captured-track input is not implemented; unsupported browsers have typed input.
- Actual browser speech-vendor availability/privacy approval and physical audio routing remain external.
- The earlier integration's DPA/data-authority, identity/voice, budget ceilings, distributed rate/session controls, monitoring, cleanup and security-readiness blockers remain.
- The confidential paid pilot and the desktop individual-file acceptance safety gate remain unresolved.

The implementation must not be described as MATT AUDIO AND MICROPHONE VERIFIED or MICROPHONE VERIFIED — LIVE AUDIO BLOCKED. Physical microphone and live audio acceptance were both blocked.

## 12. Git, preservation and publication

Status: VERIFIED for the implementation publication and public checks below.

- All code was changed only in the existing isolated worktree based on `9bc748fd73a48e027a0d74007e4165fa7dfe9812`.
- Before publication, all 41/41 preserved original file hashes and original Git status matched their preservation records.
- No original dirty files were reverted, accepted or overwritten. No Keep/Undo/Redo/checkpoint/Apply/Revert file-acceptance mechanism was used.
- No environment/configuration activation, identity upload or paid provider/model call occurred.
- User-authorized publication committed exactly 34 reviewed isolated Matt implementation/test/dependency/report files and fast-forward pushed without force after confirming the tested remote parent.
- Git publication and website availability do not change this report's genuine-audio acceptance verdict.

### Observed production publication

Status: VERIFIED, 2 November 2026.

- Implementation commit: [`01c6157b9ce7b7dc82b33de9fcba3322eaa20905`](https://github.com/operionosweb/OperionOS-backend/commit/01c6157b9ce7b7dc82b33de9fcba3322eaa20905), pushed to `main`.
- GitHub reported **Vercel - operion-os: success / Deployment has completed**. [Main deployment](https://vercel.com/operion-os/operion-os/Hfi9L5cdfsmmgHgP31o6CLBM327p).
- GitHub reported **Vercel - operion-oci-production: success / Canceled by Ignored Build Step**. [OCI status](https://vercel.com/operion-os/operion-oci-production/J36oHJGezUdZBuaiXCoy8nRY9pb1). This is an ignored build, NOT evidence of a newly deployed OCI revision.
- The actual public [Matt demo](https://www.operionos.com/demo/matt) returned HTTP 200 and served `index-CLeyKaoy.js` / `Matt-C3MoaKiR.js`. The served Matt bundle contains device capture, permission/device states, audio-unlock and once-only introduction code, without the synthetic provider fixture.
- The shared production browser decoded the intro with `loop=false`, `muted=true`, advancing time and `paused=false`. Skip removed all stage video/portrait elements and showed the honest live-unavailable boundary.
- A production 390px viewport had no horizontal overflow, no replay/portrait after skip, and microphone status NOT_REQUESTED. Prepared obligations still returned four findings. No microphone or paid provider session was activated in that public check.
- Production backend health returned HTTP 200. Its `/api/matt/status` rejected an anonymous request with HTTP 401. The health endpoint does not expose a revision; an exact backend deployment SHA is not independently claimed.
- Post-push checks confirmed the original 41/41 hashes and original Git status unchanged. The earlier publication worktree remains clean at `9bc748fd73a48e027a0d74007e4165fa7dfe9812`.
- Live configuration remains disabled by default; no environment activation, subscription, identity upload or paid request was made. Public demo continues to state that live voice/video is not connected.

This documentation-only addendum records the observed implementation deployment without representing it as genuine audio acceptance.

**MATT AUDIO NOT READY.**
