# Demo live Matt software acceptance and activation readiness

Date: 2 November 2026.
**PARTIALLY ACCEPTED — DEMO ENABLED, PROVIDER ACTIVATION PENDING**

## Exact source of the reported restriction

In detached HEAD `c043216525424a9bdd60f3ffeb6bfce2599703b9` and historical
publication commit `01c6157b9ce7b7dc82b33de9fcba3322eaa20905`,
[useMattLive](../frontend/src/components/matt/useMattLive.js) had:

```javascript
setError(demo ? "Live video is disabled for this public prepared-data demo. No provider session has been created."
  : /* SaaS configuration explanation */ ...);
// ...
if (demo || !organizationId || !consent) {
  // reject before a session request
}
```

The `demo` branch was the precise unconditional frontend rejection. The
previous local implementation had already removed it, introduced a bounded
Demo capability route and wired the shared engine. This task did not pretend
to rediscover that existing local work as a new implementation.

A read-only snapshot of the shared production browser page still showed the
old quoted message. No production setting was read or changed; no new
production session was attempted. The page's release is not the current
unpublished worktree.

## What changed now

- Removed the remaining redundant `MATT_DEMO_ENABLED` check from
  [Demo configuration](../services/mattDemoConfiguration.js).
  Even a stale `false` value cannot impose a Demo-only feature prohibition.
- Kept all explicit processing/identity/voice/budget approvals, approved
  origins, fixed namespace allowlist, bounded allocation and single-process
  execution requirements. Demo data does not disable assistant capability;
  public external processing still requires actual authority.
- Safe validator reports `allowed: true` and
  `readiness: configuration_incomplete` or `configured`.
- Status/HTTP errors distinguish configuration, provider availability,
  security denial and exhausted usage. `configured` means configured, not a
  successful external health check.
- Added runtime fake-provider failure coverage; it returns
  `provider_unavailable`, not "public Demo disabled."
- Retained the existing shared consent -> capability -> private session ->
  microphone/STT -> Operion -> Text Echo/Daily path. No fabricated session or
  replay video was substituted.

The general `MATT_LIVE_ENABLED` remains an explicit provider safety/kill switch
for both environments; it is not a prepared-data restriction.

## Current safe readiness result

`node scripts\validate-matt-local.js` returned expected exit **1**:

```text
overall: BLOCKED
configurationStatus: BLOCKED
demo.allowed: true
demo.readiness: configuration_incomplete
demo.status: BLOCKED
networkRequests: 0
liveSessionCreated: false
```

Inherited live configuration missing:

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

Additional inherited Demo requirements missing:

```text
MATT_DEMO_APPROVAL_ID
MATT_DEMO_SINGLE_PROCESS_APPROVED
MATT_DEMO_ALLOWED_ORIGINS
MATT_DEMO_MAX_SESSIONS
MATT_DEMO_INTELLIGENCE_BUDGET
MATT_DEMO_ORGANIZATION_ALLOWLIST
```

The final name means the existing live allowlist must include the fixed Demo
namespace; it is a reported condition, not a request to create a same-named
environment variable. No configuration value was set. The validator reads
inherited environment only, not ignored `.env` files or Vercel secrets.
Missing inherited fields do not prove deployed provider accounts are absent.

Default speech selection is browser recognition. Its syntactic `VERIFIED`
status is not real recognition/device approval. OpenAI Realtime input remains
separately gated; no vendor fallback or processing approval was enabled.

## Mandatory acceptance matrix

| Step | Current result |
|---|---|
| Open Demo Matt | Passed automated browser UI |
| Deliberate conversation start | Passed consent/control and no auto-session tests |
| Authorize Demo session | Passed actual local UI/capability/router path with offline provider |
| Create genuine provider room when configured | Software reaches the provider adapter; actual provider BLOCKED |
| Physical microphone input | BLOCKED / not tested physically |
| Speech processing | Adapter and loopback synthetic RTP verified; actual STT BLOCKED |
| Operion reasoning | Shared gateway/context with injected model verified; actual model answer quality not evaluated |
| Demo contract questions | Prepared context/evidence and shared answer delivery verified |
| Selected Globe questions | Actual selection lifecycle and selected prepared ID path verified |
| Generated approved Matt voice | BLOCKED |
| Generated approved Matt video | BLOCKED |
| Same-answer lip synchronization | BLOCKED |
| Follow-up/history | Passed offline transport/service/UI tests |
| Interruption | Passed protocol/UI simulation |
| Disconnect/idle cleanup | Passed local server/provider-double and browser tests; actual remote account teardown BLOCKED |
| Demo/SaaS isolation | Passed bounded browser/server and fixture attacks; not production RLS certification |
| Mobile | Responsive viewport simulation only; physical mobile BLOCKED |

No paid provider room, external speech/model call, identity/voice upload,
external account, agreement acceptance or customer-document processing occurred.
Mock provider counters are not paid sessions.

## What is needed next

Use the updated [external checklist](./MATT_EXTERNAL_ACTIVATION_CHECKLIST.md)
and [physical procedure](./MATT_REAL_VIDEO_VOICE_ACCEPTANCE_REPORT.md), after
separate explicit approval. The older physical report's configuration list is
historical; this report supersedes its obsolete `MATT_DEMO_ENABLED` entry.

Required evidence includes approved likeness/voice rights, actual deployed
provider capabilities, authorized processor/data-flow/retention terms,
account-level spending controls and human-operated Chrome/Edge/supported mobile
tests. No commencement date or confidential pilot readiness is promised.

The old production page will not change until a **separately authorized
publication**. This task explicitly prohibits commit/push/deployment, so the
local correction cannot truthfully be presented as a production fix.
