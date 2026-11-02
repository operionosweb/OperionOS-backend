# Matt active-browser revocation acceptance

Prompt 73196. Date: 2 November 2026.
**PASS for the executed local software sequence. Real provider-backed
revocation remains BLOCKED / NOT EXECUTED.**

## Actual tested path, not canned Matt API replies

Two new tests in
[matt-live-browser.test.mjs](../frontend/tests/matt-live-browser.test.mjs)
run separately for membership and contract-permission loss:

```text
Rendered authenticated React Matt
→ browser fetch through apiRequest
→ Playwright route.fetch to actual loopback HTTP listener
→ actual Express authentication/membership/permission middleware
→ actual Matt router/service
→ actual answer service and source-ID validation
→ browser response/state
→ injected Daily transport
```

Matt API responses are returned by the real HTTP router, not synthesized by a
`route.fulfill` JSON stub. Authentication's token verifier and membership-query
function use controlled fictional data; document context and model/provider
I/O are injected. No deployed Supabase/PostgreSQL/RLS, actual inference,
Tavus/Daily account or real hardware acceptance is implied.

The tests are independent fresh executions of the current code, not copied
prior test counts or a second agent's claim. No extra reviewer agent was used.

## Twelve-step sequence, separately passed for both boundaries

| Step | Evidence/result |
|---|---|
| 1. Establish authorized session | UI consent/connect → actual HTTP 200; server records owner/org-bound ID |
| 2. Ask question | UI prompt → actual interrupt/turn requests |
| 3. Receive answer | Validated own-tenant canary displayed and supplied to the injected Echo transport; report opened by SPA link and retained on return |
| 4. Revoke | Fixture removes membership or changes verified role to one without contract permission; browser's existing role state intentionally remains stale |
| 5. Existing session requests again | Actual UI follow-up first calls interrupt; it can detect denial before the turn POST |
| 6. Server denies | Actual middleware returns 403; generation-call count does not increase |
| 7. Matching session invalidated | Provider-end spy records matching room closure; other owner/organization tests remain in the focused/native HTTP groups |
| 8. Server history inaccessible/cleared | Existing service close clears history; old session cannot be found, new session starts with empty model history |
| 9. Old ID rejected | Actual browser replay returns 404; no old generated answer returned |
| 10. Restore permission | Restore only controlled authorization fixture |
| 11. Old ID still invalid | Old-ID browser replay remains 404 after restoration |
| 12. New authorized session | UI creates different ID, completes answer, model history is empty |

## Stale browser answer/report fix

Previously the hook disconnected media on 401/403 but retained the shared
session-store result/messages. That could leave an earlier answer/report
displayed after a denied request.

The [shared request wrapper](../frontend/src/components/matt/useMattLive.js)
now calls the existing
[clearMattSessions](../frontend/src/components/matt/mattSessions.js) on 401/403
or explicit missing/expired application-session responses. This clears all
retained browser scopes, including messages, results, feedback and pending
controllers; the denial remains an error. The existing teardown stops media.

Tests assert:

- No prior answer or report article remains after detected revocation.
- Own private canary is absent from visible body after denial.
- SPA browser-back navigation to the previously opened report has no retained
  article/canary, without reloading the application to get a false cache-clear
  pass.
- Expired application session produces actual 409; a subsequent UI request
  tears down and removes its retained result.

This is **detected/request-bound revocation**, not continuous remote recall.
Before any new request or refreshed permission state, already delivered
content is not claimed to disappear instantly. Screenshots, copied text,
browser forensic memory and remote provider retention are outside this result.

## Additional acceptance cases

| Case | Result and boundary |
|---|---|
| Two tenant canaries | PASS: own company/contract/amount/clause/supplier/operational markers in native HTTP test, no foreign model input/output; new rendered-UI test also uses distinct lease/amount canaries |
| Organization switch with active session ID | PASS native browser HTTP: other authorized org cannot reuse original ID; new rendered-UI sequence changes persisted organization and navigates to verify fresh B-only output |
| Expired session | PASS deterministic service clock, actual HTTP 409, UI result clearing and deliberate fresh session |
| Replayed revoked/ended IDs | PASS: 404 before generation, including after restored authority |
| Demo ↔ SaaS | PASS native capability/credential/ID cross-use denials; rendered navigation to Demo does not display SaaS canary |
| Report scope after switching | PASS: A's report URL under B does not display A canary |
| Disconnect | PASS: real service end invoked; local synthetic media destroyed; no claim about actual provider-console termination |
| Logs | PASS captured synthetic error logger contains neither tenant marker; no production log certification |

The persisted-organization navigation is explicitly a browser storage selection
plus navigation, not a nonexistent in-page organization-switch control.
Other source-level organization boundary checks remain covered by actual
middleware/native HTTP tests.

## Results and retained failures

Final full serial browser execution: **60 passed, 0 failed, 0 skipped,
0 cancelled**, including both new active UI/server tests.
Focused group: **85 passed, 0 failed, 0 skipped, 0 cancelled**.

Earlier attempts were retained:

- First new UI fixture used `run-one`; actual answer validation correctly
  rejected a non-UUID analysis identifier. Updated fixture uses a valid UUID.
- Second attempt used a broad article selector matching the response and
  nested evidence article; changed to direct response article.
- First complete run: 57/60 pass. New report-return helper assumed the room
  always disconnected; actual SPA navigation retained it. Globe also exposed
  the new Ask Matt name ambiguity. Assertions remain; helpers now await actual
  connection controls and scope the intended button.
- Subsequent focused run retained the report-return state race diagnostic;
  final helper waits for either genuine UI connection state, without sleeps
  or forced clicks.
- Final targeted and complete reruns passed. Full original diagnostics were
  not deleted, hidden or overwritten.

The synthetic Daily fixture now correlates its event conversation ID with the
joined room path, rather than hard-coding one ID for all test rooms. This affects
only the test alias, never production transport.

Actual external speech/video, lip sync, provider room revocation and physical
device acceptance require separately authorized configuration and remain
**BLOCKED**, not passed.
