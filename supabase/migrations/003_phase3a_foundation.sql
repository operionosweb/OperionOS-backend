-- Phase 3A canonical contract intelligence foundation.
-- This migration extends the Phase 2 document/version/analysis boundary.

alter table public.contracts
  add constraint contracts_id_organization_key unique (id, organization_id);
alter table public.documents
  add constraint documents_id_organization_key unique (id, organization_id);
alter table public.document_versions
  add constraint document_versions_id_organization_key unique (id, organization_id);
alter table public.analysis_runs
  add constraint analysis_runs_id_organization_key unique (id, organization_id);

alter table public.documents
  add constraint documents_contract_organization_fk
  foreign key (contract_id, organization_id)
  references public.contracts(id, organization_id)
  on delete cascade
  not valid;
alter table public.document_versions
  add constraint document_versions_document_organization_fk
  foreign key (document_id, organization_id)
  references public.documents(id, organization_id)
  on delete cascade
  not valid;
alter table public.analysis_runs
  add constraint analysis_runs_contract_organization_fk
  foreign key (contract_id, organization_id)
  references public.contracts(id, organization_id)
  on delete cascade
  not valid;
alter table public.analysis_runs
  add constraint analysis_runs_document_version_organization_fk
  foreign key (document_version_id, organization_id)
  references public.document_versions(id, organization_id)
  on delete cascade
  not valid;

alter table public.analysis_runs
  drop constraint if exists analysis_runs_status_check;
alter table public.analysis_runs
  add constraint analysis_runs_phase3_status_check
  check (status in (
    'queued', 'processing', 'extracting', 'analysing', 'indexing',
    'completed', 'failed', 'cancelled', 'requires_review'
  ));

alter table public.analysis_runs
  add column if not exists intelligence_schema_version text not null default 'phase3a-v1',
  add column if not exists extraction_version text,
  add column if not exists prompt_version text,
  add column if not exists provider text,
  add column if not exists model text,
  add column if not exists retry_count integer not null default 0;

alter table public.analysis_runs
  add constraint analysis_runs_retry_count_check check (retry_count >= 0);

create table if not exists public.document_version_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  page_number integer not null check (page_number > 0),
  text_content text not null default '',
  text_length integer not null default 0 check (text_length >= 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end >= 0),
  text_hash text check (text_hash is null or text_hash ~ '^[0-9a-f]{64}$'),
  extraction_status text not null default 'completed'
    check (extraction_status in ('queued', 'processing', 'completed', 'failed', 'requires_review')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (document_version_id, analysis_run_id, page_number),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade
);

create table if not exists public.contract_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  name text not null,
  normalized_name text not null,
  role text not null,
  party_type text,
  is_primary boolean not null default false,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (document_version_id, analysis_run_id, normalized_name, role),
  check (length(trim(name)) > 0),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade
);

create table if not exists public.intelligence_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  page_id uuid,
  page_number integer check (page_number is null or page_number > 0),
  excerpt text not null check (length(excerpt) > 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end >= 0),
  source_locator text,
  stage text not null,
  provider text,
  model text,
  prompt_version text,
  pipeline_version text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  ambiguity_reason text,
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (document_version_id, analysis_run_id, evidence_hash),
  check (char_end is null or char_start is null or char_end >= char_start),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (page_id, organization_id)
    references public.document_version_pages(id, organization_id) on delete restrict
);

create table if not exists public.clauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  parent_clause_id uuid,
  clause_number text,
  title text not null,
  category text not null,
  subtype text,
  source_text text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (document_version_id, analysis_run_id, clause_number),
  check (category in (
    'commercial/payment', 'pricing/escalation', 'maintenance',
    'delivery/redelivery', 'insurance', 'liability/indemnity',
    'termination/default', 'compliance/sanctions', 'operations/service levels',
    'confidentiality/data protection', 'renewal/notice',
    'governing law/dispute resolution', 'general'
  )),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (parent_clause_id, organization_id)
    references public.clauses(id, organization_id) on delete restrict
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  clause_id uuid not null,
  obligor_party_id uuid,
  counterparty_party_id uuid,
  description text not null,
  obligation_type text not null,
  trigger_expression text,
  conditionality text,
  frequency text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'identified'
    check (status in ('identified', 'requires_review', 'active', 'unclear')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (clause_id, organization_id)
    references public.clauses(id, organization_id) on delete cascade,
  foreign key (obligor_party_id, organization_id)
    references public.contract_parties(id, organization_id) on delete restrict,
  foreign key (counterparty_party_id, organization_id)
    references public.contract_parties(id, organization_id) on delete restrict
  ,check (obligation_type in (
    'payment', 'maintenance', 'insurance', 'compliance', 'termination',
    'notification', 'delivery', 'redelivery', 'service_level', 'other'
  ))
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  obligation_id uuid,
  deadline_type text not null,
  original_expression text not null,
  normalized_date timestamptz,
  range_start timestamptz,
  range_end timestamptz,
  anchor_event text,
  offset_value integer,
  offset_unit text,
  timezone text,
  ambiguity text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (obligation_id, organization_id)
    references public.obligations(id, organization_id) on delete cascade
  ,check (deadline_type in (
    'fixed_date', 'relative_deadline', 'notice_period', 'renewal_date',
    'expiry_date', 'payment_deadline', 'delivery_date', 'redelivery_date',
    'maintenance_deadline', 'inspection_deadline', 'cure_period'
  )),
  check (range_start is null or range_end is null or range_start <= range_end),
  check (offset_unit is null or offset_unit in ('hours', 'days', 'weeks', 'months', 'years')),
  check (deadline_type <> 'relative_deadline' or (
    anchor_event is not null and offset_value is not null and offset_unit is not null
    and normalized_date is null
  )),
  check (deadline_type <> 'fixed_date' or normalized_date is not null)
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  clause_id uuid,
  risk_category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  probability numeric(5,4) check (probability is null or probability between 0 and 1),
  impact text,
  exposure text,
  score numeric(6,3) check (score is null or score between 0 and 100),
  risk_drivers jsonb not null default '[]'::jsonb,
  explanation text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  check (risk_category in (
    'liability', 'indemnity', 'insurance', 'payment/commercial',
    'maintenance/operational', 'delivery/redelivery', 'termination/default',
    'compliance/sanctions', 'data protection/confidentiality',
    'service-level/performance', 'missing protection'
  )),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (clause_id, organization_id)
    references public.clauses(id, organization_id) on delete restrict
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  risk_id uuid,
  clause_id uuid,
  recommendation_type text not null,
  action text not null,
  business_rationale text not null,
  urgency text not null default 'medium'
    check (urgency in ('low', 'medium', 'high', 'critical')),
  owner_role text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'requires_review', 'rejected')),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade,
  foreign key (risk_id, organization_id)
    references public.risks(id, organization_id) on delete restrict,
  foreign key (clause_id, organization_id)
    references public.clauses(id, organization_id) on delete restrict
  ,check (recommendation_type in (
    'review', 'renegotiate', 'clarify', 'assign_owner',
    'monitor_deadline', 'confirm_compliance', 'escalate'
  ))
);

create table if not exists public.contract_search_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  text_content text not null,
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end >= 0),
  page_start integer check (page_start is null or page_start > 0),
  page_end integer check (page_end is null or page_end > 0),
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  index_status text not null default 'queued'
    check (index_status in ('queued', 'ready', 'failed')),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(text_content, ''))
  ) stored,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (document_version_id, analysis_run_id, chunk_index),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id)
    references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete cascade
);

create table if not exists public.clause_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  clause_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (clause_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (clause_id, organization_id)
    references public.clauses(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create table if not exists public.obligation_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  obligation_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (obligation_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (obligation_id, organization_id)
    references public.obligations(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create table if not exists public.deadline_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  deadline_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (deadline_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (deadline_id, organization_id)
    references public.deadlines(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create table if not exists public.risk_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  risk_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (risk_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (risk_id, organization_id)
    references public.risks(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create table if not exists public.recommendation_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  recommendation_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (recommendation_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (recommendation_id, organization_id)
    references public.recommendations(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create table if not exists public.party_evidence (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  party_id uuid not null,
  evidence_id uuid not null,
  rank integer not null default 1 check (rank > 0),
  support_type text not null default 'supports',
  is_primary boolean not null default false,
  primary key (party_id, evidence_id),
  check (support_type in ('supports', 'contradicts', 'context')),
  foreign key (party_id, organization_id)
    references public.contract_parties(id, organization_id) on delete cascade,
  foreign key (evidence_id, organization_id)
    references public.intelligence_evidence(id, organization_id) on delete cascade
);

create index if not exists phase3_pages_scope_idx
  on public.document_version_pages (organization_id, document_version_id, page_number);
create index if not exists phase3_parties_scope_idx
  on public.contract_parties (organization_id, contract_id, normalized_name);
create index if not exists phase3_evidence_scope_idx
  on public.intelligence_evidence (organization_id, document_version_id, analysis_run_id);
create index if not exists phase3_clauses_scope_idx
  on public.clauses (organization_id, document_version_id, category);
create index if not exists phase3_obligations_scope_idx
  on public.obligations (organization_id, document_version_id, obligation_type);
create index if not exists phase3_deadlines_scope_idx
  on public.deadlines (organization_id, document_version_id, deadline_type);
create index if not exists phase3_risks_scope_idx
  on public.risks (organization_id, document_version_id, risk_category, severity);
create index if not exists phase3_recommendations_scope_idx
  on public.recommendations (organization_id, document_version_id, urgency);
create index if not exists phase3_chunks_scope_idx
  on public.contract_search_chunks (organization_id, document_version_id, chunk_index);
create index if not exists phase3_chunks_search_idx
  on public.contract_search_chunks using gin (search_vector);

create or replace function public.prevent_phase3_result_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Phase 3A records are immutable';
end;
$$;

create or replace function public.prevent_analysis_run_invalid_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('completed', 'cancelled') then
    raise exception 'terminal analysis runs are immutable';
  end if;

  if not (
    (old.status = 'queued' and new.status in ('processing', 'failed', 'cancelled')) or
    (old.status = 'processing' and new.status in ('extracting', 'failed', 'cancelled')) or
    (old.status = 'extracting' and new.status in ('analysing', 'failed', 'cancelled')) or
    (old.status = 'analysing' and new.status in ('indexing', 'failed', 'cancelled', 'requires_review')) or
    (old.status = 'indexing' and new.status in ('completed', 'failed', 'cancelled', 'requires_review')) or
    (old.status = 'failed' and new.status = 'processing')
  ) then
    raise exception 'invalid analysis run transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_analysis_run_invalid_transition on public.analysis_runs;
create trigger prevent_analysis_run_invalid_transition
  before update on public.analysis_runs
  for each row execute function public.prevent_analysis_run_invalid_transition();

-- Result records and evidence are append-only. Human review creates a new run/result
-- rather than mutating historical intelligence in this foundation phase.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'document_version_pages', 'contract_parties', 'intelligence_evidence',
    'clauses', 'obligations', 'deadlines', 'risks', 'recommendations',
    'contract_search_chunks', 'clause_evidence', 'obligation_evidence',
    'deadline_evidence', 'risk_evidence', 'recommendation_evidence', 'party_evidence'
  ] loop
    execute format('drop trigger if exists prevent_phase3_update on public.%I', table_name);
    execute format(
      'create trigger prevent_phase3_update before update on public.%I for each row execute function public.prevent_phase3_result_update()',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists phase3_member_select on public.%I', table_name);
    execute format(
      'create policy phase3_member_select on public.%I for select using (public.is_organization_member(organization_id))',
      table_name
    );
  end loop;
end;
$$;

