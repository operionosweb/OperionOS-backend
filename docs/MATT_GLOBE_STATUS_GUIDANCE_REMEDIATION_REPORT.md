# Matt Globe and status guidance remediation

Date: 2 November 2026. Implemented and tested locally.

## Defects and precise corrections

1. The prepared guide scored generic words equally with topic words. "How does
   the Globe work?" selected unrelated contract guidance; an operational-status
   question retrieved only Demo aviation.
   [The guide](../shared/mattPreparedGuide.js) now ignores a small set of generic
   question words, weights reviewed titles, and returns all maintained entries
   for capability-status overview requests. It remains explicitly **prepared,
   not generated AI**. Evidence questions now prioritize evidence/reports.
2. The tracking page emitted an `aircraft`/nested `aviation` payload while the
   floating assistant expected `flight`. Its update event was not emitted on
   deselection. The [tracking page](../frontend/src/routes/demo/AviationIntelligenceMap.jsx)
   now includes the shared `flight` field in open/update events, including null,
   preserving its other existing payload fields.
3. Closing an aircraft infocard hid the card but retained the selected aircraft
   and Matt context. [FlightOperations](../frontend/src/components/aviation/FlightOperations.jsx)
   now clears selection on that explicit close and emits null context on
   unmount. The tracking page also accepts null selection from that component.
   This is an intentional behavior change: closing the selected aircraft now
   deselects it instead of leaving invisible active context.
4. [Main Matt](../frontend/src/routes/Matt.jsx) waits for a loaded flight's ID
   to match the requested ID, preventing an old flight from rendering as the
   newly requested flight during asynchronous selection changes.

## What the actual browser verified

The new test uses the real local Demo page, fleet controls and Matt components:

- Select aircraft 001; the page's Ask Matt opens floating Matt on 001.
- Ask for exposure; the prepared answer retains illustrative/fictional limits.
- Close Matt, select aircraft 002 and reopen: current context is 002 and the old
  answer is not carried into it.
- Expand: full Matt's URL and context remain aircraft 002.
- Return to tracking, select and close an aircraft: reopening Matt does not
  retain that aircraft.
- Select an aircraft and navigate to Contracts: reopening Matt does not retain
  the Globe aircraft.

Existing tests additionally verify selected prepared flight IDs travel through
the shared live request path, and that changing prepared flights clears
server-side history. Server context resolution rejects unknown IDs; it never
falls back to a customer lease.

## Truth/status boundaries

The [reviewed knowledge](../shared/operionPlatformKnowledge.js), now version
`2026-11-02-platform-v2`, distinguishes:

| Information | Required interpretation |
|---|---|
| Demo flights and scenarios | Fictional/prepared; not observed live telemetry |
| Scenario dates | Prepared dates, not current observations |
| Delay hypotheticals | Assumed arithmetic; not a new factual delay |
| Estimated exposure | Supported assumptions, not invoices, liability or measured savings |
| Historical/live claims | Require dated supplied sources; otherwise unavailable |
| Missing telemetry, amounts or attribution | Unknown/unavailable; no invented routes, relationships or figures |
| Local implemented code | Not automatically operational/provider accepted |
| Configuration-required capability | Explicit approvals/configuration/device evidence still needed |
| Prediction/general simulation | Roadmap, not accepted production functionality |

The operational-status answer includes every reviewed entry and its status,
not only the Demo aviation entry. It does not certify every referenced feature.

## Validation

- New pure guide tests cover Globe, evidence, ingestion, reports and status
  overview source selection and prepared labels.
- Browser guide tests verify the exact previously failing Globe/status
  questions and visible limitations.
- Final browser group: **41/41**; final focused unit/protocol group: **82/82**.
- No generated model truth/entailment, real telemetry or provider lip-sync
  evaluation was performed.
