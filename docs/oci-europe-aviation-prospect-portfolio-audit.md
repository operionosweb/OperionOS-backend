# European aviation prospect portfolio quality audit

**Audit date:** 1 November 2026

**Verdict:** **ACCEPT WITH SPECIFIC FIXES REQUIRED**

**Scope:** Read-only review of the 20-account staging portfolio and the existing OCI account, fit and geography contracts. No portfolio, application or database records were changed.

## Executive assessment

The portfolio is a credible, evidence-labelled **discovery shortlist**, but it is not ready to become the first live prospect pipeline without corrections. The companies are relevant aviation organisations and the dataset is structurally compatible with OCI. No evidence supports treating any of them as a qualified opportunity or as a customer with a known contract problem.

The main import blockers are:

1. **Volotea's headquarters field is incorrect.** Its official Impressum distinguishes its registered address at Asturias Airport, Castrillón, from its operational headquarters in Barcelona. The dataset currently calls the registered address its headquarters.
2. **Research status overstates completion.** All 20 records say `Researched`, although several explicitly say that headquarters, legal seat, contracting entity or source verification remains outstanding. The record-level `Verified fact` classification also sits alongside unverified location fields and hypotheses.
3. **The displayed fit scores are partial-evidence averages, not comparable account scores.** They omit 4 of 9 criteria (41.8% of total criterion weight), yet range from 77 to 100. In particular, Avolon and AerCap both score 95 and are Dublin-based lessors, but are assigned different priority groups without an evidence-backed distinction.
4. **Structured source evidence is outside the OCI account schema.** The JSON’s `sources` and `assessment` envelopes are not account fields; a data-only import would discard their claim-to-source mapping unless it is retained separately.
5. **No comparison with existing OCI account records has been made.** Portfolio-only uniqueness does not establish that the 20 accounts are new to the actual import destination.

Do not import the file unchanged. After the specific corrections and an authorized duplicate check, it is suitable for a **human-reviewed target-account staging import**. It is not yet a qualified sales pipeline.

## Scope and method

Reviewed:

- The complete portfolio Markdown and JSON.
- `shared/ociContracts.js`, `shared/ociGeography.js` and `shared/ociAccountFit.js`.
- The existing account field definitions, enum choices, geography validation and score function.
- Official company pages and official/legal sources linked by the portfolio, where retrieval was available.

Source access was checked selectively by direct page retrieval on the audit date. A successful retrieval confirms only the content returned at that time; a failed fetch is an access limitation, not proof that a page is broken. No exhaustive automated link checker was run. Official pages do not consistently state publication dates, and the portfolio records `null` rather than guessing them.

## Account and evidence audit

“Verified” below means that a primary source retrieved in this audit supports the stated operating activity. It does not mean that customer need, contract inventory, buying authority or legal contracting entity has been verified.

| Account | Identity, operations and source result | Location / entity issue | Commercial assessment and disposition |
|---|---|---|---|
| ITP Aero | The [official legal notice](https://www.itpaero.com/en/legal-notice/) identifies Industria de Turbo Propulsores, S.A.U. and its Zamudio registered office. Official company/MRO material supports the propulsion and maintenance context. | Good identity and registered-location evidence. | Strong Spain-first discovery target. Engine support and maintenance obligations are plausible use cases, not reviewed contracts or a known customer problem. Keep. |
| Iberia | IAG's [official annual-report page](https://www.iairgroup.com/investors-and-shareholders/financial-reporting/annual-reports/) supports the group context. Direct retrieval of [Iberia's website](https://www.iberia.com/) returned HTTP 403. | The portfolio itself says Madrid is a corporate base and asks for legal-seat confirmation. The retrieved IAG source does not settle Iberia's exact legal seat. | Credible airline target, but use `Needs verification` until direct entity/location evidence is available. Do not treat site access failure as negative commercial evidence. |
| Air Nostrum | Its [official company profile](https://www.airnostrum.es/en/aboutus/descripciongeneral/) identifies the regional airline, Valencia origin and exclusive Iberia franchise. | Valencia is supported as origin/location; this page alone is not a current registry extract for the legal seat. The franchise does not make Air Nostrum an Iberia subsidiary. | Credible discovery target. Franchise, fleet and service obligations are hypotheses tied to documented operations. Keep; qualify the headquarters wording. |
| Globalia Handling / Groundforce | [Groundforce services](https://groundforce.aero/en/services/) confirms passenger, ramp, operations/load-control and cargo services. Its [legal footer](https://my.groundforce.aero/index_eng.html) identifies Globalia Handling, S.A. Unipersonal and the Llucmajor address. | Groundforce is the trading/service brand; preserve the legal entity as the account and do not create a second Groundforce account. | Strong Spain-first discovery target. Service-agreement use cases are relevant hypotheses. Keep. |
| Binter Canarias | [Binter's official fleet page](https://www.bintercanarias.com/en/corporative/fleet) confirms a regional airline and current aircraft types. | Telde is supported in the dataset by a third-party business-park listing, not a first-party headquarters statement. The official page retrieved did not establish legal seat. | Credible target, but set `Needs verification` for location/entity until first-party or registry evidence is attached. |
| Volotea | Its [official company profile](https://www.volotea.com/en/press-room/about-us/) confirms airline operations. The official [Impressum](https://www.volotea.com/de/gesetzliche-bedingungen/impressum/) states the registered address is Asturias Airport, Santiago del Monte (Castrillón), and separately states the **operational headquarters is in Barcelona**. | **Material correction required:** the JSON says the Castrillón registered address is the headquarters. Set headquarters to Barcelona; record Castrillón as the registered address and distinguish the two locations. | Relevant Spanish airline target. Keep after correcting the headquarters field and preserving the legal/operational distinction. |
| AERTEC Solutions | The [official AERTEC site](https://aertecsolutions.com/en/) confirms aerospace, airport and defence technology/engineering activities. [Andalucía Aerospace](https://andaluciaaerospace.com/en/full_partners/aertec-solutions/) describes engineering/consultancy and Malaga, but is a sector association rather than a company registry. | Malaga is not confirmed as the legal seat by the reviewed first-party page. Segment “Aviation consultancy” is plausible but broad; the company also works in aerospace, airport and defence markets. | Lower-priority hypothesis. Keep only as a research target; confirm buyer entity/location and whether the current Contract Intelligence offer fits its project/SOW work. |
| Air Corsica | The [official airline site](https://www.aircorsica.com/) confirms passenger airline operations. The cited French government registry URL was challenged by an anti-bot page during this audit. | Ajaccio legal seat could not be independently retrieved in this audit. The government URL in the dataset is an appropriate primary-source target, but its contents were not verified here. | Relevant target; use `Needs verification` until the registry entry is reviewed through an accessible official route. |
| Air France Industries KLM Engineering & Maintenance | The portfolio cites Air France-KLM's official [maintenance page](https://www.airfranceklm.com/en/our-strengths/aircraft-maintenance), which returned HTTP 403; the AFI KLM E&M site timed out. | This is an MRO business unit/brand, not yet established here as the legal contracting entity. Paris-area operations do not establish its legal seat. | Strong category fit, but do not import as a standalone legal account or claim verified headquarters until the contracting entity and current first-party evidence are established. |
| Dassault Falcon Service | The [Dassault Group subsidiary page](https://dassault.fr/en/subsidiary/dassault-falcon-service) confirms DFS's Falcon service-center activity and locations. Direct DFS service/legal pages failed at transport/DNS level. | Le Bourget is evidenced as a service/maintenance location, not as the verified legal seat. Exact account legal form and seat remain unresolved. | Plausible MRO target. Retain as a research target; mark location/entity `Needs verification` before treating Le Bourget as headquarters. |
| Condor Flugdienst GmbH | Condor's [official company portrait](https://condor-newsroom.condor.com/en/de/about-us/company-portrait/) confirms airline operations and Condor Technik maintenance at Frankfurt and Düsseldorf. | The source describes Frankfurt as an operating hub; it does not confirm the legal headquarters. Keep the hub label rather than promoting it to headquarters. | Credible airline target. Relevant maintenance/supplier obligations remain hypotheses. Keep with explicit operating-location semantics. |
| Lufthansa Technik AG | Its [official headquarters page](https://www.lufthansa-technik.com/en/headquarters) confirms Hamburg headquarters and engine-repair/engineering activity; its [locations page](https://www.lufthansa-technik.com/en/locations) confirms an international operating network. | Hamburg headquarters is supported. | Strong MRO target, although buyer access and actual contract pain are unknown. Keep. |
| MTU Maintenance Hannover GmbH | The cited [MTU official location page](https://www.mtu.de/about-us/mtu-worldwide/mtu-maintenance-hannover/) returned HTTP 403. | Langenhagen is the maintenance site; this audit could not verify the exact legal contracting entity/seat from the blocked page. | Credible engine-MRO target, not fully source-verified here. Mark `Needs verification` pending accessible first-party or registry evidence. |
| Fokker Services Group B.V. | Its [official company profile](https://fokkerservicesgroup.com/about-us) confirms aviation lifecycle services and multiple facilities. | That page does not establish Hoofddorp as current legal seat or headquarters. | Plausible MRO target. Keep for research; verify the exact account location/entity before import. |
| TrueNoord | [TrueNoord's contact page](https://www.truenoord.com/contact/) confirms aircraft leasing/lease management and an Amsterdam office; its [about page](https://www.truenoord.com/about-us/) confirms operating-lease activity. | An Amsterdam office is not proof of registered seat or headquarters. The dataset appropriately notes this uncertainty but still uses Amsterdam as the account city. | Strong category-level lessor hypothesis. Keep as an office-based research target; set `Needs verification` if OCI's location field is intended to mean headquarters/legal seat. |
| AerCap Holdings N.V. | [AerCap's official profile](https://www.aercap.com/investors/about-aercap) confirms aircraft leasing and Dublin headquarters. Its [contact page](https://www.aercap.com/contact) lists Dublin and an Amsterdam location for AerCap Group Services B.V. | Distinguish AerCap Holdings N.V.'s legal identity from its Dublin headquarters and from the separately named Amsterdam group-services entity. Do not call the Amsterdam office the holding company's registered office without separate evidence. `IE` is defensible if country means HQ/location, not legal domicile. | Strong lessor discovery target. Comparable first-wave candidate to Avolon; keep, with country/location semantics explicit. |
| Avolon Holdings Limited | [Avolon's official profile](https://www.avolon.aero/about-us) confirms aircraft leasing; its [contact page](https://www.avolon.aero/contact) lists a Dublin office and other international locations. | The retrieved pages establish a Dublin office, not necessarily the exact legal seat or headquarters of Avolon Holdings Limited. Avoid turning “office” into a stronger claim. | Strong lessor discovery target. Keep as a candidate; confirm the target legal entity and label Dublin as an office unless a source establishes HQ. |
| Menzies Aviation / John Menzies Limited | Its [official terms](https://menziesaviation.com/terms/) identify John Menzies Limited and the Edinburgh registered office. The [official company site](https://menziesaviation.com/) confirms aviation services and operating scale. | Legal operator and registered office are supported. Keep the commercial brand and legal entity linked as one account. | Strong ground-handling/aviation-services hypothesis. Keep; service obligations are plausible but no customer issue is evidenced. |
| Atitech S.p.A. | The [official Atitech site](https://www.atitech.it/) confirms independent MRO activity, services and bases; its contact page links to official capabilities. | Naples Capodichino is an operating base; the reviewed material does not establish it as legal seat. | Credible MRO target. Keep as a target, but verify the registered entity/seat before calling Naples headquarters. |
| TAP Air Portugal, S.A. | TAP's [official terms](https://www.flytap.com/en-us/legal-info/terms-and-conditions) identify the Portuguese company form and Lisbon Airport headquarters; the [official site](https://www.flytap.com/) confirms airline operations. | Lisbon headquarters is supported. | Relevant airline target. Later geographic wave is consistent with the stated Portugal-last order. Keep. |

### Source quality summary

- **Official primary material retrieved:** company legal notices, company profiles, service pages, contact pages and terms for most accounts. These support identity/operations when the cited page actually says so; they do not prove an account's contract inventory or buying need.
- **Official primary material inaccessible in this client:** Iberia (403), Air France-KLM maintenance page (403), MTU Maintenance Hannover (403), AFI KLM E&M site (timeout), Air Corsica government registry (anti-bot challenge), and Dassault Falcon Service pages (transport/DNS failure). Alternative official pages support some operating claims, but not every legal/location claim.
- **Authoritative/secondary material:** the Air Corsica registry is an official government source but was not retrievable; Andalucía Aerospace is a sector association; the Binter Telde location is supported by a local business-park listing, not a first-party headquarters statement.
- **Reputable industry publications:** none was needed to establish the basic segment for accounts with accessible company material.
- **Dates:** publication dates are generally absent. The account research date is present, but the JSON does not capture dated snapshots for each dynamic source.
- **Claim/source mapping:** the detailed `sources[]` evidence lives in the JSON envelope, not in OCI account fields. `data.source` is a free-text summary. Do not discard the envelope on import without first retaining its claim-to-source relationships in an audit/research artifact.

## Commercial relevance and prioritisation

The portfolio's contract categories are **plausible hypotheses** attached to documented aviation activities. No reviewed customer contract, procurement process, buyer access, stated problem, budget, committed pilot or buying signal supports a claim of actual need. Do not automatically create opportunities.

### Five strongest initial discovery candidates

This is a recommended discovery order, not a prediction of conversion:

1. **ITP Aero** — directly verified propulsion/MRO services and a verified Spanish registered office.
2. **Globalia Handling / Groundforce** — specific published ground-handling service lines and a supported Spanish legal operator.
3. **Air Nostrum** — documented regional airline and Iberia franchise provide a concrete but still hypothetical service-obligation discovery path.
4. **Iberia** — strategically important Spanish airline, but resolve the direct-source and legal-seat gap before formal import or outreach.
5. **Avolon** — verified lessor category and Dublin office create a direct lease-obligation discovery hypothesis.

**AerCap is an evidence-backed tie with Avolon for the fifth slot.** Both are Dublin-based aircraft lessors, each scores 95, and neither has a verified buying contact. The existing P1/P2 split is not explained by a documented commercial-access or buying-signal difference. Keep AerCap in the first-wave candidate set or document a human-reviewed reason to sequence it later.

### Five credible secondary candidates

- **Lufthansa Technik** — strong, directly verified MRO activity; Germany is a later market than Spain.
- **MTU Maintenance Hannover** — relevant engine MRO; re-fetch primary location/entity evidence because the cited page was blocked.
- **AFI KLM E&M** — strong MRO relevance, but it is a business unit and its contracting entity needs confirmation.
- **Volotea** — active airline with current European bases; correct the headquarters/registered-address distinction first.
- **TrueNoord** — operating lessor with an Amsterdam office; legal seat and buyer access remain unknown.

These are not necessarily lower in product fit than the first group. They are sequenced by the Spain-first strategy, source/entity confidence and research readiness.

### Further research; retain, but do not overstate

Binter Canarias, AERTEC Solutions, Air Corsica, Dassault Falcon Service, Condor, Fokker Services Group, Atitech and Menzies Aviation all have credible aviation relevance. Before import, resolve the specific location/entity caveats in the account table. AERTEC is the least direct fit to an operator-side contract-intelligence buyer: its consultancy/project agreements are a reasonable but weaker hypothesis than airline, lessor, MRO or ground-handler use cases.

**No account is recommended for removal solely on the evidence reviewed.** None is an obvious duplicate or unrelated business. If the requirement is a ready-to-contact pipeline rather than a target research list, the whole portfolio needs buyer/contact discovery; do not replace accounts speculatively.

## Account-fit scoring audit

The independent recalculation using OCI's actual `scoreOciAccountFit()` function matches the Markdown scores for all 20 records:

- Range: **77–100**.
- Every record assesses **5 of 9** factors.
- Every record has **2 verified** ratings and **3 hypothesis** ratings; the remaining 4 are Unknown.
- The assessed factors are contract complexity, aviation relevance, operational complexity, geographic priority and evidence quality.
- The 4 Unknown factors (contract volume, financial exposure, decision-maker access and commercial accessibility) account for **4.6 of 11.0 total weight (41.8%)**.

The function correctly preserves Unknown ratings, but computes a weighted average over only assessed ratings. Consequently 100 for Groundforce means 5 High ratings among the assessed subset, not a complete 9-factor view or exceptional commercial accessibility. The high hypothesis ratings for contract/operational complexity are explicitly labelled hypotheses, but the evidence does not include reviewed contracts or contract counts. Keep those as provisional rather than reading them as demonstrated customer complexity.

The score math is correct; **using these values to rank acquisition readiness is not**. Show coverage (5/9) and the Unknown factors alongside every score. Do not equate score, company size, geography or verified aviation activity with qualification. The existing priority grouping is not consistently explained: the Avolon/AerCap pair is the clearest example.

## OCI compatibility

Read-only checks against the actual OCI contracts found:

- 20 records; all 20 country codes resolve to geographical Europe under the current OCI geography policy, including `GB` for the UK.
- Every `records[].data` key is an allowed account field; no invalid account select values or geography values were found.
- No invented contacts are present: all 20 contact arrays are empty and stakeholder status is `Unknown stakeholder`.
- No opportunity records are included; accounts remain `Target`.
- The dataset states it is prepared only and not imported.
- `assessment` and `sources` are explicitly non-account envelopes. They will not be preserved by a payload-only import. Keep them outside OCI or flatten only the source references that the existing `source` field can safely represent.
- `researchStatus: "Researched"` is used for all 20 despite the unresolved items listed above. Apply `Needs verification` to records whose account identity/location evidence is incomplete, and use an accurate record-level evidence classification for this mixed fact/hypothesis dataset.

The schema check does not establish that the target OCI database has no matching records. No database or production access was performed.

## Required fixes before staging import

1. Correct Volotea's headquarters to Barcelona and separately retain its Castrillón registered address.
2. Reconcile each `headquarters`, `city` and `location` with what its source actually establishes. At minimum, resolve or explicitly mark Iberia, Air Nostrum, Binter, AERTEC, Air Corsica, AFI KLM E&M, Dassault Falcon Service, Condor, MTU, Fokker Services Group, TrueNoord, Avolon and Atitech as `Needs verification` where the source gap remains.
3. Avoid an unqualified record-level `Verified fact` label for a record containing hypotheses or unresolved identity/location details. Preserve field-level fact/hypothesis distinctions.
4. Retain the structured source and assessment envelope outside OCI; do not imply its claim-level provenance is imported into account records.
5. Document a human-reviewed ordering for AerCap versus Avolon; otherwise treat them as equally ranked initial candidates.
6. Before import, compare legal names and aliases against the authorized OCI destination to prevent duplicate accounts. Do not create contacts or opportunities from this research alone.
7. Leave all four unknown fit factors Unknown. Display the score with its 5/9 coverage and do not use it as a probability or qualification signal.

## Limitations and preservation

- Public company pages verify operations, not internal contract counts, financial exposure, procurement activity, customer pain, budget or willingness to pilot.
- No relevant named decision-maker was independently verified; no person, email or phone was invented.
- Some official URLs could not be fetched in this client. The alternative page evidence and limitations are stated above; inaccessible pages are not represented as successfully inspected.
- No live OCI records were queried, so pre-import deduplication remains necessary.
- No application code, original portfolio file, database record, deployment setting or other worktree was modified. Only this audit report and its companion findings JSON were added.
- No import, production access, migration, commit, push, merge, rebase or deployment occurred.

## Final verdict

**ACCEPT WITH SPECIFIC FIXES REQUIRED.** Accept the portfolio as a useful research shortlist, not yet as an unchanged staging import and not as Operion's first qualified prospect pipeline. Resolve the Volotea headquarters error, align research statuses and entity/location claims with the evidence, preserve source provenance, explain the Avolon/AerCap sequencing, then conduct an authorized duplicate check before any import.
