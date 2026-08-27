# Step 5 Obligation Intelligence

## Implementation

Step 5 extends the existing Phase 3C obligation foundation rather than creating a second engine. The existing atomic repository, evidence validation, organization scoping, identity, idempotency, and rollback behavior remain authoritative.

The explicit action is `POST /api/analysis-runs/:id/obligations/analyze`. It runs only after clause analysis has produced an AnalysisRun. `GET /api/analysis-runs/:id/obligations/estimate` reports the estimated AI Intelligence Budget and remaining organization budget without consuming it.

Before AI, deterministic preprocessing extracts and normalizes obvious actor, action, object, modality, condition, timing, trigger, frequency, and consequence signals. Mandatory, prohibited, discretionary, and conditional language remains distinct. Rights such as `may terminate` are not converted into mandatory obligations.

Semantic normalization uses the existing AI Gateway through `createGatewayObligationProvider`. The Gateway owns provider routing, budget enforcement, cache behavior, job lifecycle, and usage recording. The obligation engine has no provider SDK or HTTP calls.

## Data model and provenance

Migration `010_semantic_obligation_fields.sql` adds actor, action, object, beneficiary, condition, timing expression, consequence, modality, and metadata to the existing `obligations` table. Existing obligation types remain the bounded aviation-first taxonomy: payment, maintenance, insurance, compliance, termination, notification, delivery, redelivery, service_level, and other.

Each obligation remains scoped to organization, contract, contract version, clause, and AnalysisRun. Existing `obligation_evidence` links preserve the chain:

`contract -> version -> clause -> evidence -> source chunk`

AI output is schema validated, source evidence is resolved from the existing clause/evidence records, and every persisted obligation requires primary evidence. No source reference supplied by the provider can create a new or cross-tenant source.

## Economics and validation

The synthetic aviation fixture contains one maintenance clause and generates one obligation. The focused Gateway adapter test recorded one AI request, an estimated Intelligence Budget of 30, actual Intelligence Budget of 30, zero cache hits, and one cache miss. Existing Gateway tests continue to cover cache reuse, budget blocking, confirmation, tenant scope, and provider failure behavior.

The full suite passes: **125 backend tests**. The frontend production build passes. Changed-file diagnostics pass. `git diff --check` passes. The provider-boundary test passes as part of the full suite.

No full-document AI call is introduced. The existing Phase 3C stage loads clause records and their linked evidence only; the Gateway payload contains the bounded clause text, deterministic candidate, and evidence IDs. It never loads the complete contract text or unrelated chunks.

No deadlines, calendar events, reminders, risk scores, financial exposure, recommendations, or task workflows are created. Timing and trigger expressions are stored only as source-supported metadata for the next layer.

## Verification limits and Step 6 recommendation

Live Supabase RLS/storage/database verification remains pending because no dedicated non-production database is available. Production data was not used.

Step 6 should consume the stored `timing_expression`, `frequency`, `trigger_expression`, `condition`, source evidence, and contract-version scope to build a deterministic Deadline Intelligence layer. It should normalize relative expressions without inventing absolute dates, preserve ambiguity, and remain separate from risk scoring and notifications.
