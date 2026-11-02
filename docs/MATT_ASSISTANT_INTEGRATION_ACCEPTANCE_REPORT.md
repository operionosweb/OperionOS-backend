# Matt assistant integration acceptance — 84317

Date: 2 November 2026. **Local software acceptance passed; genuine provider
acceptance remains pending.**

## Shared architecture preserved

All supported entry points still use
[MattExperience](../frontend/src/routes/Matt.jsx), its scoped session store,
the shared live hook and existing OCI response schema. No competing contract
analysis or Demo-only assistant engine was introduced.

SaaS context remains server-authorized by authenticated owner, membership,
permission and organization. Demo uses fixed prepared context and bounded
origin/peer-bound capabilities, not client-selected tenants. Source-ID checks
are not claimed to prove factual entailment or legal accuracy.

## Fresh executions, reported separately

| Execution | Result | Complete retained output |
|---|---|---|
| Serial browser suite: five affected files | 102 PASS; 0 fail/skip/cancel | `84317-final-browser.txt` |
| Backend/frontend protocol and intelligence | 85 PASS; 0 fail/skip/cancel | `84317-focused-protocol.txt` |
| Microphone/audio unit group | 12 PASS; 0 fail/skip/cancel | `84317-audio-permission.txt` |
| Introduction outcome preservation recheck | 11 PASS; repeats browser cases, not extra coverage | `84317-final-introduction.txt` |
| Final Demo/SaaS typography and placement recheck | 8 PASS; repeats browser cases, not extra coverage | `84317-final-visual-recheck.txt` |
| Safe provider readiness validator | Expected exit 1 / BLOCKED; zero network, no room | `84317-readiness.json` |
| Real Tavus/Daily/Realtime session | NOT EXECUTED / not authorized | No genuine provider acceptance claimed |
| Physical iOS/Android/headset acceptance | NOT EXECUTED | Viewport tests are not hardware acceptance |

These are current-task executions, not historical test totals. The 11-case
recheck followed a small guard ensuring live connection cannot overwrite a
persisted skip/disable outcome. The 8-case recheck followed final shared
Demo/SaaS typography/header refinements. No unrelated changes followed.

### Every individual result

The generated [individual-case inventory](file:///C:/Users/meeli/.copilot/session-state/b75b7ff7-0ebb-483d-8106-019b47608272/files/84317-individual-test-results.html)
lists **each test name, separate PASS result, duration and originating run**.
Its machine-readable counterpart is `84317-individual-test-results.json` in
the same session evidence folder. Complete logs remain unabridged.

Final eight visual rechecks, individually:

| Case | Result |
|---|---|
| Authenticated shared layout/synthetic answer, 390x844 | PASS |
| Authenticated shared layout/synthetic answer, 1440x900 | PASS |
| Demo first-entry/ready questions, cards, keyboard, 320x780 | PASS |
| Same, 390x844 | PASS |
| Same, 768x1024 | PASS |
| Same, 1024x768 | PASS |
| Same, 1440x900 | PASS |
| Same, 1920x1080 | PASS |

## Actual local browser/server authorization path

The active rendered SaaS UI tests exercise actual loopback HTTP, actual Express
authentication/membership/permission middleware, router, live service and
answer validation. The tests independently revoke membership and contract
permission after an answer, deny the next request, close the matching session,
clear retained UI answer/report, reject old-ID reuse even after restoration
and create a fresh session with empty history.

Additional native browser HTTP checks exercise two tenant canaries, expired
credentials/sessions, organization switching, provider-ID replay, Demo-to-SaaS
capability separation and pending-turn revocation.

Token verification, database lookup/context, external model and avatar I/O
use controlled fictional fixtures. This is stronger than returning canned
Matt API JSON, but **not deployed identity/RLS/provider verification**.
Continuous server-push revocation and forensic erasure of already delivered
content are not claimed.

## Intelligence and media coverage

- Existing selected OCI analysis, source evidence, follow-ups and interruption.
- Missing evidence, hypothetical flight exposure and unknown amounts remain
  honestly marked; no new extraction or model call starts implicitly.
- Actual Demo UI crosses local capability/router/context/gateway chain with
  external model/avatar outputs injected.
- Same live lifecycle in Demo/SaaS, including platform/account context.
- Captured-track input, permission/device failure/retry, pending-capture
  cancellation and cleanup; no independent TTS masquerading as Matt.
- Synthetic WebRTC microphone RTP to loopback peer tests the selected input
  pipeline, not real transcription accuracy.
- Audio blocked/retry/mute/interruption/track replacement and explicit
  disconnect; no prerecorded fallback after provider failure.
- All introduction states, first entry, explicit disable, persistent per-user
  preference, cross-tab dismissal and failure escape.
- Portrait, current workspace/Globe context and full-report continuity.
- Native infocard computed tokens across contract, obligation, deadline,
  risk, exposure, evidence and selected aircraft views.

## Retained failed attempts

No tests or diagnostics were deleted. Relevant evidence:

- `84317-initial-focused-browser.txt`: stopped after introduction ownership
  revision loop was identified.
- `84317-second-focused-browser.txt`: 17 PASS after ownership correction.
- `84317-full-browser-first.txt`: 96/98; first-entry auto-open changed the
  launcher state and an old assertion assumed footage never ends.
- `84317-targeted-third.txt`: 12/14; exposed the actual consent/portrait overlap
  and first actionable-question placement.
- `84317-targeted-fourth.txt`: 2 PASS for the repaired overlap/placement checks.
- `84317-full-browser-second.txt`: 94/102; seven obsolete page-heading selectors
  and one stronger fixed-navigation visibility criterion failed.
- `84317-targeted-fifth.txt`: 6/8; bounded playback completion and global mobile
  header `display:grid` were diagnosed, not hidden by sleeps/forced clicks.
- `84317-targeted-sixth.txt`: both 320px visibility/hit-test cases PASS.
- Final complete execution and focused rechecks: all cases PASS as above.

Obsolete geometry expectations were replaced with the requested two-column
and in-flow mobile behavior. Response-off tests now explicitly switch text off
because the requested default is readable. One-time footage is allowed to end;
it must never be replayed to satisfy a permanent-video assertion. Independent
real decoding/ended/no-loop tests retain the introduction requirement.

## Reproducible commands

From `frontend`, serially:

```powershell
node --test --test-concurrency=1 tests\matt-introduction.test.mjs tests\matt-live-browser.test.mjs tests\matt-unified.test.mjs tests\matt-browser.test.mjs tests\matt-studio.test.mjs
node --test tests\matt-audio-permission.test.mjs
node --test tests\matt-introduction.test.mjs
node --test --test-concurrency=1 --test-name-pattern='84317 authenticated shared|84317 adjacent' tests\matt-live-browser.test.mjs tests\matt-unified.test.mjs
```

Protocol/intelligence from repository root:

```powershell
node --test test\matt-prepared-guide.test.js test\matt-local-configuration.test.js test\matt-platform-isolation.test.js test\matt-demo.test.js test\matt-live-routes.test.js test\matt-live.test.js test\matt-realtime-speech.test.js frontend\tests\matt-demo-request.test.mjs frontend\tests\matt-live-client.test.mjs frontend\tests\matt-realtime-speech.test.mjs frontend\tests\matt-intelligence.test.mjs frontend\tests\matt-flight-intelligence.test.mjs
node scripts\validate-matt-local.js
```

No dependencies were installed; existing Vite/Chromium tooling was used.
The browser harness builds locally. A legacy test name saying "publishes"
refers to that local build, not a deployment action.
