# European aviation prospect portfolio — final acceptance and staging readiness

**Review date:** 2026-11-01

**Reviewed dataset:** [Remediated portfolio](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.md) and [remediated JSON](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json)

**Decision:** **ACCEPT WITH SPECIFIC FIXES REQUIRED**

## Executive decision

The remediated 20-account package passes offline checks against the current OCI account validator, geography policy, fit rubric and form serializer. The earlier data corrections are present: Volotea's Barcelona operational headquarters is distinct from its Castrillón registered address; research statuses reflect the evidence gaps; all fit scores show 5/9 coverage with four unknown criteria; and Avolon and AerCap are tied on the same ratings and score.

**Do not import into a staging database yet.** The authorized destination was not queried, so the required name/alias and parent-brand duplicate review remains open. The repository has an authenticated, validated, single-record account-creation workflow, but no portfolio/bulk-import endpoint. Once an operator confirms the staging environment and completes the duplicate review, records may be entered individually as `Target` accounts while preserving the research statuses and retaining the source sidecar.

The remaining company-identity and location gaps are not silently treated as resolved. They are represented by `In progress` or `Needs verification`; those records must not be presented as fully researched or as verified contracting entities. The portfolio remains a research shortlist, not a qualified pipeline.

## Finding-by-finding closure register

The IDs and original severities below match the original audit findings JSON. “Prevents staging” means whether the finding blocks the proposed staging operation, not whether it prevents later qualification or outreach.

| ID | Severity | Affected accounts / field | Closure and remaining issue | Evidence needed / recommended correction | Prevents staging? |
|---|---|---|---|---|---|
| F-01 | High | Volotea; `headquarters`, `city`, `location`, geographic provenance | **Closed.** The remediated record uses Barcelona for the operational headquarters and separately identifies the Castrillón registered address. The official Impressum is recorded in its sources and geographic provenance with research date and confidence. | No further portfolio correction is supported by the reviewed evidence. Keep the two location meanings distinct if the record is later edited. | No. |
| F-02 | Medium | 13 accounts; `researchStatus`, `classification`, location and legal-entity fields | **Partially closed.** The blanket `Researched` status and `Verified fact` classification were removed. The existing OCI statuses distinguish 7 `Needs verification`, 6 `In progress`, and 7 `Researched`; no new status was invented. The underlying evidence gaps for the 13 flagged records remain open. | See the account-level register below. Obtain current first-party or official registry evidence before changing any flagged record to `Researched` or asserting a contracting entity/HQ not established by its cited source. | Not for staging as transparently flagged research targets. **Yes** for treating a flagged location or entity as verified, or for qualifying/outreaching on an unconfirmed legal entity. |
| F-03 | Medium | All 20; nine-factor fit and displayed score | **Closed with a usage limitation.** Scores are recalculated with the unchanged OCI function. Every record assesses 5/9 criteria (6.4/11.0 rubric weight); four criteria remain `Unknown`. Coverage and partial-score interpretation are displayed, and scores are not presented as probability, qualification or readiness. | No rating should be filled without evidence. Keep all four unknowns unknown and retain the coverage caveat wherever scores are displayed. | No, if the partial-score caveat and unknowns remain visible. |
| F-04 | Medium | Avolon and AerCap; `priority`, fit ratings and priority group | **Closed.** The two records have identical nine-factor values, score 95, account priority `High` and portfolio group `Priority 1`. No unsupported buyer-access or accessibility differentiator is claimed. | No further correction. Any future sequencing difference requires a documented, human-reviewed evidence basis. | No. |
| F-05 | Medium | All 20; `records[].sources`, `records[].assessment`, OCI `source` field | **Mitigated; schema limitation remains.** Structured source envelopes remain in the remediated JSON. Citation details are also flattened into the existing OCI `data.source` notes field. The account contract has no structured source-array field, so claim-to-source relationships are not stored as structured OCI child records. | Retain the remediated JSON sidecar with any staging batch. Submit only `records[].data` as account payloads; do not discard the sidecar or send `sources`/`assessment` as unknown account fields. | No, provided the sidecar is retained and the citation notes remain in each account. It does prevent claiming that OCI itself stores structured claim-level provenance. |
| F-06 | Medium | All 20; destination identity and aliases | **Open — staging blocker.** Portfolio-only uniqueness is verified, but no destination OCI records were queried. The database's active-account uniqueness constraint covers normalized exact account name plus country; it does not establish that aliases, brands, subsidiaries or parent entities are not already represented under another name. | Before any create, compare all 20 proposed names and known brand/legal-name/parent relationships against active accounts in the authorized staging environment. Human-review each match and record whether to skip or use the existing record. Do not create duplicates or contacts/opportunities. | **Yes, until that destination review is complete.** |
| F-07 | Low | All 20; contact, stakeholder and opportunity data | **Closed as an intentional scope boundary.** Contact arrays remain empty, stakeholder identity remains unknown, account status remains `Target`, and no opportunity is included or qualified. No buyer, need, procurement signal, budget or willingness to pilot was verified. | Discover professional contacts lawfully and qualify only after customer evidence. Do not add people or opportunities from this research alone. | No, for staging target accounts. It blocks treating this portfolio as a qualified sales pipeline. |

### Remaining account evidence register for F-02

These are not new findings; they are the specific unresolved records already identified in the audit and remediation. The existing status is retained, and the evidence below is what would justify a later status or location correction.

| Account | Current status | Remaining uncertainty | Evidence required before promoting the disputed field |
|---|---|---|---|
| IBERIA, Lineas Aereas de Espana, S.A. Operadora, Sociedad Unipersonal | Needs verification | Madrid corporate base does not establish the current legal seat; direct company page was access-blocked during review. | Accessible current Iberia legal/official company information or an authoritative company-registry record for identity and legal seat. |
| Air Nostrum Lineas Aereas del Mediterraneo, S.A. | In progress | Official profile supports airline/franchise and Valencia origin, not current registered seat. | Current official company or registry evidence for the legal seat; keep franchise separate from subsidiary status. |
| Binter Canarias, S.A. | Needs verification | Airline/fleet is first-party supported; Telde location/HQ rests on a third-party listing. | First-party corporate address or an authoritative registry record confirming the intended HQ/location. |
| AERTEC Solutions, S.L. | Needs verification | Malaga and consultancy categorisation rely partly on an association profile; legal HQ is not established by the reviewed company page. | Current official or registry address, plus primary evidence for any narrower segment claim used in the account. |
| Air Corsica (AIR CORSICA) | Needs verification | Airline activity is supported; cited government registry content could not be retrieved, leaving legal seat unresolved. | Accessible official registry entry or another authoritative public record confirming identity and seat. |
| Air France Industries KLM Engineering & Maintenance (AFI KLM E&M) | Needs verification | MRO business-unit relevance is plausible, but its customer-facing contracting entity and legal seat are unresolved. | Current primary corporate/legal source identifying the contracting entity; create/retain the OCI account under the correct identity. |
| Dassault Falcon Service | Needs verification | Group source supports subsidiary/MRO activity; direct DFS legal/service pages were unavailable and legal form/seat remain unresolved. | Current DFS or authoritative registry evidence for exact entity and seat. |
| Condor Flugdienst GmbH | In progress | Frankfurt is documented as an operating hub, not as the verified legal headquarters. | Current legal notice or registry evidence if a headquarters field is required; otherwise preserve Frankfurt strictly as an operating hub. |
| MTU Maintenance Hannover GmbH | Needs verification | Langenhagen is described as the maintenance site; cited page was access-blocked and exact contracting entity/seat was not confirmed. | Accessible current MTU primary source or registry evidence for the site, legal entity and seat. |
| Fokker Services Group B.V. | In progress | Official profile supports MRO activity but does not establish Hoofddorp as current legal seat/HQ. | Current official legal notice or authoritative registry record; label Hoofddorp as an office/site unless it establishes more. |
| TrueNoord | In progress | Official sources support leasing and an Amsterdam office, not registered seat/HQ. | Current official legal or registry evidence for seat/HQ; retain Amsterdam as an office until then. |
| Avolon Holdings Limited | In progress | Official sources support leasing and a Dublin office; the reviewed contact page alone does not establish legal seat/HQ. | Current official legal notice or authoritative company record for exact legal seat/HQ. |
| Atitech S.p.A. | In progress | Official sources support MRO activity and bases; Naples is an operating base, not verified legal seat. | Current official legal notice or authoritative registry evidence for registered seat. |

`In progress` versus `Needs verification` is intentionally preserved from the remediated package: it distinguishes material outstanding clarification from a more fundamental identity/location/source gap using the existing OCI enum. None of these records is to be promoted to `Researched` merely because its aviation operations are relevant.

## Offline validation results

The review read the original portfolio Markdown/JSON, original audit Markdown/findings JSON, remediated Markdown/JSON, complete remediation report, and current OCI account, geography and fit contracts. It did not re-fetch every external source; the original audit's URL access limitations remain the evidence record.

The remediated JSON was parsed and every `records[].data` payload was passed through `serializeOciRecordForm()` and `validateOciData("accounts", ...)` using the current account module and OCI stages. The following checks passed:

- Exactly 20 account records; no duplicate normalized name/country pair within this portfolio.
- All 20 account payloads pass OCI account validation and geography validation; all are within geographical Europe.
- Country distribution: Spain 7, France 3, Germany 3, Netherlands 2, Ireland 2, UK 1, Italy 1, Portugal 1. The UK is `GB` and is not classified as EU or EEA.
- Segment distribution: airlines 7, MRO 7, ground handling 2, aircraft lessors 3, aviation consultancy 1.
- Status distribution: `Researched` 7, `In progress` 6, `Needs verification` 7. All account status values remain `Target`.
- All 20 records retain research date, record confidence, geographic source/confidence, all nine fit fields, and source notes under the OCI 4,000-character notes limit. Each structured source envelope retains title, URL, publication date where stated, research date, supported claims and confidence; the tested serializer retained the supported account provenance fields and the URLs in the notes.
- Every fit score matches the current OCI scoring function; all have 5 assessed and 4 unknown criteria. Avolon/AerCap have identical factor values, identical score 95 and both are Priority 1.
- All 20 contact arrays are empty. No opportunity payloads were included. The `assessment` and `sources` envelopes are not submitted as account fields.

The first validation attempt used the wrong JSON path for the contact envelope and failed its test harness assertion; the check was corrected to inspect `records[].assessment.contacts`, then the full validation passed with no data errors. No project file was changed during validation.

## Existing OCI staging-entry capability and procedure

Repository inspection found no bulk/file import endpoint. It did find the normal authenticated, single-record Accounts workflow: the OCI UI submits an account form to `POST /records/accounts` within the mounted OCI router. The service validates the account payload and geography before repository creation. The database migration defines an active-account unique index on lowercase-trimmed `name` plus lowercase-trimmed `country`; an exact-key collision is translated to HTTP 409 `OCI_DUPLICATE_CONFLICT`. The UI surfaces request errors. The database mutation and its audit event are transactional, but a sequence of 20 separate creates is **not** an all-or-nothing batch.

Therefore this package is not directly loadable as a file. After the F-06 gate and staging-environment confirmation, the existing supported procedure is:

1. An authorized operator confirms the selected OCI application/database is **staging**, not production. No staging or production environment was accessed for this review.
2. Keep the remediated JSON sidecar with the batch. Compare every proposed account name and country to active staging accounts, including known aliases, brands, parents and subsidiaries. Resolve each match manually before creating anything; the database index alone catches only exact normalized name/country matches.
3. Use the normal OCI Accounts UI and create records individually from each `records[n].data`. Do not send the outer `sources` or `assessment` envelopes. Keep the flattened `source` citation notes and each record's current research status, confidence and `Target` status.
4. On a 409 duplicate conflict, stop for that account, inspect the existing record, and have an authorized human decide whether to skip or correct/link it through normal OCI workflows. Do not blindly retry. On validation errors, correct the source data only when evidence supports the correction; retry only after reviewing the displayed error. If a request times out with an unknown outcome, refresh/search staging before retrying.
5. Track individual successes and failures outside the application. Since entry is per-record, earlier successful creates remain if a later record fails. Afterward, review the staged records against the sidecar, statuses and evidence; do not create contacts or opportunities from this package.

This describes a supported application entry route, not a newly created importer or an authorization to perform the import. No database read/write, import, migration, production access, application-code change, deployment or Git history operation was performed.

## Final verdict

**ACCEPT WITH SPECIFIC FIXES REQUIRED.**

The dataset is structurally compatible and can be used for a human-reviewed staging entry **only after** (1) an authorized staging destination is confirmed and (2) its active accounts and aliases are checked and adjudicated for all 20 candidates. The flagged location/entity records may remain in staging only with their current `In progress` / `Needs verification` statuses and clear operating-office versus legal-seat semantics. Preserve the structured JSON sidecar because OCI has no structured source-array field.

The destination duplicate check is not complete, so this report does **not** authorize or recommend starting the staging creates now. No evidence-supported portfolio-field correction remained to make in this final review; the existing remediated Markdown and JSON remain the candidate deliverables, and no duplicate “final” dataset copies were created. This audit confirms staging-entry readiness subject to the explicit gates above—not production readiness, customer qualification, or an import performed.

## Preservation

- Original portfolio and original audit deliverables remain unchanged.
- Historical remediation deliverables remain unchanged.
- No application code, database record, migration, authentication, TLS, deployment setting, other worktree or branch was modified.
- No records were imported, and no production or staging database was accessed.
- Branch and baseline remain `dev/oci-europe-increment-a` at `8720815dcea6811326051166e41ba44d61395011`.
