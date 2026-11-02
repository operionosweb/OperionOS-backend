# Matt Demo/SaaS final local acceptance

Date: 2 November 2026. Prompt 92641.
**PARTIAL: automated paths pass; native editor acceptance, complete active
browser revocation/report acceptance and genuine media remain incomplete.**

## What changed in this execution

Following the independent LOW security finding, the user explicitly selected
**Fix all issues**. No UI was redesigned. The targeted change is server-side
invalidation after an authenticated membership/permission denial:

- [Router](../routes/mattLiveRoutes.js): separate authentication from checked
  membership/permission; revoke only that authenticated user's matching
  organization scope on a denied request; preserve the denial response and
  explicitly log termination failures.
- [Service](../services/mattLiveService.js): clear retained server conversation,
  abort generation and terminate providers. Deduplicate overlapping close
  attempts. If cleanup fails, closing state and owner lock prevent reuse/new
  paid rooms; a subsequent confirmed cleanup can be retried.
- Three test files add/regress this behavior, strengthen restored-ID rejection,
  and exercise six distinct canary categories through native browser HTTP.

The earlier Globe, prepared-guide, Demo routing and visual changes were
**verified**, not newly implemented or published in this pass.

## Shared architecture and actual surface coverage

| Surface | Implementation evidence | Executed evidence | Remaining limitation |
|---|---|---|---|
| Main Demo Matt | Shared [MattExperience](../frontend/src/routes/Matt.jsx) | Actual Demo UI reaches actual local Demo capability/router/context/gateway chain | Model/avatar output injected |
| Main SaaS Matt | Same experience with organization gate and permission boundary | Real UI live lifecycle with controlled SaaS fixtures; native HTTP tenant checks | Not deployed auth/database or real provider |
| Contract Workspace | [ContractAssistantPanel](../frontend/src/components/intelligence/ContractAssistantPanel.jsx) and Demo workspaces render same experience | Demo main/workspace/floating/report conversation and categories tested | Authenticated SaaS workspace end-to-end canary test not independently executed |
| Globe | Selected prepared flight adapter, shared answer path | Actual rendered map select/switch/close, floating/expand, route clearing and captured fake audio tested | Not live telemetry or customer-flight authority |
| Floating Matt | [MattFloating](../frontend/src/components/demo/OperionAssistant.jsx) | Scope and compact layout at 320/390/1440; main/workspace/report continuity | Trigger portrait is an icon, not live answer media |
| Reports | Same scoped session state, retained result and return path | Demo contract continuity and separately retained prepared-platform report tested | No complete two-tenant real SaaS report/browser-switch canary run |
| Platform-only Admin | [MattPresenceOnly](../frontend/src/routes/Matt.jsx) exposes prepared guide without contract context | Actual HTTP platform admin without membership denied before retrieval | Not a deployed platform-admin/RLS certification |

No separate competing assistant engine was added. Source adapters remain:
selected authorized analysis; fresh bounded authorized account; maintained
platform facts; fictional prepared Demo contract/flight. A page ID or client
organization field does not confer document authority.

Account mode is not full amendment reconciliation: bounded catalog/latest
available OCI analysis, explicit missing coverage and no invented rankings or
cross-currency totals. Demo account agreements reuse declared sample evidence;
they are not independent lease analyses.

## Demo acceptance findings

- The old categorical public-Demo prohibition is absent in local current code.
  Demo and SaaS share provider/answer/media lifecycle.
- Public Demo still requires independent processing, identity/voice and budget
  approvals, exact origins, capability/peer binding and bounded process usage.
- Current safe status: `allowed: true`, `configuration_incomplete`; no provider
  room was created. Configuration failure is not a new Demo prohibition.
- Actual browser tests verified no paid creation when unconfigured, one-use
  capability separation and prepared-flight-only routing.
- Prepared platform answers are explicitly reviewed/non-generated guidance.
  Fictional flight/contract outputs retain their limitations.
- One-time reference introduction is not replayed as a response. After failure,
  video is removed and the explicit unavailable state appears.
- No stock avatar, independent browser TTS or static portrait was introduced as
  a successful answer. Genuine provider operation is still unproven.

## SaaS acceptance findings

- User authentication, active membership and contract-read checks occur before
  protected work; trusted middleware supplies identity.
- Existing post-operation reauthorization withholds pending room credentials,
  speech SDP or generated answers when access changes.
- New-request membership/permission denial now revokes the existing matching
  owner scope. Restoring access cannot revive the old session/history.
- Different users in the same organization and the same user in another
  organization remain unaffected by the new cleanup.
- Failed termination remains explicit and blocks reuse/replacement; no
  success-shaped cleanup fallback was added.
- Native HTTP old-ID/foreign-ID/foreign-run attempts were denied before model
  calls. Fresh account sources and memory-scoped cache/jobs remain isolated in
  the controlled tests.

This is request-bound security, not a continuous revocation subscription.
Without a new request or refreshed frontend permission state, already delivered
answers and an already joined provider room are not proven immediately removed.
An expired token with no verified principal cannot safely be used to identify
another user's room for cleanup. Existing idle/absolute timeouts remain bounds,
not immediate-revocation certification.

## Fresh validation and evidence classes

Final post-fix runs:

1. **85/85** focused backend/frontend protocol/intelligence tests; zero failed,
   cancelled or skipped.
2. **41/41** complete serial browser tests; zero failed, cancelled or skipped;
   119,607.8688 ms.
3. Safe inherited-only validator: expected exit **1 / BLOCKED**, zero network,
   no live session.

The browser suite includes actual component/HTTP operations and also injected
fake speech/model/avatar behavior. Loopback Realtime tests transmitted actual
synthetic audio RTP; no real speech processor or human audibility was tested.
Same-participant A/V subscription is checked; lip synchronization is not.

Initial independent pre-fix runs were also 56 backend, 26 client/protocol and 41
browser passes. They are separate executions, not added to final unique totals.
One intermediate post-fix backend run was stopped after stale test teardown
attempted to close an already revoked session and left its server open. The
fixture was updated to assert old-ID rejection and always close its server;
the original output was retained. No negative assertion was removed.

Full commands and retained evidence names are in the
[readiness summary](./MATT_FINAL_ACCEPTANCE_READINESS_SUMMARY.md).

## Acceptance holds

1. [Native Keep](./MATT_KEEP_FINAL_RESOLUTION_REPORT.md) remains unresolved;
   current disk/originals cannot stand in for unseen competing editor versions.
2. Complete active real UI organization-switch/revocation/report-canary
   acceptance remains unexecuted; no full SaaS production-isolation claim.
3. Provider identity, fixed voice, real STT, real avatar response, physical
   audibility, lip sync, facial movement and interruption are unexecuted.
4. Default captured-track speech intentionally excludes mobile; approved
   Realtime input plus actual Android/iOS testing is required for those rows.
5. Account-side retention, rate limits and monetary caps need operator evidence.

No publication or production check was used to claim that the public website
now serves the local changes. Confidential paid pilot remains **NOT READY**.
