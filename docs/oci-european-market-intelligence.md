# OCI European aviation market intelligence - Increment C

Increment C builds on the shared Europe-first geography and Command Centre
described in [oci-geography.md](./oci-geography.md). It adds evidence-led account
research, explainable commercial fit, and a manual handoff from market research
to customer discovery. It does not populate accounts, qualify opportunities,
create pilots, or claim market coverage that is not present in stored records.

## Research and account model

Account records support the existing evidence classification, public source,
research date, confidence, geography, provenance, and account status, plus
research status, headquarters, operational locations, website, description,
fleet/aircraft portfolio and its source, contract-intensive activities and
source, potential Contract Intelligence use cases and basis, and potential
decision-making departments and basis. These fields are prompts for sourced
research, not verified company facts by virtue of being present.
Marking account or market research `Researched` requires a source reference and
research date; research status does not itself imply that every assertion is
verified.

Market intelligence records have a separate research status and retain their
own research coverage and evidence. Coverage is not a company location.
Research can be linked to an account; related discovery, contacts, opportunities,
pilots, activities, and revenue continue to inherit company geography only
through their linked account. Existing source, date, classification, confidence,
and data-origin values remain distinct.

The initial aviation segments remain the shared OCI contract values: airlines,
aircraft leasing, MRO, aviation consultancy, ground handling, airport operator,
and aviation supplier. The interface does not create segment records or make
unresearched organisations appear in the database.

## Account-fit rubric

The account-fit rubric is an explainable triage aid, not a probability of sale,
market-size estimate, verified customer need, or qualification decision. It
assesses the following factors with fixed relative weights:

| Factor | Weight |
|---|---:|
| Contract complexity | 1.3 |
| Likely contract volume | 1.2 |
| Aviation relevance | 1.5 |
| Potential financial exposure | 1.3 |
| Operational complexity | 1.2 |
| Geographic priority | 1.0 |
| Identifiable decision-makers | 1.1 |
| Evidence quality | 1.4 |
| Commercial accessibility | 1.0 |

Each factor is recorded as Unknown, a Low/Medium/High hypothesis, or a
Low/Medium/High evidence-labelled verified assessment. A verified-labelled
factor requires a public source and last-researched date; every assessed factor
requires written fit rationale. The weighted average maps Low/Medium/High to
1/2/3 and normalizes to 0-100. A number is shown only when at least three
factors are assessed and rationale is recorded. The view also displays assessed,
verified-labelled, hypothesis, and unknown counts. The rubric does not change
the separately maintained account priority or sales status.

“Verified” here describes a human-entered assessment with a cited source and
date; it is not an independent verification service. Hypotheses must stay
labelled as hypotheses. Unknown factors remain visible and are not treated as
negative evidence.

## Research-to-discovery handoff

An account-linked market research record can seed a new discovery record. The
handoff carries the account relationship and a reference containing the
research title, source, research date, and an explicit statement that the
finding remains a hypothesis until customer validation. It does not copy
research into interview evidence, set a customer-validated classification,
create a sales opportunity, or create a pilot.

Discovery remains a separate human workflow for interview status and date,
participants, problems, existing solutions, current process, severity and
impact, buying signals and timeline, Contract Intelligence needs, objections,
validated use cases, and validation evidence. Customer-validated discovery
requires recorded validation evidence. Command Centre problem counts further
require an identified problem; potential-pilot indicators additionally require
Contract Intelligence needs and a validated use case. These indicators do not
create a pilot or assert a commercial commitment.

## Command Centre indicators

Increment C adds persisted-record groupings for evidence-verification status,
high-priority European target accounts, target accounts awaiting research or
verification, customer-validated problems, and potential pilot candidates.
Country and origin groupings use available stored records; absent origins remain
Unclassified. The high-priority account list is bounded and filters to explicit
High priority, target status, and geographical Europe. No organisation,
statistic, interview, problem, or pilot candidate is synthesized by the
application.

The verification summary calls an account Verified only when its classification
is `Verified fact` and both source and research date are present; all other
records are grouped as unverified/insufficient evidence. This summary covers
accounts in scope, not only targets. A declared classification and source are
still administrator-entered data, not a third-party validation guarantee.

## Scope and limitations

- Research is manual; no web scraping, contact enrichment, scoring automation,
  or third-party verification is performed.
- Fleet/aircraft portfolios, locations, contract activities, potential use
  cases, departments, and fit evidence remain user-supplied and should cite
  sources where applicable.
- Existing duplicate-account identity remains normalized name plus the legacy
  country value. Geographic metadata does not change that key.
- No migration or database-schema change is required; the additions use the
  existing JSON record payload and shared browser/server validation contract.
- Database-derived dashboard grouping behavior requires the configured OCI
  database and is not end-to-end validated by offline tests.
