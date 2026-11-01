# OCI Europe — staging target and account duplicate review

**Review date:** 2026-11-01
**Scope:** Read-only inspection of the requested OCI Europe worktree, final-acceptance report, remediated portfolio, deployment/configuration files and OCI account workflow. No application, database, DNS, authentication or deployment service was contacted.

## Final recommendation

**NOT READY — STAGING ENVIRONMENT UNCONFIRMED.**

The repository describes an intended OCI application host and implements a validated single-account creation route. It does not positively identify a currently deployed, isolated staging frontend, backend, identity provider and database. No approved non-production account inventory was available. Therefore the 20 proposed accounts cannot be classified as new, matched or related to destination records. Every candidate is **MANUAL REVIEW**, has no verified existing OCI record reference, and is not approved for creation.

Do not use the locally configured legacy endpoint as an OCI target. No connection was made to any backend, Supabase project, production system or database.

## Staging environment identification

| Question | Finding | Evidence and limitation |
|---|---|---|
| Dedicated staging OCI environment exists? | **Not established.** | The deployment guide describes a separate OCI Vercel project as an operator setup step, not a confirmed staging deployment. No staging hostname, environment name, deployment identifier or approved staging inventory is present in the inspected repository files. |
| Intended OCI application URL? | `https://oci.operionos.com` is the documented **intended OCI host**, not a verified staging URL. | [OCI deployment guide](./oci-deployment.md) says this is the intended host and identifies `app.operionos.com` as a future customer host. It does not designate `oci.operionos.com` as an isolated staging deployment. |
| Intended OCI backend destination? | **Unconfirmed.** | The OCI client requires `VITE_API_BASE_URL` and calls `/api/oci` on that configured HTTPS base. The OCI frontend example leaves this value blank. No approved staging API origin is documented. The repository's local root `.env` has legacy `VITE_API_URL`, which the OCI client does not read; that variable is not proof of an OCI or staging backend. |
| Separate staging database from production? | **Unverified.** | The OCI deployment guide says the OCI repository uses a dedicated lazy PostgreSQL pool and a configured `DATABASE_URL`; it does not prove that the configured URL, if any, points to a different project/database from production. The checked-in `.env.oci.example` contains placeholders only. No database URL was read, resolved or used. |
| Authentication and MFA configured? | **Code policy present; live configuration unverified.** | The backend verifies the Supabase session, confirmed email, role assignments and `aal2` MFA assurance. The frontend gates access on the access response. The deployment guide explicitly requires operator-side provider configuration and real acceptance tests. No provider console, user, role or MFA session was inspected. |
| Isolated test data present? | **Unverified; no approved dataset available.** | No staging account inventory or environment-specific fixture was supplied. The migration and offline tests are not evidence of live staging data isolation. |
| Account creation operational? | **Implemented in code; not verified live.** | The OCI UI submits a single record to the authenticated `POST /records/:kind` route. The service validates payloads before repository insertion. No live application sign-in or record creation was attempted. |
| Can environment be independently identified as non-production? | **No.** | No staging deployment/project identity, backend project reference, separate database identity or environment attestation was available. Hostname alone would not prove isolation, and no staging hostname was found. |

### Configuration and safety observations

- The OCI-specific examples are templates: [backend OCI environment example](../.env.oci.example) leaves provider/database values blank, and [frontend OCI environment example](../frontend/.env.oci.example) leaves API/provider values blank.
- The OCI frontend client requires `VITE_API_BASE_URL`; it permits the intended `oci.operionos.com` host or loopback, and rejects other browser hostnames. The current code does not establish a staging preview host.
- There is no local `.vercel` project linkage at the repository root or under `oci/`. The deployment guide says an independent OCI Vercel project must be created and the selected project verified by an operator.
- Root [.env](../.env) is tracked by Git even though [.gitignore](../.gitignore) contains an `.env` rule. Key names inspected were `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`; values were not disclosed in this report. These are legacy/public-client configuration names, not OCI's required API base setting. This tracked file does not establish staging isolation. An authorized owner should confirm the tracked value is only a public anon client key and contains no privileged material; no configuration was changed.
- The guide's earlier DNS note records a prior inspection, not a current DNS or deployment verification. No DNS lookup or external request was performed for this task.

## Account match review

The authoritative candidate is [the final remediated JSON](./oci-europe-aviation-prospect-portfolio-2026-11-01-remediated.json), reviewed alongside the [final acceptance report](./oci-europe-aviation-prospect-portfolio-final-acceptance-report.md). The machine-readable review is [oci-europe-staging-account-match-review.json](./oci-europe-staging-account-match-review.json).

**Destination comparison was not performed.** No staging database or approved non-production account export was available, and no database was queried. Thus:

- No existing account identifiers are available; each `existingAccountReference` is `null` because the destination was not checked, **not** because no record exists.
- No candidate is classified `NEW`, `EXACT MATCH`, or `RELATED ENTITY` without destination evidence.
- All 20 candidates are `MANUAL REVIEW`; aliases, domains, country and known corporate relationships are provided as comparison keys only.
- An identical domain or parent-company relationship alone is not sufficient to merge parent/subsidiary or affiliated accounts.

| # | Portfolio company | Country | Candidate alias / corporate relationship to check | Match result | Existing OCI reference |
|---:|---|---|---|---|---|
| 1 | IBERIA, Lineas Aereas de Espana, S.A. Operadora, Sociedad Unipersonal | Spain | Iberia; within International Airlines Group. Compare legal name and Iberia brand separately from group account. | MANUAL REVIEW | Not available — destination not checked |
| 2 | Air Nostrum Lineas Aereas del Mediterraneo, S.A. | Spain | Air Nostrum; Iberia franchise relationship is not evidence of subsidiary status. Do not merge on franchise alone. | MANUAL REVIEW | Not available — destination not checked |
| 3 | Industria de Turbo Propulsores, S.A. (ITP Aero) | Spain | ITP Aero; compare the legal name and trade name as one candidate identity. | MANUAL REVIEW | Not available — destination not checked |
| 4 | Globalia Handling, S.A.U. (Groundforce) | Spain | Groundforce is the service/trading brand for Globalia Handling; compare both names and do not create a second brand account if the legal entity exists. | MANUAL REVIEW | Not available — destination not checked |
| 5 | Binter Canarias, S.A. | Spain | Binter Canarias; compare legal name and Binter brand. | MANUAL REVIEW | Not available — destination not checked |
| 6 | Volotea, S.L. | Spain | Volotea; Barcelona operational HQ and Castrillón registered address are distinct location facts, not separate organizations. | MANUAL REVIEW | Not available — destination not checked |
| 7 | AERTEC Solutions, S.L. | Spain | AERTEC Solutions; compare the legal name and trading name. | MANUAL REVIEW | Not available — destination not checked |
| 8 | Air Corsica (AIR CORSICA) | France | Air Corsica; compare the corporate name and uppercase brand variant. | MANUAL REVIEW | Not available — destination not checked |
| 9 | Air France Industries KLM Engineering & Maintenance (AFI KLM E&M) | France | AFI KLM E&M; business-unit identity and contracting legal entity remain unresolved. Do not merge with Air France-KLM solely by affiliation. | MANUAL REVIEW | Not available — destination not checked |
| 10 | Dassault Falcon Service | France | DFS; subsidiary of Dassault Aviation. Keep parent and subsidiary distinct unless the destination record is demonstrably the same legal entity. | MANUAL REVIEW | Not available — destination not checked |
| 11 | Condor Flugdienst GmbH | Germany | Condor; Condor Technik is described as an operation, not a second candidate account. | MANUAL REVIEW | Not available — destination not checked |
| 12 | Lufthansa Technik AG | Germany | Lufthansa Technik; distinct MRO company from Lufthansa airline. Shared group association/domain must not trigger a merge. | MANUAL REVIEW | Not available — destination not checked |
| 13 | MTU Maintenance Hannover GmbH | Germany | MTU Maintenance Hannover; compare with MTU group/other legal entities without assuming they are identical. | MANUAL REVIEW | Not available — destination not checked |
| 14 | Fokker Services Group B.V. | Netherlands | Fokker Services Group; compare current legal entity and any legacy Fokker names. | MANUAL REVIEW | Not available — destination not checked |
| 15 | TrueNoord | Netherlands | TrueNoord; Amsterdam office is not proof of legal seat. | MANUAL REVIEW | Not available — destination not checked |
| 16 | AerCap Holdings N.V. | Ireland | AerCap; separately named Amsterdam group-services affiliate must not be conflated with the Dublin parent. | MANUAL REVIEW | Not available — destination not checked |
| 17 | Avolon Holdings Limited | Ireland | Avolon; compare legal name, brand and any existing group/office records. | MANUAL REVIEW | Not available — destination not checked |
| 18 | Menzies Aviation (John Menzies Limited) | United Kingdom | Menzies Aviation; John Menzies Limited is identified as the legal operator in the portfolio. Confirm current contracting entity and ownership context. | MANUAL REVIEW | Not available — destination not checked |
| 19 | Atitech S.p.A. | Italy | Atitech; compare legal name and trade name. | MANUAL REVIEW | Not available — destination not checked |
| 20 | TAP Air Portugal, S.A. | Portugal | TAP Air Portugal; compare corporate name and TAP brand. | MANUAL REVIEW | Not available — destination not checked |

No evidence supports reporting any existing account IDs. The full machine-readable candidate identity, geography, relationship notes, source pointers, review reason and null reference fields are in the JSON deliverable.

## Individual account creation and field retention

### Existing capability

The normal OCI interface and backend support **one account record per create request**. The OCI router exposes `POST /records/:kind`; the UI serializes the form and posts to that route. The service validates known account fields, geographic values and research-status enums, then the repository creates the record. The database migration defines an active-account uniqueness constraint on normalized account name plus country; a collision is surfaced as a duplicate conflict. This constraint does not identify aliases or related legal entities and does not replace the required human duplicate review.

### Retention through the account form/API

Fields in each portfolio `records[].data` payload correspond to OCI account fields and can be entered through the form/API, including:

- Company identity, website, country/country code, location, city, headquarters and operating locations.
- Segment, company type, description and documented/hypothesized activity/use-case notes.
- Account `priority` (High/Medium/Low), `accountStatus` (`Target`), `researchStatus`, classification, confidence, research date and geographic provenance.
- All nine fit-rating fields, `fitEvidence`, `nextAction`, and the account research/source note.

The available UI form and service must be used; do not send the outer `assessment` or `sources` envelopes because the account validator rejects unknown fields. The following research-only data is **not a dedicated OCI account field** and would not be retained as structured data by a payload-only create:

- `assessment.priorityGroup` and `priorityRationale` (the OCI `priority` field is only Low/Medium/High).
- `assessment.fitCoverage` and the portfolio score snapshot; the OCI interface can recalculate assessed/unknown count and score from the nine factor fields, but does not store the JSON coverage envelope.
- `assessment.commercialProblemHypothesis`, `currentOperionCapabilities`, `discoveryQuestion` and `pilotHypothesis` as separate typed fields. Some concepts overlap with `contractUseCases`, `decisionDepartments`, `fitEvidence` or `nextAction`, but they are not equivalent fields and must not be silently treated as preserved.
- Structured `records[].sources` and its source-to-claim mapping. Citation text is present in `data.source`, but source entries are not stored as structured source child records.

Keep the complete remediated JSON sidecar with any eventual staging batch. Preserve `data.source` notes and the supported geography/research provenance fields. Do not add a new module or schema field during this task.

## Recommended individual entry order

This is a sequence for review **after** staging is positively identified and a destination duplicate check has been recorded. It is not approval to create records now. Preserve the portfolio's account `priority` and research statuses. Every row below remains gated by MANUAL REVIEW.

1. **Priority 1 — first discovery group:** ITP Aero; Iberia; Air Nostrum; Globalia Handling (Groundforce); Avolon and AerCap as a tie. The two lessors have identical fit ratings and score; do not sequence one above the other without new evidence.
2. **Priority 2 — next group:** Binter Canarias; Volotea; AERTEC Solutions; AFI KLM E&M; Dassault Falcon Service; Lufthansa Technik; MTU Maintenance Hannover; TrueNoord; Atitech.
3. **Priority 3 — later group:** Air Corsica; Condor Flugdienst; Fokker Services Group; Menzies Aviation; TAP Air Portugal.

Within each group, resolve exact/legal-name and alias matches first. If a candidate maps to an existing account, stop and have an authorized human decide whether to skip or use the existing record. Do not automatically merge or create contacts/opportunities.

## Gates to change the recommendation

An authorized operator must provide evidence that identifies:

1. The dedicated OCI staging application/deployment and its expected application URL.
2. The corresponding OCI API origin, and confirmation it is not the production backend.
3. The Supabase project identity and database identity for staging, independently checked in the approved provider console; confirmation that both differ from production.
4. Staging-specific verified-email/MFA (`aal2`) and role configuration, plus isolated test data.
5. Read-only access to the authorized staging account list or an approved export, followed by human comparison of all 20 names, aliases, domains, country and parent/subsidiary relationships.

No settings, environment variables, authentication, deployment or records were changed. No production or staging system was accessed.

## Preservation

- Worktree remained on `dev/oci-europe-increment-a` at `8720815dcea6811326051166e41ba44d61395011`.
- Historical portfolios, audits, remediation report, final acceptance report, application code and all existing uncommitted Increment A–E work were left untouched.
- The only deliverables for this task are this report and [the account match review JSON](./oci-europe-staging-account-match-review.json).
