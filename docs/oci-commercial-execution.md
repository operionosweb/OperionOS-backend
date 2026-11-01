# OCI European commercial execution - Increment D

Increment D extends the existing OCI account, contact, discovery, opportunity,
pilot/proposal and revenue records. It adds no CRM module, database migration,
automatic outreach, external enrichment or customer commitments. Geography
continues to inherit from the linked account and the shared filter remains
Europe-first. See [oci-geography.md](./oci-geography.md) and
[oci-european-market-intelligence.md](./oci-european-market-intelligence.md).

## Opportunity execution

The default stage set now includes Target identified, Research completed, Initial
contact, Discovery scheduled, Discovery completed, Qualified, Product
demonstration, Pilot proposed, Commercial negotiation, On hold, Won and Lost.
Previously used stage labels remain available for compatibility with existing
records. A tenant's persisted stage settings remain authoritative.

Stage changes are still human edits; the application does not advance records
from activity or discovery state. Changes to an existing opportunity stage
require written evidence or rationale. Creating beyond the initial identified
stage also requires rationale. Won requires a commercial source and stage
rationale; Lost and On hold require their respective reasons. Existing account
and opportunity link validation, optimistic version checks, database
uniqueness, authenticated actor metadata and audit history are unchanged.

Opportunity records also support an internal owner annotation, expected
customer decision date (with legacy expected-close date retained), last
interaction, source/evidence, and stage-change rationale. The owner is a
human-entered name or role, not an authenticated assignment. Contacts already
link to both their account and an opportunity; contacts can record the
standardized aviation decision department and whether a person is verified
through interaction or publicly identified. Account records hold department
assessments for hypothesised and unknown stakeholders, without inventing a
person.

## Pilot and proposal execution

Draft offers can be prepared without claiming a customer commitment. Proposed
offers require a problem, Contract Intelligence use case, scope, deliverables,
timeline, price and basis, and measurable success criteria. Any stated contract
portfolio size requires its supplied-source or estimate basis. Capability
verification remains mandatory and human-entered.

The proposal lifecycle distinguishes draft/internal review/customer review/
acceptance/decline and internal approval. Customer-facing and accepted proposals
require recorded internal approval evidence; accepted proposals require
customer-decision evidence. Active or converted pilots require an evidenced
accepted proposal. These checks are records of human decisions, not an approval
workflow or signature verification service.

## Revenue classification and calculation

New revenue entries explicitly classify as:

- **Recognised actual** — Actual basis and ledger/source evidence.
- **Contracted future** — Forecast basis, agreement/commitment source, and
  period assumptions.
- **Committed pilot** — Forecast basis, written commitment source, and period
  assumptions.
- **Speculative forecast** — Forecast basis and explicit assumptions.

Previously unclassified entries remain visibly `Unclassified legacy` when
edited; this option is not available for new records. Actual recognition,
contracted/committed future revenue and speculative forecasts remain separate
records and classifications. The application does not infer a foreign-exchange
rate, turn opportunity value into revenue, or reconcile duplicate entries
automatically. Operators must record financial amounts once, in the correct
currency and period.

Unweighted opportunity pipeline sums open opportunity values within each
currency, country, segment and provenance group. On-hold, won and lost records
are excluded. Weighted pipeline is calculated as `value × recorded manual
probability / 100`, with probability assumptions required by validation. If any
open opportunity in a group lacks a recorded probability, that group's weighted
value is shown as unavailable rather than treating missing probability as zero.
Pipeline is not revenue. Revenue and recurring metrics remain grouped by
currency, classification, basis, period, country, segment and provenance;
periods and currencies are never combined. Legacy revenue without a class is
reported as `Unclassified legacy`.

The Command Centre's closed-opportunity win ratio is wins divided by current
Won + Lost records. It is labelled as a closed-record ratio, not a cohort
conversion rate; no historical stage-transition cohort is inferred. Revenue
summary counts are record counts, not currency-mixed value totals.

## Founder action centre

The action centre returns a bounded set of read-only recommendations, ordered
with overdue/near-term items first. Current rules surface explicit high-priority
targets awaiting research, sourced identified contacts without a contact
attempt, completed/follow-up discovery without a next action, qualified
opportunities with overdue follow-up, open opportunities near their expected
decision date, proposals awaiting a customer with missing/overdue follow-up,
and planned activities due within seven days.

Every item includes the triggering status/date rationale, related account and
available country/city/aviation segment, a source or recorded workflow-state
reference, a suggested human action, and Routine/Urgent indication. It never
sends messages, changes stage, schedules an activity, or claims a suggestion
was completed. Recommendations use the selected geographic context and only
stored records; missing provenance is shown as Unclassified.

## Scope and limitations

- The pipeline owner is a free-text internal annotation; owner identity,
  permissions and reassignment are not integrated with platform user records.
- Stage evidence and proposal approval/customer-decision evidence are human
  entries. OCI does not verify signatures, customer commitments or internal
  approvals independently.
- Opportunity contact links use the existing contact/account/opportunity
  relationship fields; no new contact-link mechanism is introduced.
- Weighted pipeline is unavailable for any grouping with incomplete manual
  probability coverage.
- Database-derived recommendations and financial groupings are exercised
  through offline SQL-contract and browser-fixture tests, not live-database
  acceptance. No production database was accessed.
- No migration is required; new fields use the existing validated JSON record
  payload. Existing unclassified revenue and legacy opportunity stages remain
  readable.

## Founder Action Centre - Increment E

The Founder Action Centre extends the existing `activities` records. It does
not add a task-management entity or a new navigation module. A recommendation
remains read-only until a Super Admin explicitly accepts it. The acceptance
endpoint rechecks the current source record and derives the rationale, evidence,
objective, and source relationship server-side; stale or ineligible
recommendations are rejected. A selected due date is a human-entered activity
date, not a forecast or customer commitment.

Accepted recommendations become activities with the source record ID, account
and opportunity relationships (where applicable), evidence snapshot, and a
stable recommendation identity. An advisory transaction lock and existence
check make acceptance idempotent across concurrent requests. Existing OCI
authorization, MFA, audit triggers, and optimistic version checks remain the
mutation boundary.

The stored lifecycle is:

- **Accepted** -> In progress, Completed, Dismissed, or Snoozed.
- **In progress** -> Completed, Dismissed, or Snoozed.
- **Snoozed** -> Accepted, In progress, Completed, or Dismissed.
- Completed and Dismissed are terminal.

Completion requires a completion date and outcome notes. Dismissal requires a
reason. Snoozing requires a future review date. Action status cannot be removed,
and action records cannot be archived through ordinary CRUD. A server-managed
status history stores state, timestamp, and actor ID; database audit events
continue to contain only the existing record/version metadata, not commercial
content.

The daily view groups active activities into overdue, today, upcoming, and
unscheduled actions, ordered by due/review date. A snoozed action is dated by
its review date; other actions use their due date or follow-up date. An
activity is shown as “Waiting for response” only when a human records a
completed meeting, call, or email with an outcome, follow-up date, and explicit
Awaiting external response status. Global actions and actions with unresolved
account geography remain visible and are labelled; resolved account geography
continues to obey the shared Europe-first filters.

Execution indicators use these definitions:

- Outstanding/overdue/today/next-seven-days counts use accepted, in-progress,
  snoozed, and legacy planned activities; dismissed and completed actions are
  excluded.
- Actions completed this month use completion dates from the first of the
  current calendar month through today.
- Follow-up completion rate is completed activities divided by non-cancelled
  activities due from the first of the current month through today. It is
  reported for the current month; OCI does not infer a historical cohort.
- Opportunity next-action counts use open opportunities and whether a
  next-action description is recorded.
- “Without recent activity” uses an explicit 30-calendar-day threshold against
  the last recorded interaction. Opportunities without an interaction date
  are not classified as stale.
- “Validated discoveries linked to opportunity” is a record count, not a
  discovery-to-opportunity conversion rate. No stage-transition cohort is
  stored.
- Proposal and pilot decision counts use their explicit stored statuses.

All action statuses and performance indicators are computed from persisted
OCI records. Synthetic records remain labelled by their provenance. The
dashboard reports remain offline-tested; this increment does not claim live
database acceptance, customer response verification, or financial conversion.
