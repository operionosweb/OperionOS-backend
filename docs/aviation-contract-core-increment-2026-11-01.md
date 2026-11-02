# Bounded aviation Contract Intelligence increment — 2026-11-01

The [2 November Matt/OCI/Globe update](matt-oci-globe-development-2026-11-02.md)
adds shared calendar validation, safer deadline anchors and explicit assistant
evidence relationships. Its local test results do not establish corpus accuracy
or confidential-pilot readiness.

Scope: the preview worktree supplied at baseline `d32ab904`. This is a local code increment, not a deployment, production validation or release approval. No commit, push, migration, auth/config change, external document upload, AI purchase/query or market-data request was made by this core task. Parent-owned navigation, OCI, Globe and hosting changes are outside this report.

## Prior art and exact increment

The existing deterministic pipeline already loads scoped extracted source, runs clause/obligation/deadline/risk stages, persists a contract profile and indexes clause text. It is not replaced: `services/phase3/analysis/contractIntelligencePipeline.js:113-170`. Provider normalization and AI fallbacks remain disabled in that pipeline. Existing profile/assistant/role/exposure consumers remain in use.

Changed or added files:

| File | Change |
| --- | --- |
| `domain/contractIntelligence/aviationContractCore.js` | New dependency-free shared pure core, version `aviation-core-v1`: multi-label aviation review taxonomy, original citations, owner/action/rationale recommendations, strict fuel mechanism parser and typed single-variable scenario evaluator. |
| `services/phase3/intelligence/contractProfileService.js` | Builds the additive core from actual clause sources; persists it via existing `metadata.aviationCore`; appends review suggestions to existing recommendations. Carries source offsets and preserves unknown locations as null instead of inventing a locator. Existing contract-type and lease-only rules are unchanged. |
| `frontend/src/components/intelligence/AviationContractCoreSection.jsx` | New actual-result component showing topic coverage, clause/page links, original evidence, unresolved pricing conditions and explicitly labelled local fuel scenarios. |
| `frontend/src/routes/ContractWorkspace.jsx` | Imports and displays the component using the fetched persisted profile. Keyed by analysis run so switching runs resets local inputs/results. |
| `test/aviation-contract-core.test.js` | Pure/parser/profile/persistence/pipeline tests using synthetic sources and injected offline repository/stage doubles. |
| `test/contract-profile-service.test.js` | Existing generic-property guard now checks recommendation interpretations rather than the entire serialized raw citation. Original source can say “aircraft” without the recommendation asserting an aircraft lease. All classification/lease-owner checks remain. |
| `test/document-ingestion.test.js` | Follow-up adds actual local extraction of the pre-existing synthetic `test/fixtures/step9-aircraft-lease.docx`, complete ordered clause-text assertions, unknown page count, repeated parse equality and malformed DOCX parser rejection. No new fixture/generator/dependency. |
| `frontend/tests/aviation-contract-core.test.mjs` | Actual JSX SSR loading/rendering without listening, building dist or contacting an API; checks supported, missing and unsupported UI plus workspace wiring. Kept under frontend tests so backend-only installations do not acquire a React/Vite dependency. |
| `frontend/tests/aviation-contract-core-browser.test.mjs` | Requested offline Playwright test of the real `/app/contracts/contract-fuel` workspace; synthetic authenticated profile/read endpoints, local form interaction, citations, invalid input, unverified user input, unsupported/missing mechanisms, desktop/mobile overflow and zero mutation requests. Executed after parent permitted the dedicated-dist run: 4/4 pass. |
| This report | Requested exact changes, bounds, gaps, evidence and executed results. |

The taxonomy covers payment, termination, renewal, liability, indemnity, insurance, maintenance, delivery/redelivery, reserves, SLA, performance, compensation, force majeure, governing law, disputes, plus pricing adjustment. These are **secondary review topics**, not new database clause-category enums, admissions of liability, breach findings or extracted obligations. Adding a topic requires a rule/owner/action entry and tests, not a migration. Coverage retains identified clause counts and at most three full original citations per topic. An absence of a mention is `not_established`, never a claim that the agreement lacks the term. Recommendations are explicitly `basis: interpretation`, with rationale, suggested owner, priority and source evidence; no deadline is invented.

## Fuel-price foundation — accepted meaning and restrictions

Exactly one external variable is supported: `fuel_price`. There is **no approved/live/verified market input** and no automated feed connection. Contractual base facts are parsed from original text; a current fuel price is explicitly hypothetical or user-supplied/unverified. Both produce a **scenario**, not an extracted fact, prediction, invoice, confirmed liability or guaranteed savings.

For a supported mechanism, the original same-clause text must explicitly supply all five recognised lines, for example:

```text
1 FUEL SURCHARGE
Base fuel surcharge: USD 1000 per flight
Baseline fuel price: USD 0.80 per litre
Fuel price reference: Example Jet A-1 Index
Adjustment frequency: monthly
Adjusted fuel surcharge = Base fuel surcharge * (Current fuel price / Baseline fuel price).
```

This is a synthetic **grammar example**, not contract or market data. No existing document is rewritten into this syntax. All body text must be understood. Only a narrowly recognised structural heading may be omitted; conditions in headings are not stripped. Recognised formula spelling is the explicit ratio above, optionally prefixed `Formula:`, with `*` or `×`. No other formula is silently treated as this ratio.

- Base surcharge: finite positive USD/EUR/GBP decimal amount, **per flight only**, up to two decimals. Baseline: finite positive price, up to six decimals, same currency, per litre/liter, gallon or kg. No thousands separator, barrel conversion or FX inference.
- Contractual reference and frequency are mandatory. Frequency is monthly, quarterly, annually or per flight; **no applicable adjustment/invoice date is established**.
- Missing/duplicate/conflicting definitions, non-ratio formulas, caps, floors, thresholds, exceptions, notice/discretion, cross-references and other unrecognised text return `requires_review`. Multiple fuel-related clauses collapse to one non-computable review finding, preserving candidate count and up to three citations; cross-clause applicability is not guessed.
- JSDoc `FuelPriceInput` explicitly requires kind, provenance (`hypothetical`/`user_supplied`), finite positive numeric value, matching currency/unit/reference, valid observation/scenario date and a non-empty assumption/source label. A string number, invalid date, changed reference/unit/currency or unlabelled origin cannot produce an amount.
- Amount = contractual base surcharge × (input fuel price / contractual baseline price); delta = amount − base. No probability, utilisation, time aggregation, Monte Carlo, digital twin or full simulation. Dates, evidence IDs, pages and offsets unavailable from ingestion remain null.
- Inputs/results stay in component memory, are cleared when edited or switched to another analysis run, and are not written to the contract profile, DB, audit log or browser storage. Provenance is user-declared, not independently checked. Output is mathematical sensitivity only; legal applicability elsewhere in the contract is not resolved.

Citation contract: each finding preserves source clause identity/number, original complete clause text, evidence identity, original page/locator and available offsets (`domain/contractIntelligence/aviationContractCore.js`, `citation`). The workspace exposes the original evidence and links to its existing clause card. The parser does not generate replacement clause text or invent page numbers.

**Confidence:** topic mentions and syntactic formula support are deterministic matches, not statistically calibrated confidence. `supported` means the narrow grammar parsed, not an approved contractual interpretation. No accuracy percentage, extraction recall, verified index value or legal certainty is claimed.

## Executed validation

From the repository root, final combined safe command:

```powershell
node --test --test-reporter=spec test\aviation-contract-core.test.js frontend\tests\aviation-contract-core.test.mjs test\phase3b-deterministic-clause.test.js test\contract-profile-service.test.js test\contract-intelligence-pipeline.test.js test\deadline-intelligence-parser.test.js test\aviation-contract-intelligence-acceptance.test.js test\contract-assistant-service.test.js test\financial-impact-service.test.js test\role-intelligence-service.test.js
```

Result: **164 tests, 164 passed, 0 failed/skipped/cancelled**, exit 0, final runner duration approximately 11.5 seconds. This includes 32 new core tests and two new frontend SSR/wiring tests. Repository/pipeline persistence was verified with injected offline doubles; no real DB calls were made. Existing synthetic aviation fixtures/parser regressions also ran, but synthetic acceptance is **not real-document extraction recall**.

The new core cases include 19 separately named unsupported-clause variants, grouped separate-clause conflicts, bounded citation/count behaviour, invalid provenance/type/date/unit/reference cases, numeric overflow, preserved unknowns, correct explicit ratio/delta and persisted original citations. These are finite safety examples, not proof of exhaustive legal-condition handling.

An earlier combined run found two existing property tests matching “aircraft” inside newly retained original evidence. The test assertion was corrected to inspect interpretation fields without removing evidence or weakening the aircraft-classification/lease-owner guards. Final combined tests above pass.

Browser fixture syntax check executed:

```powershell
node --check frontend\tests\aviation-contract-core-browser.test.mjs
```

Exit 0. Browser execution was initially deliberately deferred while other browser suites/builds were running, then executed after parent permission. Command from repository root:

```powershell
node --test frontend\tests\aviation-contract-core-browser.test.mjs
```

It self-builds/self-hosts only local assets into `frontend\.aviation-core-browser-dist`, launches headless Chromium, intercepts auth/API endpoints with synthetic data, blocks external origins, and removes its dedicated output afterward. Nested `finally` cleanup also removes that dedicated directory on test/setup or browser/server-close failure. Directory absence was explicitly checked after the run. It does not reuse or overwrite parent's `frontend\dist` and requires existing frontend dependencies/Chromium. No new dependency was added or installed by this task.

### Interactive validation follow-up

Parent's initial browser run had **0/4 passing**: two supported-flow tests found rendered `innerText` flattening the original multiline citation; two unsupported/missing tests encountered the existing safe GET `obligations/estimate` omitted from the fixture. The scoped evidence wrapper now inherits `white-space: pre-wrap` and the tests assert **both exact raw `textContent` and rendered `innerText` equal the original clause**, plus computed whitespace style. No substantive source text is normalised away. The existing estimate route is explicitly mocked with `success`, run identity, `estimatedIntelligence: null` and `budget: null` (unavailable, not fabricated zero cost or available budget). Zero-mutation, unexpected-request, source/page navigation and viewport-overflow checks remain intact.

Executed browser output after fixes:

```text
✔ actual ContractWorkspace fuel flow at 1440px stays local, explicit and evidence-linked
✔ actual ContractWorkspace fuel flow at 390px stays local, explicit and evidence-linked
✔ actual ContractWorkspace exposes no calculation for unsupported pricing evidence
✔ actual ContractWorkspace exposes no calculation for missing pricing evidence
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 92030.3096
```

Scoped core/SSR re-run after evidence-rendering fixes, with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` blank in the process (no configuration files changed):

```powershell
$env:SUPABASE_URL=''; $env:SUPABASE_SERVICE_ROLE_KEY=''; $env:DATABASE_URL=''
node --test --test-reporter=spec test\aviation-contract-core.test.js frontend\tests\aviation-contract-core.test.mjs
```

Result: **34/34 pass** (32 core + two SSR/wiring), zero failures/skips/cancelled, exit 0, approximately 6.2 seconds. These overlap the original 164, not 34 additional unique tests.

### Local ingestion/structure validation follow-up

Both requested existing test files were inspected in full first. They call local validators, local `pdf-parse` on the existing repository `test.pdf`, a stub page-text renderer, pure source-key construction and pure document-structure/page-row helpers. They do **not** invoke `ingestContractUpload`, Supabase storage, DB persistence or audit writes. Credentials were explicitly blanked in the child shell; files/config were not changed:

```powershell
$env:SUPABASE_URL=''; $env:SUPABASE_SERVICE_ROLE_KEY=''; $env:DATABASE_URL=''
node --test --test-reporter=spec test\document-ingestion.test.js test\document-structure.test.js
```

Complete named test results:

```text
✔ PDF signature and metadata validation are server-controlled
✔ DOCX extension, MIME, ZIP signature, and storage key are server-controlled
✔ parseable image-like PDF is marked as requiring OCR
✔ PDF extraction preserves real page boundaries and page order
✔ PDF page rendering preserves text order and line boundaries
✔ renamed non-PDF, empty, and oversized files are rejected
✔ malformed PDF bytes fail parser validation
✔ client-provided hash metadata cannot override the server hash
✔ server hash is calculated from bytes and storage keys are server-shaped
✔ document structure parser derives pages, sections, subsections, and chunks
✔ document structure parser handles unstructured text deterministically
✔ document structure parser rejects missing text
✔ analysis page rows retain tenant, run, page, and character provenance
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4531.7481
```

The existing image-like fixture emitted PDF parser warnings (`Indexing all PDF objects` and invalid flate-stream `Bad FCHECK` warnings), while returning six page rows and OCR-required state as asserted. Warnings were not suppressed or treated as full text-extraction quality success. **Limits:** DOCX coverage here is MIME/ZIP signature and key validation, not raw-text DOCX extraction; no upload HTTP/multipart integration, real source-storage operation, retry/cleanup integration, fresh OCR processing or complete audit delivery was tested. Actual uploads/storage remain unverified; local deterministic repeatability is not retry recovery.

### Existing synthetic DOCX extraction increment (final follow-up)

Found a suitable **existing** binary fixture, `test/fixtures/step9-aircraft-lease.docx`. Inspected it by invoking only local `extractDocumentMetadata` with `.docx`; its contents are explicitly synthetic aircraft lease clauses. No fixture generation, ZIP tooling, network, upload, storage, provider, DB operation or shared-dist build was needed. The already declared `mammoth` dependency handles parsing.

Two independent tests were added to `test/document-ingestion.test.js`:

- Real DOCX parser extraction compares every nonempty source line in order against all seven full contractual clauses, including amounts, notices, exceptions and remedies. Only blank separator lines are ignored, not substantive text. Page count stays null and OCR stays false. A second parse must match the entire metadata result exactly; this is repeatability, **not upload retry recovery**.
- ZIP-signature bytes that pass the initial file signature gate but are not a complete DOCX archive must fail actual extraction with `INVALID_DOCX`, status 400.

Re-executed the same credential-blanked ingestion/structure command above: **15 tests, 15 passed, 0 failed/skipped/cancelled, exit 0**, final duration `4304.3587` ms. Final complete named results:

```text
✔ PDF signature and metadata validation are server-controlled
✔ DOCX extension, MIME, ZIP signature, and storage key are server-controlled
✔ existing synthetic DOCX fixture extracts ordered clause text with unknown page count
✔ malformed DOCX ZIP-signature bytes fail actual local parser validation
✔ parseable image-like PDF is marked as requiring OCR
✔ PDF extraction preserves real page boundaries and page order
✔ PDF page rendering preserves text order and line boundaries
✔ renamed non-PDF, empty, and oversized files are rejected
✔ malformed PDF bytes fail parser validation
✔ client-provided hash metadata cannot override the server hash
✔ server hash is calculated from bytes and storage keys are server-shaped
✔ document structure parser derives pages, sections, subsections, and chunks
✔ document structure parser handles unstructured text deterministically
✔ document structure parser rejects missing text
✔ analysis page rows retain tenant, run, page, and character provenance
```

This supersedes the earlier 13-test DOCX-extraction limitation: actual local synthetic DOCX parsing now has practical coverage. It does not establish representative real-world DOCX/PDF accuracy, tables/layout/scanned-content handling or upload/retry integration. PDF coverage remains the existing image-like fixture and stub text renderer; no new text-rich PDF fixture was manufactured. The 15 overlap the earlier 13, not 15 additional unique tests.

## Encountered operational evidence — qualified, not blanket claims

| Area | Concrete source evidence | Classification and unverified boundary |
| --- | --- | --- |
| Ingestion | `services/documentIngestionService.js:67-107` validates PDF/DOCX extension/MIME/signature, empty input and size; `:124-193` local PDF/DOCX extraction; `:566-589` handles OCR-required sources; `:402-413` extraction persistence. `services/phase3/source/documentVersionSourceService.js:20-43` requires completed non-empty text. | Service code observed, unchanged; final 15 local ingestion/structure cases passed, including actual pre-existing synthetic DOCX extraction and malformed archive rejection. No real upload, OCR execution, representative extraction certification, retry integration or blanket malformed-file coverage certification. |
| Source storage | `services/documentStorageService.js:13-45` scoped versioned object key and `upsert:false`; `:61-76` source download; `repositories/phase3/contractProfileRepository.js:7-18,43-72` scoped profile JSON read/insert. | Code observed; new metadata serialization verified with mock SQL only. Live bucket privacy, retention, RLS, permissions and deployed schema not verified. |
| Search | `services/phase3/analysis/contractIntelligencePipeline.js:14-34,160-163` original clause chunks/available pages and indexing; `repositories/phase3/searchChunkRepository.js:48-80` scoped replace and bounded PostgreSQL websearch. | Existing offline pipeline tests passed; production index contents, database search quality and transaction/retry behaviour were not exercised against a real database. No vector/market search added. |
| Errors | `services/phase3/analysis/contractIntelligencePipeline.js:169-189` persists generic failed message and redacts PostgreSQL detail; `documentVersionSourceService.js:87-99,143-158` scoped lookup errors. New core returns missing-condition/issues with null amounts. | Existing offline failure tests and new safe refusal tests passed. Not a blanket logging/security audit, and production error monitoring was not inspected. |
| Audit | `services/foundationAuditService.js:3-37` inserts audit-event identity/action/entity metadata; `services/documentIngestionService.js:35-63,556-557,631-635,663-667` attempts ingestion events and catches/logs audit failures. | Code observed, unchanged. Events are best-effort in ingestion; completeness/immutability/delivery not verified. Local scenarios intentionally have no persisted audit event. |
| Onboarding/access | `frontend/src/components/demo/OrganizationGate.jsx:14-26,31-55` loading/error, existing membership gate and organization selection; `frontend/src/context/OrganizationContext.jsx:32-101` membership/role resolution. | Code observed, unchanged. This is access selection, not an end-to-end self-service tenant provisioning/onboarding or isolation certification. Browser fixture uses synthetic existing membership; not production authorization evidence. |
| Backup/recovery | `scripts/offline-recovery-audit.js:20-47,64-76` includes profile/search/evidence entities and relationships; `:826-850` inspects archive availability/listing; `:1694-1695` explicitly reports read-only sources/no database restored. | Code observed, **not executed**. No fresh backup, restore drill, backup completeness, retention, RPO or RTO verified. Source inspection is not proof of recovery readiness. |

## Remaining capability gaps / pilot boundaries

1. Conventional prose formulas, formulas spanning schedules, effective dates, caps/floors/thresholds/FX and legally operative exceptions remain human-review work. A real contractual formula outside the narrow grammar will not calculate.
2. Topic coverage is lexical, not semantic extraction of each requested legal/aviation term's mechanism. Existing obligation/risk services continue supplying their already supported facts. Extensible taxonomy is not complete aviation-domain understanding.
3. No licensed/approved market feed, provider freshness verification, approved reference mapping, saved scenarios, audit trail for scenarios, alerts or forecast accuracy measurement.
4. Completed runs remain idempotent and are **not backfilled**. New core output requires a newly analysed run through existing ingestion/analysis flows; old profiles show explicit unavailability.
5. Representative consented real documents, reviewed truth labels, negative legal examples and measured extraction precision/recall are still required before quantitative quality claims. Large-document latency/payload size and production persistence were not benchmarked.
6. Browser evidence, invalid input and responsive checks now pass against synthetic authenticated profiles on a locally hosted build. This does not verify production authentication, data, persistence, hosting or end-to-end paid-pilot readiness; SSR is not substituted for interactive verification.

This is a cohesive persisted contract-result increment plus a bounded local fuel-variable foundation, not a disconnected demo engine and not a claim that the whole platform is production-ready.
