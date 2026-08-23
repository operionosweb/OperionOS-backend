-- Phase 3C hardening gate: deterministic obligation identity + same-run idempotency.
--
-- This migration mirrors the proven Phase 3B clause identity pattern and adds
-- deterministic obligation identity for first-gate obligation extraction.
--
-- Canonical identity payload:
--   organization_id | analysis_run_id | clause_id | obligation_type | normalized_description
--
-- The normalized description is lowercase with collapsed whitespace so reruns
-- produce a stable identity for semantically equivalent obligation text.

alter table public.obligations
  add column if not exists obligation_identity text;

update public.obligations
   set obligation_identity = encode(
     digest(
       concat_ws(
         '|',
         organization_id::text,
         analysis_run_id::text,
         clause_id::text,
         obligation_type,
         lower(regexp_replace(btrim(description), '\\s+', ' ', 'g'))
       ),
       'sha256'
     ),
     'hex'
   )
 where obligation_identity is null;

alter table public.obligations
  alter column obligation_identity set not null;

alter table public.obligations
  drop constraint if exists obligations_obligation_identity_format_check;
alter table public.obligations
  add constraint obligations_obligation_identity_format_check
  check (obligation_identity ~ '^[0-9a-f]{64}$');

alter table public.obligations
  drop constraint if exists obligations_scope_identity_key;
alter table public.obligations
  add constraint obligations_scope_identity_key
  unique (organization_id, analysis_run_id, clause_id, obligation_identity);
