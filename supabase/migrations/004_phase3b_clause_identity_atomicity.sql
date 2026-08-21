-- Phase 3B hardening gate: clause_identity column + idempotency constraint.
--
-- Defect found during forensic audit: deterministicClauseService.js computes and
-- inserts a `clause_identity` value for every clause row, but 003_phase3a_foundation.sql
-- never defined that column. A live insert against this schema would fail with an
-- "unknown column" error from PostgREST/Supabase. This migration adds the missing
-- column.
--
-- The column is left nullable (not backfilled, not NOT NULL) so this migration never
-- touches or rejects any pre-existing historical rows in an already-live database.
-- The deterministic clause pipeline always populates clause_identity for new rows,
-- so the uniqueness guarantee below is effective for all newly written data without
-- requiring any change to historical AnalysisRun records.
--
-- The existing `unique (document_version_id, analysis_run_id, clause_number)`
-- constraint does not protect unnumbered headings, preamble, or unstructured
-- segments, because clause_number is NULL for those rows and PostgreSQL treats
-- NULL as distinct in unique constraints. clause_identity is always non-null for
-- application-written rows, so a unique constraint on it closes the
-- check-then-insert (listByRun -> insert) race for concurrent duplicate stage runs.

alter table public.clauses
  add column if not exists clause_identity text;

alter table public.clauses
  drop constraint if exists clauses_clause_identity_format_check;
alter table public.clauses
  add constraint clauses_clause_identity_format_check
  check (clause_identity is null or clause_identity ~ '^[0-9a-f]{64}$');

alter table public.clauses
  drop constraint if exists clauses_document_version_run_identity_key;
alter table public.clauses
  add constraint clauses_document_version_run_identity_key
  unique (document_version_id, analysis_run_id, clause_identity);
