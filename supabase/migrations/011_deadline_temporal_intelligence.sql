alter table public.deadlines
  drop constraint if exists deadlines_deadline_type_check,
  drop constraint if exists deadlines_offset_unit_check,
  drop constraint if exists deadlines_deadline_type_check1,
  drop constraint if exists deadlines_deadline_type_check2;

alter table public.deadlines
  add column if not exists source_clause_id uuid,
  add column if not exists source_evidence_id uuid,
  add column if not exists timing_expression text,
  add column if not exists structured_timing jsonb not null default '{}'::jsonb,
  add column if not exists trigger_type text,
  add column if not exists trigger_expression text,
  add column if not exists condition text,
  add column if not exists amount integer,
  add column if not exists unit text,
  add column if not exists calendar_type text,
  add column if not exists absolute_date date,
  add column if not exists anchor_reference text,
  add column if not exists direction text,
  add column if not exists recurrence jsonb,
  add column if not exists computability text,
  add column if not exists status text not null default 'identified',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deadline_identity text;

alter table public.deadlines
  add constraint deadlines_temporal_type_check check (deadline_type in (
    'fixed_date', 'relative_deadline', 'notice_period', 'renewal_date', 'expiry_date',
    'payment_deadline', 'delivery_date', 'redelivery_date', 'maintenance_deadline',
    'inspection_deadline', 'cure_period', 'absolute', 'relative', 'recurring',
    'event_based', 'conditional', 'ambiguous', 'non_computable'
  )),
  add constraint deadlines_temporal_unit_check check (unit is null or unit in (
    'hours', 'days', 'business_days', 'weeks', 'months', 'years', 'flight_hours', 'flight_cycles'
  )),
  add constraint deadlines_calendar_type_check check (calendar_type is null or calendar_type in ('calendar', 'business')),
  add constraint deadlines_direction_check check (direction is null or direction in ('before', 'after', 'upon')),
  add constraint deadlines_computability_check check (computability in (
    'absolute', 'calculable', 'relative_event', 'awaiting_anchor', 'recurrence_rule', 'ambiguous', 'non_computable'
  )),
  add constraint deadlines_status_check check (status in (
    'identified', 'computable', 'awaiting_trigger', 'awaiting_date', 'ambiguous', 'calculated'
  )),
  add constraint deadlines_source_clause_fk foreign key (source_clause_id, organization_id)
    references public.clauses(id, organization_id) on delete cascade,
  add constraint deadlines_source_evidence_fk foreign key (source_evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete restrict;

create unique index if not exists deadlines_identity_scope_uidx
  on public.deadlines (organization_id, analysis_run_id, obligation_id, deadline_identity);

create index if not exists deadlines_contract_version_idx
  on public.deadlines (organization_id, contract_id, document_version_id, analysis_run_id);