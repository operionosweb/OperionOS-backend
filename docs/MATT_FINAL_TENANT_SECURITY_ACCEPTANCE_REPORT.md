# Matt final tenant security acceptance

Date: 2 November 2026. Prompt 92641.
**Bounded local acceptance only; not production security certification.**

## Independent finding and authorized resolution

Independent read-only review found one issue. The user then selected **Fix all
issues**, authorizing the narrow local remediation below. The independent
reviewer did not subsequently re-review the implementation; the post-fix
evidence is directly executed regression/browser testing.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | ⚪ LOW | [mattLiveRoutes.js](../routes/mattLiveRoutes.js), [mattLiveService.js](../services/mattLiveService.js) | Original router 15, 31-50, 76; service 31-37, 45-61, 151-176 | **FIXED in tested scope:** new-request authorization denial previously left the room/history reusable after access restoration | 9/10 |

Original synthetic probe: valid organization switch and different-owner attempts
returned 404 before model calls; revoked turn and DELETE returned 403 but zero
provider terminations; restoration allowed the old ID and reused its history.
No cross-tenant disclosure during revocation was demonstrated.

The reviewer's inline probe survives in the tool transcript, not as a separately
persisted executable/output file. It was not reconstructed and relabeled as
original evidence. Its canaries were only Alpha/Boreal answer markers; earlier
six-category report claims were not treated as this probe's fresh coverage.

### Fix and new executable evidence

- [Router](../routes/mattLiveRoutes.js), current lines 16-46: verify
  membership/permission separately after authentication. A 401/403 from those
  checks triggers matching owner/organization invalidation. The organization
  header narrows cleanup only; it is not an access grant. Request-body
  impersonation cannot choose a different cleanup owner.
- [Service](../services/mattLiveService.js), current lines 51-67 and 90-93:
  closing clears history, aborts work, deduplicates concurrent termination, and
  keeps ownership locked if provider cleanup fails. Revocation filters on both
  authenticated user and organization.
- [Route regressions](../test/matt-live-routes.test.js), lines 98-193:
  membership and permission denials, restored old-ID rejection, clean fresh
  history, unaffected foreign user/organization and failed-cleanup logging/lock.
- [Repository/HTTP isolation test](../test/matt-platform-isolation.test.js):
  old ID must remain 404 after membership restoration; teardown no longer
  assumes revoked rooms are still live.
- [Native browser integration](../frontend/tests/matt-live-browser.test.mjs):
  existing real Chromium-fetch-to-loopback test now includes both pending-turn
  and subsequent-request revocation, actual provider-end assertions and six
  individually checked fictional canary categories.

No UI source or the five Keep-conflicted files was changed. A denial is still a
denial even when cleanup fails. The failure is logged and stale session/new-room
reuse is blocked; actual provider termination cannot be claimed after a failure.

## Twelve requested acceptance vectors

| # | Vector | Classification | Actual evidence and limit |
|---|---|---|---|
| 1 | Two organizations/canary contracts | No issue found in tested scope | Native browser HTTP checks distinct company, contract identifier, currency/amount, confidential clause, supplier and operational-finding markers in each model input and returned answer, both ways; repository tests separately exercise actual scoped readers against an injected DB |
| 2 | Organization switching while session active | No issue found in tested HTTP scope; browser acceptance incomplete | Same authenticated user with another valid membership cannot reuse original application ID: 404/no model. Real UI switch with a live external provider was not executed |
| 3 | Active permission/membership revocation | Confirmed vulnerability fixed in tested scope; idle/display case not fully tested | Pending turn/creation/SDP withheld and original room ended; new-request denial revokes matching scope; other owner/org unaffected; no continuous permission subscription or remote physical revocation test |
| 4 | Expired/revoked IDs | No issue found in tested scope | Expired token denied before model; expired session/service tests; restored access still cannot reuse revoked app ID; fresh session history empty. No actual provider-token replay against provider |
| 5 | Foreign contract/analysis/document/evidence | No issue found in tested scope | Guessed foreign identifiers and text searches rejected/empty before model; authenticated middleware wins over body identities. DB implementation injected, not deployed PostgreSQL/RLS |
| 6 | Foreign vectors | Not tested | No vector/RPC retrieval path in inspected Matt; negative RPC sentinel detects accidental use. Absence of path is not a vector-database isolation pass |
| 7 | Cache/conversation reuse | No issue found in memory-scoped tests; durable cache not tested | Existing gateway test proves tenant-separated identical-input caches/jobs, own cache hit, fresh catalog, permission-before-cache and separate users; revoked session no longer revives. Deployed/shared durable cache replay not tested |
| 8 | Provider context/session leakage | No issue found in injected protocol scope; real provider blocked | Foreign application/provider IDs denied; provider create gets no tenant source context; exact scoped answer Echo and wrong/stale event rejection tested. Real provider payload/retention not observed |
| 9 | Globe aircraft/contract scope | No issue found in prepared scope | Actual rendered selection/switch/close/expand/navigation, flight ID matching and no lease fallback; prepared facts are not customer flight/telemetry evidence |
| 10 | Demo ↔ SaaS | No issue found in tested scope | Separate namespace/capability, no SaaS auth/header on Demo, Demo token not SaaS identity, foreign IDs denied; prepared Demo model inputs contain none of either tenant's six markers |
| 11 | Logs/generated reports | No issue found in captured synthetic logs; SaaS report/deployed logs not tested | Fresh native HTTP logger capture contains none of 12 individual markers. Prepared report scope and foreign gateway jobs tested separately. No production log search or full SaaS browser report canary test |
| 12 | Platform Admin without membership | No issue found in tested HTTP scope | Actual membership middleware with platform-admin principal rejects before provider/source read; UI platform-only presence has prepared guide. Real deployed admin/JWT/RLS not certified |

Do not collapse mixed classifications into twelve unconditional passes.

## Final post-fix tests

The combined command in the [readiness summary](./MATT_FINAL_ACCEPTANCE_READINESS_SUMMARY.md)
passed **85/85**, including **59 backend** and **26 frontend protocol/intelligence**
tests. Complete serial browser group passed **41/41**. All final groups had zero
failures, cancellations and skips. These are fresh results, not copied from the
previous remediation reports.

An intermediate backend attempt was stopped due to now-stale fixture teardown:
the test tried to explicitly close a room already removed by the new revocation
behavior, then did not reach server close. Retained partial output is not counted
as a passing run. The updated fixture strengthens restored-ID rejection and
closes its server in `finally`; final rerun completed.

## Risks/holds, not newly proven disclosures

- Already delivered text cannot be recalled from a person, screenshot or browser
  memory. The UI's existing report/history after idle revocation is not fully
  accepted by these tests. No continuous real-time revocation mechanism was added.
- Request-end checks and the new denial cleanup are not full deployed room/token
  revocation or provider-side erasure certification.
- A failed provider close can leave remote usage uncertain. Locked local owner
  state and explicit logs prevent silently spawning replacements, but require an
  operator to confirm remote termination before further tests.
- Process-local quotas/locks/cache tests do not establish distributed production
  budget/security controls.
- Real database policies, vector stores, production logs, provider data residency,
  retention, deployed tenant isolation and physical devices were out of scope.

No critical foreign-canary disclosure was observed. If one occurs in future
approved testing, stop the affected flow immediately and treat it as critical;
do not continue by substituting media or weakening assertions.

**Disposition:** the reported LOW finding is locally remediated and regression
verified. Broader security acceptance remains incomplete. No confidential pilot,
provider activation or publication is authorized by this report.
