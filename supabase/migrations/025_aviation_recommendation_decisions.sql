-- Link deterministic aviation recommendations to their obligation and preserve
-- human decisions as append-only history without mutating Phase 3A findings.

alter table public.recommendations
  add column obligation_id uuid,
  add column source_risk_key text,
  add column recommendation_key text;

alter table public.obligations
  add constraint obligations_recommendation_scope_key
  unique (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id);

alter table public.clauses
  add constraint clauses_recommendation_scope_key
  unique (id, organization_id, contract_id, document_id, document_version_id, analysis_run_id);

alter table public.recommendations
  add constraint recommendations_obligation_organization_fk
  foreign key (obligation_id, organization_id, contract_id, document_id, document_version_id, analysis_run_id)
  references public.obligations(id, organization_id, contract_id, document_id, document_version_id, analysis_run_id)
  on delete restrict
  not valid;

alter table public.recommendations
  add constraint recommendations_clause_scope_fk
  foreign key (clause_id, organization_id, contract_id, document_id, document_version_id, analysis_run_id)
  references public.clauses(id, organization_id, contract_id, document_id, document_version_id, analysis_run_id)
  on delete restrict
  not valid;

alter table public.recommendations
  add constraint recommendations_id_organization_contract_key
  unique (id, organization_id, contract_id);

create unique index recommendations_run_key_uidx
  on public.recommendations (organization_id, analysis_run_id, recommendation_key)
  where recommendation_key is not null;

create table public.recommendation_decision_history (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  status text not null check (status in (
    'suggested', 'under_review', 'accepted', 'rejected', 'completed', 'superseded'
  )),
  actor_type text not null check (actor_type in ('system', 'human')),
  reviewer_user_id uuid references auth.users(id) on delete restrict,
  explanation text not null check (length(trim(explanation)) > 0),
  created_at timestamptz not null default now(),
  foreign key (recommendation_id, organization_id, contract_id)
    references public.recommendations(id, organization_id, contract_id)
    on delete restrict,
  unique (recommendation_id, sequence_number),
  check (
    (actor_type = 'system' and reviewer_user_id is null and status in ('suggested', 'superseded'))
    or (actor_type = 'human' and reviewer_user_id is not null
      and status in ('under_review', 'accepted', 'rejected', 'completed'))
  )
);

create index recommendation_decision_history_latest_idx
  on public.recommendation_decision_history
    (organization_id, recommendation_id, sequence_number desc);

create or replace function public.prevent_recommendation_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Recommendation history is append-only';
end;
$$;

create trigger prevent_recommendation_decision_history_mutation
  before update or delete on public.recommendation_decision_history
  for each row execute function public.prevent_recommendation_history_mutation();

create trigger prevent_recommendation_delete
  before delete on public.recommendations
  for each row execute function public.prevent_phase3_result_update();

create trigger prevent_recommendation_evidence_delete
  before delete on public.recommendation_evidence
  for each row execute function public.prevent_phase3_result_update();

alter table public.recommendation_decision_history enable row level security;

create policy recommendation_decision_history_member_select
  on public.recommendation_decision_history
  for select to authenticated
  using (public.is_organization_member(organization_id));
