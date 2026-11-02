# Matt Demo live blocker: root cause

Prompt 73196. Investigated 2 November 2026. **Production was inspected read-only,
not changed.**

## Exact observed origin

The shared browser page was
`https://www.operionos.com/demo/matt?contract=demo-aircraft-lease`.
Its DOM still contained:

> Live Matt unavailable  
> Live video is disabled for this public prepared-data demo. No provider session has been created.

The page loaded `https://www.operionos.com/assets/index-CLeyKaoy.js`.
That entry references `https://www.operionos.com/assets/Matt-C3MoaKiR.js`.
A fresh read-only GET of the latter confirmed both the exact message and the
deliberate rejection in the currently served JavaScript:

```javascript
o(r ? "Live video is disabled for this public prepared-data demo. No provider session has been created." : /* SaaS message */)
// In its connect callback:
if (r || !l || !g) { /* reject before any session request */ }
```

In that hook, `r` is the Demo boolean. This is condition **A: intentional Demo
restriction**, not an observed provider outage. The error appears before a
provider health check or room creation. The generic heading "Live Matt
unavailable" alone does not distinguish A from B.

## Why it survived previous remediation

The isolated worktree is detached at
`c043216525424a9bdd60f3ffeb6bfce2599703b9`, with substantial preserved
uncommitted/untracked remediation. `git show HEAD` still contains the original
message and `if (demo || !organizationId || !consent)` in the historical
[live hook](../frontend/src/components/matt/useMattLive.js).

The **current disk version is newer than HEAD and the served artifact**:

```javascript
if ((!demo && !organizationId) || !consent) {
  // reject genuinely unauthorized context
}
```

Its initial Demo message invites approved prepared-data connection instead of
categorically rejecting public Demo. Current runtime source contains neither
the exact obsolete message nor a consulted `MATT_DEMO_ENABLED` switch.
The search found legacy quotations only in documentation/history and regression
tests explicitly verifying that the obsolete flag cannot disable approved Demo.

Therefore the earlier **local remediation did not reach the currently served
production artifact**. The previous reports explicitly recorded no publication.
This is not evidence that the disk patch silently reverted or that merely
renaming a label could fix the backend. A fresh download reproduced the old
code, so a browser-only cache explanation is insufficient.

The exact Vercel deployment/commit mapping was not accessed or changed.
No claim is made about which operator action or deployment selection produced
the old artifact.

## Complete current local path

| Stage | Actual source and behavior |
|---|---|
| Demo UI | Shared [MattExperience](../frontend/src/routes/Matt.jsx) and [MattEnvironment](../frontend/src/components/matt/MattEnvironment.jsx); same live hook/media lifecycle as SaaS |
| Availability | [useMattLive](../frontend/src/components/matt/useMattLive.js) requests `/api/demo/matt/status`; no unconditional Demo prohibition |
| Session authorization | [Demo request adapter](../frontend/src/components/matt/mattDemoRequest.js) obtains `/access`, then `/sessions`; omits SaaS credentials |
| Mounting | [index.js](../index.js) mounts `/api/demo/matt` separately from authenticated `/api/matt` |
| Origin/capability | [Demo router](../routes/mattDemoRoutes.js) checks approved origin, hashed capability, peer, expiry, one-use start and bounded usage |
| Context | Fixed Demo UUID, server-resolved prepared contract/flight aliases; rejects tenant selection/arbitrary documents |
| Configuration | [mattDemoConfiguration](../services/mattDemoConfiguration.js) uses shared live requirements plus explicit public-processing/origin/usage approvals; obsolete Demo-only flag ignored |
| Engine/provider | Demo invokes the same [live router](../routes/mattLiveRoutes.js), [live service](../services/mattLiveService.js), answer validation, Tavus provider and selected speech pipeline |
| Browser return | Authorized application/private-room credentials return through the shared hook to Daily A/V; exact answer goes to Text Echo; interruption, follow-up, expiry and cleanup remain shared |

## Condition B remains honest

The safe validator, freshly executed for this prompt, returned expected exit
1 / **BLOCKED**, Demo `allowed: true`, `configuration_incomplete`, zero network
and no session. Missing field names are recorded in the
[session remediation report](./MATT_DEMO_LIVE_SESSION_REMEDIATION_REPORT.md).

Current local missing-origin errors name `MATT_DEMO_ALLOWED_ORIGINS`; other
configuration errors enumerate missing requirements. These are not obsolete
public-Demo prohibitions and were not bypassed.

## Disposition

- Intentional restriction: absent from current local runtime; still present in
  the inspected served production artifact.
- Source-level shared path: locally enabled when all genuine gates are met.
- Actual remote provider session: **not executed / not established**.
- Production correction: cannot occur in this local-only task. No commit,
  push, merge, deployment, production configuration or cache intervention was
  performed.
