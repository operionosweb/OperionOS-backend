# Step 6 Deadline and Temporal Intelligence

## Architecture

Step 6 consumes persisted Step 5 obligations. It does not reload or reanalyse the full contract. `deadlineIntelligenceService.js` parses obligation descriptions and their stored timing, trigger, condition, and frequency fields into a controlled temporal model. `deadlineRepository.js` owns organization, contract, document, version, and AnalysisRun scoping and atomically persists deadlines with copies of the obligation evidence links.

The deterministic endpoint is `POST /api/analysis-runs/:id/deadlines/analyze`. Reads use `GET /api/analysis-runs/:id/deadlines`. The Contract Workspace exposes this as a normal software action, not an AI analysis action. Repeated unchanged runs use the deadline identity and do not duplicate records.

## Temporal model

The Step 6 taxonomy is `absolute`, `relative`, `recurring`, `event_based`, `conditional`, `ambiguous`, and `non_computable`. Migration `011_deadline_temporal_intelligence.sql` extends the existing deadlines and deadline evidence tables with scoped clause and evidence sources, structured timing, trigger, condition, duration, calendar, anchor, direction, recurrence, computability, status, calculation metadata, and deterministic identity.

The parser supports named and locale-qualified numeric dates; hours, calendar days, business days, weeks, months, and years; before, after, following, from, and prior-to directions; recurring daily through annual rules; flight-hour, flight-cycle, and maintenance-event recurrence; delivery, redelivery, acceptance, termination, execution, expiry, grounding, damage, maintenance, A-check, C-check, and regulatory-action events; and conditional deadlines.

Business days remain business days. `BusinessCalendar` accepts weekend, holiday, and jurisdiction configuration, but Step 6 supplies no global holiday database. Without an explicit calendar, no business-day date is calculated. Vague language such as promptly, immediately, without undue delay, and as soon as reasonably practicable remains ambiguous and receives no invented duration.

## Calculation and provenance

Absolute dates are calculated only from explicit dates or a deterministically resolved defined date. Effective Date, Execution Date, Delivery Date, and Termination Date definitions can be linked when the definition contains an unambiguous date. The result retains the anchor date, offset, unit, direction, method, resulting date, source clause, and source evidence. Missing anchors and calendars produce structured waiting states and reasons rather than fabricated dates.

Every deadline links to its organization, contract, document version, AnalysisRun, obligation, source clause, primary source evidence, and all inherited obligation evidence. Referenced definitions retain their own clause and evidence source in metadata.

## AI exception and economics

The default path performs no AI request and consumes zero AI Intelligence Budget. An opt-in fallback is available only for expressions classified as non-computable. It uses the existing AI Gateway with `clause_interpretation`, Mistral-first provider selection, Gateway budget enforcement, Gateway caching, structured output validation, and usage metrics.

Fallback input contains only the obligation fields, relevant clause, evidence IDs, and parser, prompt, schema, and taxonomy versions. There is no full-contract loading or payload field. Provider output cannot supply source IDs and is forced to retain a null absolute date.

## Security and limits

Server-side scope resolution precedes all reads and writes. Composite foreign keys and existing RLS policies preserve organization isolation, while the deadline identity includes the AnalysisRun and obligation identity for version isolation. Live Supabase migration and RLS verification remains pending until a dedicated non-production project is available.

Step 6 does not implement reminders, notifications, assignments, completion tracking, overdue state, calendar integrations, risk scoring, breach probability, exposure, or recommendations. Calendar-month arithmetic uses UTC platform semantics; jurisdiction-specific end-of-month rules require a future explicit policy. Cross-reference resolution is deliberately limited to simple named date definitions.