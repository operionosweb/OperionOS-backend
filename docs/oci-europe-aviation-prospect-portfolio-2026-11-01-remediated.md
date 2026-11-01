# European aviation prospect portfolio - remediated

Research date: 1 November 2026
Scope: first 20 European aviation target accounts for existing Operion Contract Intelligence
Status: research and import preparation only; no OCI record was created or changed

The accompanying [remediated JSON dataset](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json) contains the OCI-compatible `data` payload for each account, structured evidence references, commercial hypotheses, department-level entry points, discovery questions, pilot hypotheses, and the nine-factor fit ratings. The `assessment` and `sources` envelopes remain research documentation, not OCI account fields. Full source citations are also flattened into the existing account `source` notes field for OCI serialization; the structured source register remains in the JSON envelope.

## Executive assessment

The portfolio is commercially actionable as a **human-reviewed prospecting shortlist**, not as a qualified pipeline or a validated set of customer problems. Each account has cited company and aviation-segment evidence, but source accessibility and identity/location completeness vary. Research status now reflects those differences. Contract types, potential problems, departments, and pilot scopes are clearly labeled as hypotheses unless a source establishes the underlying activity.

The five strongest initial research targets are:

1. **ITP Aero** — Spanish propulsion company with a Zamudio registered office and publicly described propulsion/service activities. A maintenance and service-obligation use case is directly relevant, but no customer problem or contract volume is known.
2. **Iberia** — Spain-first airline within IAG. Airline operations and group reporting create a plausible fleet, maintenance and supplier-contract discovery path; its exact current legal-seat record should be confirmed before import.
3. **Air Nostrum** — Valencia-based regional airline; its official profile documents an exclusive franchise with Iberia Group and a multi-country operating network. Those facts support a focused question about responsibilities and deadlines, not an assumption of unmet need.
4. **Globalia Handling / Groundforce** — Spanish ground handler with published passenger, ramp, operations/load-control and cargo services. This gives concrete service-agreement hypotheses; no service failure or customer issue is claimed.
5. **Avolon and AerCap (tied)** — Both are Ireland-based lessors with official leasing evidence and documented Dublin locations. Their nine-factor ratings and partial scores are identical; no verified evidence distinguishes buyer accessibility or commercial readiness.

These are the best **first discovery bets**, not predictions of revenue or conversion. The ordering combines the user’s Spain-first strategy, source-backed aviation relevance, and plausible current-product fit. No actual procurement activity, decision-maker access, contract portfolio size, financial exposure, customer commitment or buying signal was verified.

## Portfolio distribution

### By country

| Country | OCI code | Accounts | Geographic classification |
|---|---:|---:|---|
| Spain | ES | 7 | Geographical Europe; EU; EEA |
| France | FR | 3 | Geographical Europe; EU; EEA |
| Germany | DE | 3 | Geographical Europe; EU; EEA |
| Netherlands | NL | 2 | Geographical Europe; EU; EEA |
| Ireland | IE | 2 | Geographical Europe; EU; EEA |
| United Kingdom | GB | 1 | Geographical Europe; **not** EU or EEA |
| Italy | IT | 1 | Geographical Europe; EU; EEA |
| Portugal | PT | 1 | Geographical Europe; EU; EEA |
| **Total** |  | **20** | **19 EU/EEA accounts; 1 UK account** |

This uses OCI’s existing geographical-Europe, EU, EEA and UK distinctions. It does not infer geography from EU membership. The JSON uses `GB`, not `UK`, for the United Kingdom.

### By aviation segment

| Segment | Accounts |
|---|---:|
| Airlines | 7 |
| Aircraft lessors | 3 |
| MRO organisations | 7 |
| Ground handling | 2 |
| Aviation consultancy | 1 |
| **Total** | **20** |

No airport operators or unrelated businesses were added to reach the target count.

## Account list and account-fit results

Priority groups are manually reasoned commercial research order, not sales stages. The score is the existing OCI weighted fit function; it is not a probability of sale or qualification.

| # | Account | Country / city | Segment | Priority | Research status | OCI fit score (assessed / 9) | Evidence-backed reason and source |
|---:|---|---|---|---|---:|---|
| 1 | ITP Aero | Spain / Zamudio | MRO | Priority 1 | Researched | 94 (5/9) | Registered office and propulsion-services context; [official legal notice](https://www.itpaero.com/en/legal-notice/) |
| 2 | Iberia | Spain / Madrid | Airline | Priority 1 | Needs verification | 87 (5/9) | IAG airline context and company reporting; [IAG annual reports](https://www.iairgroup.com/investors-and-shareholders/financial-reporting/annual-reports/) |
| 3 | Air Nostrum | Spain / Valencia | Airline | Priority 1 | In progress | 87 (5/9) | Officially documented regional operations and Iberia franchise; [company profile](https://www.airnostrum.es/en/aboutus/descripciongeneral/) |
| 4 | Globalia Handling (Groundforce) | Spain / Llucmajor | Ground handling | Priority 1 | Researched | 100 (5/9) | Published passenger, ramp, operations and cargo services; [Groundforce services](https://groundforce.aero/en/services/) |
| 5 | Avolon | Ireland / Dublin | Aircraft lessor | Priority 1 (tied) | In progress | 95 (5/9) | Aircraft leasing and Dublin office; [Avolon contact](https://www.avolon.aero/contact) |
| 6 | Binter Canarias | Spain / Telde | Airline | Priority 2 | Needs verification | 80 (5/9) | First-party aircraft fleet profile; exact headquarters remains to confirm; [official fleet page](https://www.bintercanarias.com/en/corporative/fleet) |
| 7 | Volotea, S.L. | Spain / Barcelona | Airline | Priority 2 | Researched | 87 (5/9) | Official company profile and Impressum distinguish Barcelona operational headquarters from Castrillón registered address; [official Impressum](https://www.volotea.com/de/gesetzliche-bedingungen/impressum/) |
| 8 | AERTEC Solutions | Spain / Malaga | Aviation consultancy | Priority 2 | Needs verification | 80 (5/9) | Aeronautical, airport and defence expertise; [AERTEC](https://aertecsolutions.com/en/) |
| 9 | Air France Industries KLM Engineering & Maintenance | France / Paris area | MRO | Priority 2 | Needs verification | 95 (5/9) | Group maintenance activity; business-unit contracting entity needs confirmation; [Air France-KLM maintenance](https://www.airfranceklm.com/en/our-strengths/aircraft-maintenance) |
| 10 | Dassault Falcon Service | France / Le Bourget | MRO | Priority 2 | Needs verification | 82 (5/9) | Subsidiary and maintenance service evidence; [Dassault Group profile](https://dassault.fr/en/subsidiary/dassault-falcon-service) |
| 11 | Lufthansa Technik AG | Germany / Hamburg | MRO | Priority 2 | Researched | 95 (5/9) | Official Hamburg headquarters and engine-repair activity; [headquarters](https://www.lufthansa-technik.com/en/headquarters) |
| 12 | MTU Maintenance Hannover | Germany / Langenhagen | MRO | Priority 2 | Needs verification | 89 (5/9) | Official engine-maintenance location; confirm exact contracting entity; [MTU site](https://www.mtu.de/about-us/mtu-worldwide/mtu-maintenance-hannover/) |
| 13 | TrueNoord | Netherlands / Amsterdam | Aircraft lessor | Priority 2 | In progress | 83 (5/9) | Officially states operating leases and Amsterdam office; legal seat not stated in reviewed sources; [company contact](https://www.truenoord.com/contact/) |
| 14 | AerCap Holdings N.V. | Ireland / Dublin | Aircraft lessor | Priority 1 (tied) | Researched | 95 (5/9) | Official leasing profile and Dublin HQ, with Amsterdam office separately disclosed; [company profile](https://www.aercap.com/investors/about-aercap) |
| 15 | Atitech S.p.A. | Italy / Naples | MRO | Priority 2 | In progress | 90 (5/9) | Official MRO services and three Italian bases; [Atitech](https://www.atitech.it/) |
| 16 | Air Corsica | France / Ajaccio | Airline | Priority 3 | Needs verification | 82 (5/9) | Legal identity/seat from French government registry and official airline site; [registry entry](https://annuaire-entreprises.data.gouv.fr/entreprise/air-corsica-air-corsica-349638395) |
| 17 | Condor Flugdienst GmbH | Germany / Frankfurt | Airline | Priority 3 | In progress | 82 (5/9) | Company profile documents airline and own maintenance operation; Frankfurt is operating hub, not confirmed legal HQ; [Condor profile](https://condor-newsroom.condor.com/en/de/about-us/company-portrait/) |
| 18 | Fokker Services Group B.V. | Netherlands / Hoofddorp | MRO | Priority 3 | In progress | 90 (5/9) | Official MRO capability and facility profile; confirm current legal seat; [About Fokker Services Group](https://fokkerservicesgroup.com/about-us) |
| 19 | Menzies Aviation (John Menzies Limited) | United Kingdom / Edinburgh | Ground handling | Priority 3 | Researched | 90 (5/9) | Official terms state the Scottish registered office; [Menzies terms](https://menziesaviation.com/terms/) |
| 20 | TAP Air Portugal, S.A. | Portugal / Lisbon | Airline | Priority 3 | Researched | 77 (5/9) | Official terms confirm Portuguese legal form and Lisbon Airport HQ; [TAP terms](https://www.flytap.com/en-us/legal-info/terms-and-conditions) |

See the dataset’s per-account `sources` list for source title, URL, publication date where available, research date, supported claims and confidence. Publication dates were not consistently stated by source pages; these are recorded as `null`, not guessed.

## Priority groups and commercial workflow

### Priority 1 — begin discovery first

ITP Aero, Iberia, Air Nostrum, Globalia Handling / Groundforce, and the tied lessor candidates Avolon and AerCap. This is five discovery slots across six account candidates.

The rationale is direct aviation relevance, official evidence of a current business activity that plausibly creates contract obligations, and the Spain-first strategy. Avolon and AerCap are tied for the fifth slot: both have the same nine-factor ratings and 95 partial scores, and the cited material supports no difference in commercial accessibility. None is a qualified opportunity. The recommended first step for each is human-reviewed outreach via the official company channel, followed by a discovery conversation only if accepted.

### Priority 2 — credible targets; resolve gaps or sequence after initial wave

Binter Canarias, Volotea, AERTEC, AFI KLM E&M, Dassault Falcon Service, Lufthansa Technik, MTU Maintenance Hannover, TrueNoord and Atitech.

The primary reasons for deferral are location/contracting-entity uncertainty, lower country rank, or no known buyer access—not evidence that the companies lack fit.

### Priority 3 — later geographic wave or identity verification first

Air Corsica, Condor, Fokker Services Group, Menzies Aviation and TAP Air Portugal.

These are not rejected. They are later in the specified country order, or the documented city is an operating site rather than a confirmed legal headquarters. Revalidate the contracting entity before outreach.

## Fit rubric and interpretation

The existing nine criteria and weights are reused unchanged: contract complexity (1.3), likely contract volume (1.2), aviation relevance (1.5), potential financial exposure (1.3), operational complexity (1.2), geographic priority (1.0), identifiable decision-makers (1.1), evidence quality (1.4) and commercial accessibility (1.0).

For this portfolio, five criteria are assessed per account: aviation relevance, evidence quality, geographic priority, and hypothesis-labelled contract and operating complexity. **Contract volume, financial exposure, named decision-maker access and commercial accessibility remain Unknown** for every record. The same five factors are assessed for every account: 5/9 criteria (55.6% by count) and 6.4/11.0 rubric weight (58.2%). Every displayed score is explicitly labelled `5/9`; these are comparable only as partial averages of the same assessed factors, not as complete nine-factor account-fit or readiness scores. The existing score function calculates a weighted mean over assessed criteria and does not penalize Unknown criteria. The rubric, weights and ratings are unchanged; no Unknown factor has been imputed. Therefore:

- Scores are partial-evidence triage aids, not complete account-fit ratings.
- A score such as 100 for Groundforce means only that all five assessed ratings are High; four other criteria remain Unknown.
- No score is a sales probability, revenue estimate, customer need, qualification or commitment.
- Priority groups are a separate human commercial judgement and are not automatically assigned by the score.
- Every fit rationale distinguishes verified source facts from hypotheses.

The import data sets `accountStatus` to `Target`, not `Qualified`; no sales opportunity, contact, discovery interview, pilot or revenue record is created. Research status uses only existing OCI values: `Researched` for sufficiently evidenced core identity/activity/location; `In progress` where core activity is supported but material review remains; and `Needs verification` where a material identity, contracting-entity, location or source gap remains. No account is `Not researched` because each has substantive source review.

## Contract Intelligence opportunity hypotheses

Only current core capability classes are proposed: obligation extraction, deadline/condition identification, financial-term and risk review, and source-linked evidence. Proposed pilot scopes are deliberately limited to approved customer-selected contract samples with a human-reviewed reference set. The customer would set the sample, data permissions and measurable success criteria before any pilot.

Illustrative agreement categories are hypotheses tied to published operations:

- Airlines: potentially relevant lease/acquisition, maintenance, fuel, handling and supplier agreements.
- Lessors: operating leases are verified as a business category where the company publishes them; specific obligations, portfolios and customer contracts were not reviewed.
- MRO: maintenance, engine, component, parts and support agreements.
- Ground handlers: passenger, ramp, cargo, operations/load-control service agreements.
- Consultancy: project statements of work, deliverables, milestones and subcontractor agreements.

These are not claims that a company holds a particular contract, has a contractual problem, or has a specific financial exposure. No Digital Twin or predictive simulation capability is presented as an operational product.

## Decision-maker research

No individual contact has been entered. The reviewed public material did not establish a named professional in a relevant contract, procurement, finance, maintenance, fleet or operations buying role with sufficient evidence to classify that person as a prospect contact. Generic public company contact pages are not treated as decision-maker identities.

Each account instead records one plausible entry department, `stakeholderStatus: "Unknown stakeholder"`, and an explicit note that the role is a hypothesis and the individual is unknown. The dataset `contacts` arrays are empty. This avoids invented names, titles, email addresses, phone numbers and contact-account relationships.

## Evidence quality and known gaps

- First-party sources were preferred; government company registry information is used for Air Corsica.
- Official-source confidence is High for company identity and the published aviation activity where first-party pages were available. Medium confidence is used where location or segment relies on a directory/association or the first-party page was inaccessible.
- All source dates are explicit: research date `2026-11-01`; publication date is unknown (`null`) unless the source states one.
- Iberia's site returned an access block to the research client; group reporting was used, and the current legal seat should be rechecked.
- Direct page retrieval also returned access blocks/timeouts or partial rendering for some official AFI KLM E&M, MTU, Dassault Falcon Service, ITP Aero MRO and French company-registry URLs. Their official URLs and indexed content were cross-checked where available; re-open these sources during import review.
- Binter's fleet is first-party verified, but Telde HQ relies on a third-party local listing and is flagged for confirmation.
- AERTEC is described as an aeronautical technology/engineering company; its consultancy segment is supported by an industry association profile, not solely by its own label.
- AFI KLM E&M is represented as a group MRO business unit; confirm the correct contracting entity before creating an account.
- Dassault Falcon Service is a subsidiary; its parent Dassault Aviation is not separately listed.
- Lufthansa Technik is included without Lufthansa airline; Condor Technik is not separately listed from Condor.
- Air Nostrum operates as a separate airline under an Iberia franchise; it is not represented as an Iberia subsidiary.
- TrueNoord's Amsterdam office is confirmed, but the reviewed pages do not establish its legal headquarters.
- MTU Maintenance Hannover and Condor are represented with operating locations where the reviewed pages did not establish legal headquarters.
- Menzies' site terms establish John Menzies Limited's registered office; confirm which current legal entity would contract after ownership changes.
- Fleet quantities, financials, contract volumes, procurement events, exposure, conversion likelihood and contact details are not invented or used as verified commercial facts.

## OCI integration and import readiness

The existing OCI account schema supports the required identity, website, country/city, headquarters, operating locations, segment, description, contract activity/use-case notes, departments, source, research date, confidence, research status, stakeholder status and all nine fit fields. The existing geography system uses ISO country codes and explicitly distinguishes Europe, EU, EEA and UK. The existing fit rubric and score function are unchanged.

No bulk-import endpoint was found in the reviewed OCI workflows. The JSON is therefore **staging/import-ready, not directly imported**:

1. Each `records[n].data` object is an account payload accepted by the current `validateOciData("accounts", ...)` contract.
2. `records[n].sources` and `records[n].assessment` remain evidence and commercial research envelopes; do not send them as account fields. Each structured source's title, URL, publication date (or not-stated marker), research date, supported claims and confidence is also serialized into the existing `data.source` notes field (well below its 4,000-character contract limit). Geography source/confidence, country code, research date and record confidence remain in supported account fields. The OCI schema has no structured source-array field; the remediated JSON retains that richer register alongside the serializable notes.
3. Before any authorized manual import, query the target OCI environment for existing account names/country identities and resolve matches through the normal application workflow. Duplicate checking here is only within this 20-record portfolio; no live OCI records were queried.
4. Reconfirm flagged headquarters/legal entities and human-review all hypotheses. Do not create contacts or opportunities from this dataset alone.

The payload was checked offline against the current OCI account validator for all 20 records, including required source/date, geography, select values and fit rationale. This does not constitute a database import, duplicate check against live records, or production verification.

## Safety and change record

- Source files retained unchanged:
  - [oci-europe-aviation-prospect-portfolio-2026-11-01.md](./oci-europe-aviation-prospect-portfolio-2026-11-01.md)
  - [oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json)
- No existing OCI records were overwritten: no records were imported or modified.
- No production database was accessed.
- No OCI application code, authentication, MFA, TLS, migrations or deployment settings were modified.
- No commit, push, merge, rebase or deployment was performed.
- Current OCI branch and baseline are preserved; Increment A–E work remains untouched.


## Remediation status

- Volotea's official Impressum now distinguishes Barcelona operational headquarters from the Castrillón registered address; account city/location follows the documented headquarters.
- All 20 research statuses were reassessed using only the existing OCI enum. The status and reason are shown per account above and retained in the account payload.
- Fit ratings and rubric weights were not changed. All 20 rows show partial-score coverage; Unknown criteria remain Unknown.
- Avolon and AerCap have identical ratings and score, and both are Priority 1 tied for the fifth discovery slot.
- The full source register is preserved structurally in the JSON and its complete citation details are included in each OCI-compatible `data.source` field. Source publication dates remain explicitly not stated where unavailable.
- No account was removed or replaced; no contacts, customer needs, or qualified opportunities were invented.
