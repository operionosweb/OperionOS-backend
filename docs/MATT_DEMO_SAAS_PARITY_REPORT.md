# Matt Demo/SaaS parity and platform-intelligence assurance

Date: 2 November 2026. **Local parity is supported by code and simulation;
genuine video/voice parity is not accepted.**

No application, configuration, identity, provider account or environment was
changed for this audit. Prepared answers and synthetic media are not genuine
model/video responses. Refer to the independent
[tenant audit](./MATT_TENANT_ISOLATION_SECURITY_AUDIT.md) before treating shared
orchestration as security assurance.

## 1. Meaning of parity

Demo and SaaS intentionally share the Matt experience, live hook, speech
adapters, answer service, answer validation, Text Echo/Daily output,
interruption and cleanup. Context and authorization differ deliberately:

| Surface | Demo | SaaS |
|---|---|---|
| Context authority | Server-prepared fictional fixtures | Authenticated active tenant membership and authorized context |
| Namespace | Fixed Demo UUID | Server-validated organization; client choice is not authority |
| Session credential | Bounded hashed capability, exact origin/socket peer | Authenticated user plus fresh organization authorization |
| Analysis | Prepared selected agreement | Selected canonical OCI analysis |
| Account | Prepared catalog and explicitly bounded coverage | Fresh tenant-filtered contract catalog/latest available runs |
| Platform | Reviewed platform knowledge, Demo navigation | Same maintained knowledge, application navigation |
| Globe | Selected prepared flight and associated evidence | No assumption of available real flight telemetry |
| Disconnected platform help | Clearly labelled prepared guide | Clearly labelled prepared guide |
| Disconnected account answer | Visible connection requirement | Visible connection requirement |
| Generated voice/video | Requires explicit Demo provider approval | Requires authorized tenant/provider approval |
| Browser history/reports | Separate Demo identity/scope lifecycle | User/organization/permission-sensitive lifecycle |

Different authentication/context is required, not a parity defect. A shared
code path does not prove equal response quality, actual tenant isolation,
mobile compatibility or provider operation.

Historical implementation documents and test fixtures use "live" in names.
That word is not an acceptance result.

## 2. Current safe regression execution

Executed together without application startup, new build, provider activation
or real customer data:

```powershell
node --test frontend\tests\matt-demo-request.test.mjs frontend\tests\matt-live-client.test.mjs frontend\tests\matt-realtime-speech.test.mjs frontend\tests\matt-intelligence.test.mjs frontend\tests\matt-flight-intelligence.test.mjs
```

Result: **26/26 passed**.

Covered by injected/fake transports:

- Demo namespace/capability separation and rejection of SaaS credentials;
  configuration/token failure without silent fallback.
- Exact orchestration answer sent through the output protocol and a single
  same-participant A/V subscription.
- Forged/malformed/wrong-conversation/stale event rejection.
- Output packet limit and subscription/playability state.
- Interruption acknowledgement, reconnect and retained speech deadline.
- Existing captured audio track passed to the input adapter.
- Outbound-packet requirement before the simulated listening state.
- Final-transcript association, stale transcription rejection and unsupported
  autonomous input response rejection.
- Input cleanup during negotiation, disconnection and failed interruption.
- Prepared findings, evidence-linked follow-ups, flight obligations,
  conditional legal guidance and unknown exposure behavior.

These are deterministic tests. In particular, output media/transcripts are
injected. Passing them does not establish real STT, generated voice,
lip synchronization or actual browser audio.

The four offline configuration tests also passed in this assurance pass.
The [prior platform report](./MATT_PLATFORM_WIDE_INTELLIGENCE_AND_SECURITY_ACCEPTANCE_REPORT.md)
records 126 backend/unit tests, 51 Chromium browser tests, six installed Edge
tests and six installed Chrome tests. Those are historical results from the
preceding implementation pass, not independently rerun physical/provider tests
or new tests in this report.

## 3. Independent prepared platform-guide probe

Executed a direct pure-JavaScript probe of the maintained knowledge reader and
prepared-guide function with 12 questions. No model or provider was invoked;
no confidential account data was supplied.

An expected-section assertion was defined per question, then compared against
returned source IDs. All 12 answers had the explicit prepared-guide label and
citations belonging to the selected reviewed entries. This establishes
provenance only, not factual entailment or good retrieval.

| Question | Expected reviewed section | Outcome |
|---|---|---|
| What does Operion do? | purpose | Matched |
| How do I upload a contract? | ingestion | Matched |
| How do I analyse a contract? | ingestion | Matched |
| How are clauses extracted? | findings | Matched |
| How are obligations and deadlines identified? | findings | Matched |
| How are risks and exposure calculated? | exposure | Matched |
| How do I access evidence? | reports | Expected section missed; findings text still instructs opening source evidence |
| How are reports generated? | reports | Matched |
| How does the Globe work? | aviation | Failed relevance: purpose/ingestion/findings instead |
| Which features are operational? | matt/status summary | Incomplete: only Demo aviation guidance |
| Which features are awaiting configuration? | matt | Matched |
| Which features are future roadmap items? | roadmap | Matched |

Result: **9/12 strict expected-section matches; 12/12 selected-source provenance
checks**. This is a small explicit adversarial check, not a measured general
accuracy rate.

The Globe query and operational-status summary need a targeted relevance fix
and regression tests before claiming broad disconnected platform help. The
evidence query is a partial-relevance miss, not proof that the answer was
false. No source fix was made during this read-only assurance exercise.

Reproduction (repository root, no dotenv or external services):

```powershell
@'
import assert from 'node:assert/strict';
import { readOperionPlatformKnowledge } from './shared/operionPlatformKnowledge.js';
import { preparedPlatformGuide } from './shared/mattPreparedGuide.js';
const cases = [
  ['What does Operion do?', 'purpose'],
  ['How do I upload a contract?', 'ingestion'],
  ['How do I analyse a contract?', 'ingestion'],
  ['How are clauses extracted?', 'findings'],
  ['How are obligations and deadlines identified?', 'findings'],
  ['How are risks and exposure calculated?', 'exposure'],
  ['How do I access evidence?', 'reports'],
  ['How are reports generated?', 'reports'],
  ['How does the Globe work?', 'aviation'],
  ['Which features are operational?', 'matt'],
  ['Which features are awaiting configuration?', 'matt'],
  ['Which features are future roadmap items?', 'roadmap'],
];
let matched = 0;
for (const [question, section] of cases) {
  const result = preparedPlatformGuide(question);
  const expected = `platform:${section}`;
  const citations = result.evidence.map(item => item.id);
  const known = new Set(readOperionPlatformKnowledge().evidence.map(item => item.id));
  assert.equal(result.source, 'prepared_platform_guide');
  assert.match(result.answer, /Prepared platform guide/);
  assert.ok(citations.every(id => known.has(id)));
  const hit = citations.includes(expected);
  matched += Number(hit);
  console.log(JSON.stringify({ question, expected, hit, citations }));
}
console.log(`Expected-section matches: ${matched}/${cases.length}`);
'@ | node --input-type=module -
```

Both navigation prefixes (`/demo`, `/app`) were also checked and the maintained
knowledge includes `implemented`, `configuration_required`, `demo_only` and
`future_roadmap` statuses. Their presence does not mean every question retrieves
the right entry, nor that claimed implemented features were physically tested.

## 4. Account-intelligence scope and oracle requirements

The preceding implementation and its fixture tests establish an intended
tenant-filtered catalog/latest-run context. They do not prove a live model will
interpret it correctly. "Latest available analysis" is not complete amendment
reconciliation or a warranty that every lease has an analysis.

The following are mandatory truth checks for separately approved model
evaluation, not invented generated answers:

| Question | Source of truth / expected limitation | Current evidence |
|---|---|---|
| What aircraft/assets/contracts does this account contain? | Tenant catalog and explicit analysis coverage; don't equate contract count to asset count | Fixture/context tests; real answer not evaluated |
| Which leases/redeliveries are coming up? | Canonical deadlines with documented reference date and conditions; unknown when absent | Fixture/context tests; no current-date inference accepted |
| What reserves/reimbursements are exposed? | Exact contractual amounts, currency, conditions and financial-impact lineage; no guessed total | Prepared/fixture checks; live entailment untested |
| What notices/actions are required? | Canonical obligations/deadlines/evidence and approval status | Fixture checks; real answer not evaluated |
| Which suppliers/relationships are involved? | Canonical aviation relationship sources, not invented supplier history | Fixture checks; no general ERP/telemetry access implied |
| Why is this risk important and where is the clause? | Canonical risk/evidence identifiers and actual supporting span | ID membership validated; factual entailment still requires review |

Every evaluation must record included/excluded tenant IDs, source records,
expected facts/refusals, model/version and actual output. A plausible answer or
valid citation identifier alone is not a pass. Larger catalogs/runs/context
limits must return explicit limits rather than silently presenting partial
coverage as complete.

Security-specific fresh probes and canary results belong to the separate
[tenant audit](./MATT_TENANT_ISOLATION_SECURITY_AUDIT.md); no security pass is
inferred from the deterministic examples above.

## 5. Environment and UI parity acceptance still required

For main Matt, expanded/floating Matt, contract context and prepared Globe:

1. Repeat the same approved synthetic question and follow-up through each
   applicable entry point; compare selected scope/source IDs and answer text
   sent to Echo.
2. Verify Demo never accepts tenant credentials, arbitrary tenant IDs,
   arbitrary selected contracts or application account context.
3. Verify SaaS never selects prepared Demo context as a hidden fallback.
4. Verify scope/account/role/membership changes clear local private history,
   report objects and pending output, including an outstanding request.
5. Test actual disconnect, timeout, interruption, reconnect and provider-side
   termination in each environment; simulation is not room-account evidence.
6. Confirm one current approved Matt identity and voice without replaying the
   introduction as an answer. Unknown transport support must fail explicitly.

Do not run these against real providers under this task. Use the
[physical procedure](./MATT_REAL_VIDEO_VOICE_ACCEPTANCE_REPORT.md) after separate
authorization and resolution of security findings.

**Conclusion:** shared-engine and prepared protocol parity have bounded local
evidence. The independent guide probe found specific functional gaps. Real
generated video/voice parity, actual model quality and all unexecuted security
paths remain unaccepted.
