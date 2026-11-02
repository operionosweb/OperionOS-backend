# Matt independent tenant-isolation security audit

Date: 2 November 2026. **Bounded offline assurance only; production isolation
and complete adversarial acceptance NOT established.**

## 1. Scope, independence and verdict

An independent read-only security reviewer inspected the changed implementation,
ran existing focused tests and constructed a new bidirectional HTTP canary
probe. The parent independently reviewed preservation, prepared platform
knowledge, readiness and physical acceptance requirements. No real customer
documents, deployed database, real model, speech or avatar provider was used.

**No actionable security vulnerability was identified in the reviewed scope.
No critical unauthorized-canary condition was observed in the offline probe.**
That statement is deliberately narrower than "Matt can never access another
tenant." Untested vectors and unsuccessful browser verification below prevent
blanket security acceptance.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| — | — | — | — | No confirmed vulnerability in the reviewed scope; see coverage limitations | — |

No severity is assigned to an untested requirement as if exploitation had been
demonstrated. If any foreign canary later reaches a different tenant's context,
response, cache, history or provider session, classify that condition **CRITICAL**
and immediately hold the affected rollout.

## 2. New adversarial probe, not just existing regression tests

The reviewer used an ephemeral local Express server with the real live
router/service and an **injected** fictional context reader and offline
gateway/provider. This exercises the HTTP/service boundary but does not execute
production Supabase authentication or SQL/RLS.

Two fictional tenants had six distinctive values each:

| Category | ALPINE | BALTIC |
|---|---|---|
| Company | `ALPINE-COMPANY-ORCHID-91` | `BALTIC-COMPANY-CEDAR-92` |
| Contract identifier | `ALPINE-CONTRACT-EMBER-101` | `BALTIC-CONTRACT-ONYX-202` |
| Amount | `USD-731904.27-ALPINE` | `EUR-918273.64-BALTIC` |
| Confidential clause | `CLAUSE-ALPINE-MAINTENANCE-EMBER` | `CLAUSE-BALTIC-CONFIDENTIAL-ONYX` |
| Supplier | `SUPPLIER-ALPINE-QUARTZ-77` | `SUPPLIER-BALTIC-COPPER-88` |
| Operational finding | `OPS-ALPINE-GROUNDED-AOG-419` | `OPS-BALTIC-ENGINE-ALERT-527` |

In each direction the attacker:

1. Asked for the other tenant's analysis and account data.
2. Supplied foreign organization/user/account fields in the request body.
3. Guessed the other tenant's analysis-run ID.
4. Inspected captured generated-model input and response, in-memory gateway
   cache/jobs, captured application logs and avatar `create()` arguments.

Reported observations:

- **Four model calls**, covering analysis and account for each tenant.
- **Two guessed-run requests returned 404**, with no model call.
- No opposite-tenant canary appeared in captured context, responses,
  in-memory cache/jobs, captured logs or avatar-creation arguments.
- `provider.create()` received no account arguments.
- Error response was the safe `ANALYSIS_RUN_NOT_FOUND`; the inspected route
  logs the code rather than the supplied private context.
- Probe summary: `PASS`; 2 tenants, 6 categories, 2 directions, 4 model calls,
  2 guessed-run errors.

This is a reviewer-reported execution result, not evidence from real provider
logs. The exact inline JavaScript and browser handoff were subsequently
preserved in the session
[evidence handoff](../../../.copilot/session-state/b75b7ff7-0ebb-483d-8106-019b47608272/files/matt-isolation-evidence-handoff.txt).
The original PowerShell execution was session 182; no script was installed in
the application. The handoff's first JavaScript fence is the harness submitted
to `node --input-type=module -e $script` from the repository root.

The fixture context reader enforces its own tenant lookup; it is not the
production canonical reader. The injected model returns a refusal when it finds
no foreign source. Cache/job scans consequently contain refusal outputs; no
explicit cross-tenant cache-hit replay was reported. Do not equate this with
independently proving SQL isolation, generated model truth or durable-cache
reuse isolation. The existing regression command below does not reproduce this
new probe.

## 3. Focused existing regression execution

Reviewer command (repository root):

```powershell
node --test test\matt-platform-isolation.test.js test\matt-demo.test.js test\matt-live-routes.test.js test\matt-live.test.js test\matt-realtime-speech.test.js
```

Result: **47 passed, 0 failed** using local fixtures/injected providers.

The attempted browser command was:

```powershell
node --test frontend\tests\matt-live-browser.test.mjs frontend\tests\matt-unified.test.mjs
```

It was terminated after the initial 120-second wait. The reviewer reported one
pass and four failures before termination:

- SaaS account/guide shared transport: failed (about 49.3 seconds).
- Demo account/guide shared transport: failed (about 30.4 seconds).
- Visible idle disconnection: failed (about 1.75 seconds).
- Native click/capture/listening ordering: passed (about 0.62 seconds).
- Microphone-denial retry: failed (about 30.6 seconds).

Assertion diagnostics and remaining output were not captured, so neither the
causes nor a complete suite result are known.
**Incomplete/failed run: not a pass and not security coverage.** Both files
build/preview the same frontend output directory, so an authorized rerun should
use a single serial runner (`--test-concurrency=1`); concurrent output races are
a possible cause, not a diagnosed root cause. Do not repair product code on
that assumption. No additional browser/build run was initiated by the parent.

Historical browser passes in the prior report cannot erase this incomplete
current run. A complete isolated rerun with retained failure diagnostics is a
specific acceptance prerequisite. The reviewer confirmed the HTTP server was
closed in `finally`, completed shells 177/182, and stopped browser shell 187.

## 4. Architecture inspection and limitations

| Invariant | Reviewed evidence | What it establishes / does not establish |
|---|---|---|
| Server-resolved tenant | [live routes](../routes/mattLiveRoutes.js), lines 15–17 and 37–41; auth/permission middleware | Trusted request metadata and fresh membership checks; body/header alone not sufficient. Production token/RLS not exercised |
| Account authority | [account context](../services/mattAccountContext.js), lines 7–27 and 38–63 | Server user/org/permission validation and org-filtered catalog/run queries; no live database query |
| Analysis scope | [run repository](../repositories/phase3/analysisRunRepository.js), lines 8–19; [run routes](../routes/analysisRunRoutes.js), lines 134–160 | Organization-qualified lookup; guessed foreign analysis rejected in probe |
| Error minimization | [live routes](../routes/mattLiveRoutes.js), lines 27–31; [safe error mapper](../utils/safeHttpError.js) | Safe known error mapping/code-only route logging; not all production observability systems |
| Sessions and histories | [live service](../services/mattLiveService.js), `find`, `ask`, `close` | Organization/user ownership, scoped history and lifecycle implementation inspected/tested with fixtures; no durable provider-history proof |
| Cache and jobs | [gateway](../services/ai/aiGateway.js), [Postgres store](../services/ai/postgresIntelligenceStore.js) | Tenant keys inspected; new canaries checked in-memory store only, not production SQL |
| Provider input | [answer service](../services/mattAnswerService.js), output/speech adapters | Captured offline prompt/context and create arguments; no real processor cache/log/retention verification |
| Demo separation | [Demo routes](../routes/mattDemoRoutes.js), [Demo context](../services/mattDemoContext.js) | Fixed namespace, strict request fields, bounded capability and prepared context; no real public endpoint penetration test |
| Browser clearing | [boundary](../frontend/src/components/matt/MattSessionBoundary.jsx), [live hook](../frontend/src/components/matt/useMattLive.js), [Matt](../frontend/src/routes/Matt.jsx) | User/org/permission-sensitive lifecycle inspected; current browser run incomplete |

There was no vector/embedding retrieval path in the inspected Matt
implementation. **Vector-database isolation is not tested, not passed.** Any
future retrieval path needs its own tenant constraints, negative tests and
rollout approval.

## 5. Required attack matrix

Labels: **NEW** = new offline canary probe; **FIXTURE** = existing automated
test; **INSPECTED** = source review, not independent runtime proof;
**NOT TESTED** = no applicable executed evidence.

| Attack surface | Evidence level in this audit | Residual limitation / next required test |
|---|---|---|
| Direct Matt API and modified tenant/user/account body | NEW + INSPECTED | Bidirectional fictional HTTP scope only; production auth not exercised |
| Guessed analysis-run ID | NEW | Both foreign IDs 404 before model |
| Guessed raw contract/document IDs | INSPECTED | No independent raw-document download canary exploit attempt |
| Text search/semantic retrieval | INSPECTED | No separate adversarial search endpoint/vector exercise |
| Vector database/embeddings | NOT TESTED | No Matt vector path found; no certification of other application paths |
| Conversation history/follow-ups | FIXTURE + INSPECTED | No independently persisted multi-process history attack |
| Cached answers | NEW + INSPECTED | In-memory cache canaries; deployed store not queried |
| Background jobs | NEW + INSPECTED | In-memory jobs canaries; durable distributed worker behavior not exercised |
| Reports/evidence/source opening | INSPECTED | No fresh independent exported-report/download canary run |
| Globe/aircraft context | INSPECTED | Prepared context; no real telemetry or full browser attack |
| Floating/main Matt | INSPECTED; browser run incomplete | No complete fresh browser security proof |
| Provider session creation | NEW offline capture + INSPECTED | No account context in captured create args; real provider not contacted |
| Session reconnection/token reuse | FIXTURE + INSPECTED | No new real room hijack/reconnection test |
| Header/token impersonation | FIXTURE + INSPECTED | New body impersonation is not a production bearer-token attack |
| Stale browser state | INSPECTED; browser run incomplete | Retained state/source checks, no complete fresh browser canary |
| Organization switching | FIXTURE + INSPECTED | Active physical/provider session not exercised |
| Permission changes during active session | FIXTURE + INSPECTED | Outstanding request/output and remote room teardown require explicit test |
| Errors and logs | NEW for captured local paths | No production telemetry/provider logs/retention audit |
| Two-direction six-category leakage | NEW | No foreign value observed in captured offline sinks |

No row marked INSPECTED, FIXTURE or NOT TESTED should be promoted to a new
adversarial runtime pass.

## 6. Revocation, cost, privacy and lifecycle assurance

Existing implementation has fresh membership/permission checks at protected
requests, owner-bound sessions, scoped histories, abort/interruption paths,
explicit disconnect and browser idle cleanup. Backend has an absolute room
limit and idle timeout; Demo has process-local authorization/turn/speech/peer
limits. The local tests cover these mechanisms using injected providers.

These are not guarantees of:

- Immediate cancellation of already-issued provider output after permission
  revocation without a new request.
- Provider-side room closure following browser crash/network loss.
- Global/distributed monetary caps, multi-process owner locks or restart-proof
  allocations. In-process quotas reset with process lifetime.
- Secure deployed TLS, certified tenant isolation, security testing of all
  dependencies, data residency, GDPR compliance or processor zero retention.
- Complete deletion of prompts, transcripts, model cache/jobs, error telemetry,
  avatar artifacts and provider-side history.

Before any authorized real run, reproduce revocation with an outstanding
request and active A/V, confirm timeout and disconnect in the provider account,
attempt reconnect while cleanup is uncertain, and reconcile account-side usage.
Provider errors must remain redacted. A UI success state is not remote teardown
evidence. The [real-device report](./MATT_REAL_VIDEO_VOICE_ACCEPTANCE_REPORT.md)
contains the bounded physical procedure and stop conditions.

## 7. Original 19-path inventory coverage

All 19 linked paths in section 15 of the prior platform report exist. Coverage
is explicit rather than a claim that every line was independently verified:

| Path | Current assurance review |
|---|---|
| shared/operionPlatformKnowledge.js | Parent knowledge/status inspection and independent guide probe |
| shared/mattPreparedGuide.js | Parent full function inspection; specific relevance failures recorded |
| services/mattContextScope.js | Independent security reviewer |
| services/mattAccountContext.js | Independent security reviewer |
| test/matt-platform-isolation.test.js | Reviewer inspection and focused test execution |
| routes/mattLiveRoutes.js | Independent security reviewer; new HTTP probe |
| routes/mattDemoRoutes.js | Reviewer security inspection; parent recovery-only diff |
| services/mattLiveService.js | Reviewer security inspection/tests |
| services/mattAnswerService.js | Reviewer security inspection; parent recovery-only diff |
| services/mattDemoContext.js | Reviewer security inspection; parent recovery-only diff |
| frontend/src/routes/Matt.jsx | Reviewer security-relevant portions; parent recovery-only diff |
| frontend/src/components/matt/useMattLive.js | Reviewer security-relevant portions; parent recovery-only diff |
| frontend/src/components/matt/MattSessionBoundary.jsx | Reviewer security-relevant portions |
| frontend/src/components/demo/OperionAssistant.jsx | Reviewer security-relevant portions |
| test/matt-live.test.js | Reviewer tests/inspection |
| test/matt-demo.test.js | Reviewer tests/inspection |
| frontend/tests/matt-live-browser.test.mjs | Reviewer searched/partially executed; parent prerequisites inspected |
| frontend/tests/matt-unified.test.mjs | Reviewer searched/partially executed; parent prerequisites inspected |
| docs/DEMO_MATT_FULL_FEATURE_PARITY_ACCEPTANCE_REPORT.md | Historical reference, not new runtime evidence |

The reviewer additionally inspected auth/permission middleware, analysis
readers, provider adapters, gateway/store and Demo request/adapter components.
This is not a comprehensive whole-application penetration test.

## 8. Acceptance decision

Local regression and the fresh offline attack provide useful positive evidence.
They do **not** close the mandatory matrix. Preserve the current local state;
do not certify production, activate confidential processing or deploy on this
audit alone.

Required before a broader security acceptance:

1. Replay the preserved exact canary harness under an explicitly isolated
   environment and retain complete execution output; expand beyond its injected
   context reader and refusal-only cache contents.
2. Diagnose and rerun browser tests serially in the isolated local environment.
3. Exercise raw contract/document access, report/evidence opening, stale state,
   organization switch and in-flight revocation with independent canaries.
4. Separately approve isolated database/RLS and durable cache/job tests.
5. Separately approve provider/device tests, room termination and privacy/cost
   evidence; do not use confidential inputs.

Overall disposition is incorporated in the
[final summary](./MATT_FINAL_ACCEPTANCE_SUMMARY.md): partial acceptance, not a
security certification.
