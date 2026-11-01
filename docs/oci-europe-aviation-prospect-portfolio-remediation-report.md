# European aviation prospect portfolio remediation report

**Date:** 1 November 2026
**Verdict:** **ACCEPT WITH SPECIFIC FIXES REQUIRED**
**Purpose:** Remediate the findings in the independent portfolio quality audit and prepare corrected staging data. This work did not import records or access a database.

## Deliverables

- [Remediated portfolio report](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.md)
- [Remediated portfolio JSON](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json)

The original portfolio and original audit remain unchanged.

## Complete change register

### 1. Volotea headquarters and geography

**Before:** The account named Castrillón as headquarters and used it as the city/location, conflating the registered address and operational headquarters.

**Correction:** The official [Volotea Impressum](https://www.volotea.com/de/gesetzliche-bedingungen/impressum/) was retrieved during remediation. It separately states the registered address at Asturias Airport, Santiago del Monte (Castrillón), and the operational headquarters at Travessera de Gràcia 56, Barcelona. The remediated account now uses Barcelona for `city` and `location`, distinguishes both addresses in `headquarters` and `operationalLocations`, records the Impressum URL in geographic provenance and the source register, and sets geographic confidence to High.

**Change date/confidence:** Research date `2026-11-01`; source confidence High.

### 2. Research status, evidence classification and confidence

The OCI account contract supports only `Not researched`, `In progress`, `Researched` and `Needs verification`; it has no separate `Partially researched` value. The remediated data uses the existing values as follows:

- **Researched (7):** reviewed evidence supports core identity, aviation activity and the account location represented.
- **In progress (6):** core activity is supported, but a material location or entity clarification remains.
- **Needs verification (7):** a material identity, contracting-entity, location or primary-source evidence gap must be resolved.
- **Not researched (0):** each account has substantive source review; none was left untouched.

Every `classification` now uses the existing `Research finding` enum rather than calling a mixed fact-and-hypothesis account wholly a `Verified fact`. The per-record `confidence` is High for Researched records and Medium for In progress / Needs verification records. `geographic_confidence` is independently set to High, Medium or Low according to location evidence. Unknown customer needs, buying signals and contacts remain unknown.

| Account | Previous research status | Remediated status | Reason |
|---|---|---|---|
| IBERIA, Lineas Aereas de Espana, S.A. Operadora, Sociedad Unipersonal | Researched | Needs verification | Iberia's page returned 403; Madrid corporate base is not verified as legal seat. |
| Air Nostrum Lineas Aereas del Mediterraneo, S.A. | Researched | In progress | Official profile verifies airline/franchise and Valencia origin, but not current legal headquarters. |
| Industria de Turbo Propulsores, S.A. (ITP Aero) | Researched | Researched | Official legal notice verifies company identity and Zamudio registered office; aviation services are sourced. |
| Globalia Handling, S.A.U. (Groundforce) | Researched | Researched | Official service and legal pages support the handling services, operator identity and Llucmajor address. |
| Binter Canarias, S.A. | Researched | Needs verification | Airline/fleet is first-party verified; Telde location is secondary and not first-party HQ evidence. |
| Volotea, S.L. | Researched | Researched | Official profile and newly retrieved Impressum support airline activity and distinguish Barcelona HQ from Castrillón registered address. |
| AERTEC Solutions, S.L. | Researched | Needs verification | Aviation engineering is first-party supported; Malaga/consultancy categorisation relies partly on a sector association, and HQ is unresolved. |
| Air Corsica (AIR CORSICA) | Researched | Needs verification | Airline site is available; cited government registry content was blocked during review, leaving the legal seat unconfirmed. |
| Air France Industries KLM Engineering & Maintenance (AFI KLM E&M) | Researched | Needs verification | MRO business-unit evidence is incomplete/access-restricted and the contracting legal entity is unresolved. |
| Dassault Falcon Service | Researched | Needs verification | Parent source supports DFS activity; direct DFS legal/service pages were unavailable and legal seat/entity remains unresolved. |
| Condor Flugdienst GmbH | Researched | In progress | Official portrait supports airline and maintenance activity; Frankfurt is an operating hub, not verified legal HQ. |
| Lufthansa Technik AG | Researched | Researched | Official headquarters and locations pages verify Hamburg HQ and MRO operations. |
| MTU Maintenance Hannover GmbH | Researched | Needs verification | Langenhagen is the MRO site, but the cited MTU page was blocked and contracting entity/legal seat needs confirmation. |
| Fokker Services Group B.V. | Researched | In progress | Official profile verifies MRO activity; Hoofddorp was not established as current legal seat/HQ. |
| TrueNoord | Researched | In progress | Official pages verify leasing and Amsterdam office; legal seat/HQ is not expressly stated. |
| AerCap Holdings N.V. | Researched | Researched | Official company profile verifies leasing and Dublin HQ; separately named Amsterdam group-services office is distinguished. |
| Avolon Holdings Limited | Researched | In progress | Official pages verify leasing and Dublin office, but the cited contact page does not itself establish legal seat/HQ. |
| Menzies Aviation (John Menzies Limited) | Researched | Researched | Official terms identify the legal website operator and Edinburgh registered office; official site verifies aviation services. |
| Atitech S.p.A. | Researched | In progress | Official pages verify MRO activity and bases; Naples is an operating base, not verified legal seat. |
| TAP Air Portugal, S.A. | Researched | Researched | Official terms verify company form and Lisbon Airport headquarters; official site verifies airline activity. |

Access restrictions (403, timeouts, anti-bot pages or transport errors) are recorded as verification limitations, not as evidence that a source is broken or a claim false.

### 3. Account-fit scores and unknown criteria

The original OCI nine-factor rubric and weights are unchanged. The actual `scoreOciAccountFit()` function was used to recalculate every score. For each of the 20 accounts, the same five factors are assessed: contract complexity, aviation relevance, operational complexity, geographic priority and evidence quality.

- Coverage is **5/9 criteria** (55.6% by criterion count).
- Assessed weight is **6.4/11.0** (58.2% by rubric weight).
- The four unassessed factors are explicitly set to **`Unknown`**: contract volume, financial exposure, decision-maker access and commercial accessibility.
- Each score is retained only as a partial-evidence weighted mean and labelled `5/9` in the Markdown table. The JSON adds a research-only `assessment.fitCoverage` envelope with score, coverage, assessed keys, unknown keys and interpretation. It is not an OCI account field.
- All Unknown criteria remain Unknown; no score is completed by assumption.

Because all accounts use the same five assessed factors, their scores can be compared only as partial averages of that shared subset. They must not be presented as complete nine-factor fit, readiness, customer need, sales probability or qualification. This caveat is included beside the scores and in each record's fit rationale.

### 4. Source and geographic provenance

The actual OCI account module supports `source` as a textarea (maximum 4,000 characters), `researchDate`, `confidence`, `classification`, `geographic_source`, `geographic_confidence`, `country_code`, `country`, `city` and `location`. It does **not** define a structured source-array account field.

To avoid losing source data during account serialization:

1. The structured `records[].sources` register remains in the remediated JSON, including source title, URL, publication date (`null` where not stated), research date, supported claims and source confidence.
2. The complete citation details for every source are also serialized into the existing `records[].data.source` notes field. The largest serialized source field is below 4,000 characters.
3. Geographic claims remain in supported geography fields; `geographic_source` includes the source-register reference and country code/name, and `geographic_confidence` is set separately.
4. The remediated JSON explicitly identifies `assessment` and `sources` as research envelopes, not account fields. The flattened source notes survive account-form serialization; the envelopes remain in the sidecar JSON.

Source entries whose URLs could not be directly retrieved during the audit (Iberia, Air France-KLM/AFI KLM E&M, MTU, Air Corsica registry and direct DFS pages) are marked Medium confidence and annotated with the access limitation where applicable. No new OCI field was invented. The remaining limitation is that OCI stores multiple sources as free text, not as structured child records; the JSON sidecar is required to preserve the structured claim-to-source mapping.

### 5. Avolon and AerCap

The nine factor values and the recalculated partial score are identical for both accounts. Each has verified aircraft-lessor relevance and Ireland geography, hypothesis-rated contract and operational complexity, and evidence-quality ratings. The records provide no evidence that one has better decision-maker access or commercial accessibility; those factors remain `Unknown`.

Both are therefore assigned OCI account priority **High** and **Priority 1 tied for the fifth discovery slot**. AerCap's account priority changes from Medium to High to match the evidence-supported tie with Avolon. The account list contains six candidates across five slots. Neither receives a higher rank than the other, and no customer problem, contact, opportunity or buying signal is asserted.

### 6. Other portfolio integrity checks

- Retained all 20 organisations. No evidence justified removing or replacing an account.
- No duplicate names occur within the portfolio. This is not a duplicate check against OCI's destination records.
- Country codes and legacy country names remain paired and validated; all 20 countries are in geographical Europe. Spain 7, France 3, Germany 3, Netherlands 2, Ireland 2, UK 1, Italy 1, Portugal 1. `GB` remains the UK code; the UK is not classified as EU or EEA.
- No contact was invented: all 20 contact arrays remain empty and stakeholder status remains Unknown.
- No opportunity was created or qualified; all accounts remain targets.
- Commercial use cases, entry departments and pilot concepts remain explicit hypotheses, not company-reported needs.
- No fit rating or rubric weight changed. Unknown factor values are explicit and evidence rationales retain their hypothesis boundaries.

## Validation results

Validation was performed offline against the current OCI contracts and serializer:

- JSON parsed successfully; 20 records and 20 account findings were present.
- Every account key belongs to the existing OCI account module; all select values, including research status and evidence classification, use contract options.
- All records passed `validateOciGeography("accounts", data)` and retained matching country names and ISO codes.
- Each account payload serialized through `serializeOciRecordForm()` with source, date, confidence, geography provenance and explicit Unknown ratings preserved.
- Every `source` field stayed below the 4,000-character notes limit; all source records retain URL/date/support/confidence metadata.
- Recalculated scores match the remediated Markdown. Avolon and AerCap match across all nine fit ratings and both score 95 with 5/9 coverage.
- All 20 contacts/opportunities remain absent; all 20 `accountStatus` values remain `Target`.
- Original portfolio and audit deliverables were not edited. `git diff --check` and whitespace checks passed.
- No database, production system or live OCI account was accessed. No import, migration, code change, commit, push, merge, rebase or deployment occurred.

## Remaining limitations and verdict

The research-status corrections make evidence gaps visible but do not resolve them. In particular, legal/contracting entity and headquarters evidence remains outstanding for records marked In progress or Needs verification. The exact import destination was not queried, so pre-import duplicate detection and legal-entity resolution remain necessary. No actual buyer, customer need, procurement activity, budget, contract volume or willingness to pilot was verified.

**ACCEPT WITH SPECIFIC FIXES REQUIRED.** The corrected package is suitable for staging review and controlled import only if the existing status values are preserved and an authorized destination duplicate check is completed. Records marked `Needs verification` must remain visibly unverified; they must not be promoted to `Researched` or qualified without new evidence.
