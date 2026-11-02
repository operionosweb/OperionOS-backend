# Matt browser failure remediation

Date: 2 November 2026. Local-only; no real providers or physical devices.

## Reproduction and classification

Before application edits, ran:

```powershell
node --test --test-concurrency=1 --test-name-pattern='account/guide questions|idle expiration|microphone DENIED' frontend\tests\matt-live-browser.test.mjs
```

**4/4 passed**. Then the two complete suites ran serially: **37/37 passed**
before the new Globe/integration tests were added.

| Originally reported failure | Independent current result | Classification / correction |
|---|---|---|
| SaaS account/guide transport | Passed; scopes sent without an analysis ID | No current product failure reproduced |
| Demo account/guide transport | Passed; Demo credential, not SaaS credential | No current product failure reproduced |
| Idle disconnection | Passed; media destroyed and DELETE recorded | No current product failure reproduced |
| Microphone denied/retry | Passed; denial visible and deliberate retry acquired a fake-device track | No current product failure reproduced |

The original assertion diagnostics were not retained. Consequently their exact
individual root causes cannot honestly be reconstructed. The previous command
started two files concurrently; both build/preview the same frontend output
directory, with different Daily-module aliasing. That is a concrete test
isolation hazard, not proof of the exact cause of each original assertion.

Added [test:matt:browser](../frontend/package.json), which runs those two suites
in **one serial Node runner**. No assertion was removed, weakened or converted
to a skip; no arbitrary delay was introduced; no product rewrite was used to
make unreproduced failures disappear.

## Final run

From the frontend directory:

```powershell
npm.cmd run test:matt:browser
```

**41 passed, 0 failed, 0 skipped** (about 140 seconds). The four additions are:

- Native browser-to-local-server tenant/token/session/Demo attacks, including
  revocation while an answer is pending.
- Actual Globe selection/switch/close/navigation through floating and expanded
  Matt.
- Prepared Globe and operational-status guidance.
- Browser teardown without Echo output after a revoked turn.

The new Globe test initially exposed test-navigation timing and focused
sidebar-overlay interception. It now waits for the expected route and moves
focus/pointer away from the expanding sidebar before accessing the Globe.
No forced click or timeout increase was used. Separately, real source defects
in Globe event shape/clearing were fixed as described in the
[Globe report](./MATT_GLOBE_STATUS_GUIDANCE_REMEDIATION_REPORT.md).

The full browser result above includes the final readiness error metadata and
revocation changes. The final focused backend/protocol group also passes:
**82/82**, including room-creation and speech-negotiation revocation.

## Evidence limits

Chromium used fake-device media, synthetic Daily output and injected STT/model
events. Loopback RTP tests actually transport synthetic audio, not a human's
speech. Mobile viewport checks are not physical mobile acceptance. No result
proves fixed Matt voice, generated likeness, lip synchronization, real
transcription, physical microphone/speakers or production support.
