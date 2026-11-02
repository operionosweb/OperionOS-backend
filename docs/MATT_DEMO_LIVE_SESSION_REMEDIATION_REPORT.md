# Matt Demo shared-session remediation

Prompt 73196. Date: 2 November 2026.

## Changes and non-changes

The [root-cause report](./MATT_DEMO_LIVE_BLOCKER_ROOT_CAUSE_REPORT.md) establishes
that the persistent public message comes from the **older served bundle**, not
the current local shared path. No replacement Demo engine, cosmetic error
suppression or mock production session was introduced.

The local Demo guard removal, separate prepared-data authorization and shared
provider integration were already present. They were retained and freshly
tested. This task's runtime changes are limited to:

1. [Floating control](../frontend/src/components/demo/OperionAssistant.jsx):
   accessible closed-state name **Ask Matt**, retaining the existing approved
   image and context-preserving launcher.
2. [Shared live request handling](../frontend/src/components/matt/useMattLive.js):
   on 401/403 or explicit missing/expired application-session codes, invoke
   existing `clearMattSessions()` before propagating the failure. This clears
   retained browser answers, conversation and reports, rather than only
   disconnecting media. Existing live teardown/error handling remains.

The reset applies to failed interrupt, turn and cleanup requests, not only
answer POSTs. This matters because the actual UI interrupts before a follow-up:
revocation may first be detected by `/interrupt`.

No backend authorization boundary, provider approval or usage limit was
weakened. No configuration variable was changed.

## Source-level session capability

When configuration and approval gates are satisfied:

```text
Shared Demo UI / deliberate consent
→ /api/demo/matt/status
→ /api/demo/matt/access (bounded capability)
→ /api/demo/matt/sessions
→ shared createMattLiveRouter
→ shared createMattLiveService.create
→ configured Tavus provider.create
→ private room credentials to the shared browser client
```

The same hook handles microphone, selected browser/Realtime input, exact-answer
Echo output, interruption, follow-ups and cleanup in both environments.
Only identity authorization and the context adapter differ. Demo can access
prepared contracts/aviation data only, not SaaS customer records.

**Software path is capable of calling the real adapter when approved. Actual
account entitlement, identity/voice and successful remote creation remain
unverified.** Local tests inject model/avatar I/O; no fixture is reported as a
genuine provider session.

## Fresh missing-configuration result

`node scripts\validate-matt-local.js` returned expected exit 1 / BLOCKED,
no live room, zero network. It reads inherited process variables only and
does not load ignored environment files or inspect production settings.

Missing shared fields:

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

Additional missing Demo requirements:

```text
MATT_DEMO_APPROVAL_ID
MATT_DEMO_SINGLE_PROCESS_APPROVED
MATT_DEMO_ALLOWED_ORIGINS
MATT_DEMO_MAX_SESSIONS
MATT_DEMO_INTELLIGENCE_BUDGET
fixed Demo UUID in MATT_LIVE_ORGANIZATIONS
```

The last diagnostic is named `MATT_DEMO_ORGANIZATION_ALLOWLIST` by the validator;
it is not a separate environment variable. `MATT_DEMO_ENABLED` is obsolete.
Default browser speech selection passing configuration checks is not physical
microphone or speech-service acceptance.

## Verification

- Fresh focused group: **85/85 pass**.
- Fresh final serial affected-browser group: **60/60 pass**.
- Actual Demo UI → actual local capability/router/context/gateway chain: pass
  with model/avatar I/O injected.
- Explicit regression that `MATT_DEMO_ENABLED=false` cannot disable an otherwise
  approved shared Demo: pass in focused group.
- Unconfigured Demo exposes connection controls and honestly reports
  configuration failure without creating a room: pass.
- Real Tavus adapter private-room/fixed-voice request shape and rejection
  paths: pass with mocked HTTP, not an actual provider-account verification.
- Expired, foreign, reused or wrong-namespace identities remain denied.

Complete individual browser results and commands are retained with the
[final summary](./MATT_PROMPT_73196_FINAL_SUMMARY.md).

No genuine speech/video, lip sync, human audibility, production tenancy or paid
pilot acceptance is claimed. Confidential paid pilot remains **NOT READY**.
