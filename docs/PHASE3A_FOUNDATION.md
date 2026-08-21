# Phase 3A Foundation

Phase 3A establishes the canonical Contract Intelligence persistence and validation boundary without executing AI extraction.

## Boundary

Production analysis will consume `document_version_id` and `analysis_run_id`. The Phase 2 `Document`, `DocumentVersion`, `document_version_extractions`, and `AnalysisRun` lifecycle remains authoritative.

## Migration

`003_phase3a_foundation.sql` adds page-aware source text, contract parties, immutable intelligence evidence, clauses, obligations, deadlines, risks, recommendations, evidence relationship tables, and full-text search chunks. It extends `analysis_runs` with Phase 3 metadata and states instead of replacing the table.

All Phase 3 records carry organization scope. Composite foreign keys prevent relationships from crossing organizations. RLS provides organization-member read protection; service-role application paths must still apply explicit organization predicates.

## Immutability

Pages, findings, evidence, relationship rows, and search chunks are append-only. Historical results are tied to an AnalysisRun. A retry creates a new AnalysisRun instead of mutating historical results.

## State machine

`queued -> processing -> extracting -> analysing -> indexing -> completed`.

Active states may fail or be cancelled. Analysing/indexing may require review. Only failed runs may be retried, and retry creates a new run.

## Validation

Versioned Zod schemas live under `schemas/phase3/`. They reject invalid enums, confidence values, required fields, dates, provider failures without error codes, and completed provider results without output. Relative deadlines preserve their original expression and do not require an invented absolute date.

## Services and repositories

Phase 3A services live under `services/phase3/`; scoped Supabase repositories live under `repositories/phase3/`. Each repository requires a valid trusted organization scope and applies it to every request-path query.

## Provider boundary

`providers/ai/` contains provider-free structural adapters only. No provider SDK is imported and no network call is made in Phase 3A.

## Compatibility decisions

Legacy AI, copilot, Horizon, embedding, queue, and raw-text analysis paths remain untouched. They are not canonical Phase 3A paths and are not invoked by the new foundation.

## Limitations

No clause extraction, obligation extraction, deadline extraction, risk analysis, recommendations, embeddings, vector search, new routes, or live database migration application are included in Phase 3A local work.
