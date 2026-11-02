# Matt remediation final summary

Date: 2 November 2026.

**PARTIALLY ACCEPTED — DEMO ENABLED, PROVIDER ACTIVATION PENDING**

This verdict refers to the isolated local software path, not the current
production page or a physically accepted genuine Matt conversation.

## Required direct answers

| Question | Evidence-based answer |
|---|---|
| Why was Demo Matt disabled? | Historical frontend explicitly rejected `demo` before session creation. The shared production page still displays that old text. Earlier unpublished local work removed that branch and added a Demo route |
| Exact condition preventing creation? | Historical `if (demo || !organizationId || !consent)`; current local environment instead fails explicit provider/processing/budget/origin readiness gates |
| Has Demo-only restriction been removed? | Yes locally; historical branch was already removed, and this pass removes the redundant `MATT_DEMO_ENABLED` switch |
| Can Demo request a genuine live provider session? | Yes through the real shared provider adapter once explicit gates are satisfied; verified only using an offline provider |
| Is provider configuration complete? | No in the safe inherited-environment check; deployed account/configuration not inspected |
| Genuine live session tested? | No; approval boundary forbids it |
| Physical microphone and speakers tested? | No; only fake-device/loopback synthetic audio |
| Generated video/lip synchronization tested? | No; synthetic media cannot establish this |
| Does Demo use prepared data only? | Server resolver and bounded offline integration enforce fixed fictional sources; no customer fallback |
| SaaS/Demo boundaries verified? | Yes for the tested local HTTP/browser/fixture attacks; not deployed database, provider or all production surfaces |

## Changes and evidence

- Four original failures: **4/4 passed serially before source edits**. Their
  original missing diagnostics prevent exact retrospective root-cause claims.
  Added a durable serial browser test command to prevent shared-build races.
- Guide selection corrected; operational-status overview includes all reviewed
  capabilities and limitations, with explicit non-generated labeling.
- Globe producer/consumer event shapes aligned; explicit aircraft close now
  deselects and clears context. Selection/switch/close/navigation/floating/
  expanded flows verified in an actual local browser.
- Shared routes revalidate credentials, membership and permissions before
  returning generated answers/new room credentials/SDP. Revoked in-flight
  results are withheld and their original room terminated in the offline test.
- Native browser requests cover foreign/reused application/provider IDs,
  expired fictional tokens, valid membership switching, Demo/SaaS token
  separation, context freshness and reconnect. No foreign canary observed.
- Demo readiness distinguishes allowed-but-incomplete configuration from
  security denial, provider failure and usage exhaustion. Approvals were not
  bypassed or automatically enabled.

Final focused unit/protocol/intelligence tests: **82 passed, 0 failed**.
Final complete serial browser group: **41 passed, 0 failed, 0 skipped**.
Relevant editor diagnostics: no errors reported. Safe validator: **BLOCKED**,
expected exit 1, zero external requests and no session.

The final unit group includes two additional room/speech revocation tests.

Reproduction from repository root (existing installed dependencies):

```powershell
node --test test\matt-prepared-guide.test.js test\matt-local-configuration.test.js test\matt-platform-isolation.test.js test\matt-demo.test.js test\matt-live-routes.test.js test\matt-live.test.js test\matt-realtime-speech.test.js frontend\tests\matt-demo-request.test.mjs frontend\tests\matt-live-client.test.mjs frontend\tests\matt-realtime-speech.test.mjs frontend\tests\matt-intelligence.test.mjs frontend\tests\matt-flight-intelligence.test.mjs
npm.cmd --prefix frontend run test:matt:browser
node scripts\validate-matt-local.js
```

The last command intentionally exits 1 while approvals/configuration remain
incomplete; it does not activate anything.

## What remains unresolved

1. Provider/identity/fixed voice/privacy/budget approval and actual external
   activation. No credentials were exposed or changed.
2. Genuine STT, generated Matt A/V, same-answer lip sync, physical Chrome/Edge/
   mobile behavior and actual provider-account cleanup.
3. Native Keep conflict: expected/unsaved editor versions unavailable. All five
   originals remain intact; no forced editor action was used.
4. Production remains unchanged under the no-publication instruction.
5. Continuous idle-client revocation notification, deployed RLS, durable/
   distributed caches/jobs/quotas and provider retention remain outside the
   verified local scope. Native-header switch tests are not a full
   organization-picker UI acceptance.

The confidential paid pilot remains **NOT READY**. No measured accuracy, ROI,
security certification, production TLS guarantee, complete OCR/translation/
amendment reconciliation or persistent emotional Matt capability is claimed.

## Preservation

All 56 pre-remediation dirty paths remain present, including all 51 original
application/support files and five assurance reports. A new session-only
starting fingerprint manifest records this pass. Intentional edits integrate
existing work; untouched starting files must retain their exact hashes.

All **41 protected hashes** and **five original recovery-copy hashes** are
preserved. Detached HEAD remains
`c043216525424a9bdd60f3ffeb6bfce2599703b9`; index remains empty.
No reset/clean/stash/discard/forced acceptance/checkpoint, branch switch,
commit/push/merge/deployment or production-data change occurred.

Final comparison: **56/56** starting paths retained, **42/56** byte-identical.
The other 14 are the explicit remediation edits, not discarded files. Three
previously clean tracked paths were necessarily changed: the serial test
script and the two Globe selection/event producers. Added six requested reports
and one focused guide test. Prior five assurance reports remain byte-identical.

## Reports

- [Browser failure remediation](./MATT_BROWSER_FAILURE_REMEDIATION_REPORT.md)
- [Globe/status remediation](./MATT_GLOBE_STATUS_GUIDANCE_REMEDIATION_REPORT.md)
- [Tenant integration remediation](./MATT_TENANT_INTEGRATION_REMEDIATION_REPORT.md)
- [Keep conflict status](./MATT_KEEP_CONFLICT_REMEDIATION_REPORT.md)
- [Demo live acceptance/readiness](./MATT_DEMO_LIVE_MATT_ACCEPTANCE_REPORT.md)

**Bottom line:** Demo is no longer artificially barred from the shared live
assistant software path. It is not yet a physically verified genuine
video-and-voice Matt, and the unchanged production page must not be described
as fixed by unpublished local work.
