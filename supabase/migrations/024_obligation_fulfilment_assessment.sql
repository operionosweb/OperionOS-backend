-- Supplemental operational evidence and human fulfilment assessments.
-- Contract-source obligation evidence remains separate and unchanged.

alter table public.obligations
  add constraint obligations_fulfilment_scope_key
  unique (id, organization_id, contract_id);

alter table public.intelligence_evidence
  add constraint intelligence_evidence_fulfilment_scope_key
  unique (id, organization_id, contract_id);

create table public.obligation_fulfilment_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  obligation_id uuid not null,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in (
    'pending_evidence', 'evidence_submitted', 'under_review', 'fulfilled',
    'partially_fulfilled', 'not_fulfilled', 'disputed', 'insufficient_evidence'
  )),
  explanation text not null check (length(trim(explanation)) > 0),
  created_at timestamptz not null default now(),
  unique (id, obligation_id, organization_id, contract_id),
  foreign key (obligation_id, organization_id, contract_id)
    references public.obligations(id, organization_id, contract_id) on delete restrict,
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete restrict
);

create table public.obligation_fulfilment_assessment_evidence (
  assessment_id uuid not null,
  obligation_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  evidence_id uuid not null,
  relationship text not null check (relationship in ('supports', 'contradicts', 'context')),
  period_status text not null check (period_status in ('matches', 'mismatches', 'not_assessed')),
  reviewer_note text,
  primary key (assessment_id, evidence_id),
  foreign key (assessment_id, obligation_id, organization_id, contract_id)
    references public.obligation_fulfilment_assessments(id, obligation_id, organization_id, contract_id)
    on delete restrict,
  foreign key (obligation_id, organization_id, contract_id)
    references public.obligations(id, organization_id, contract_id) on delete restrict,
  foreign key (evidence_id, organization_id, contract_id)
    references public.intelligence_evidence(id, organization_id, contract_id) on delete restrict
);

create index obligation_fulfilment_assessments_history_idx
  on public.obligation_fulfilment_assessments (organization_id, obligation_id, created_at desc);

create index obligation_fulfilment_evidence_obligation_idx
  on public.obligation_fulfilment_assessment_evidence (organization_id, obligation_id, assessment_id);

create or replace function public.prevent_obligation_fulfilment_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Obligation fulfilment history is append-only';
end;
$$;

create trigger prevent_obligation_fulfilment_assessment_mutation
  before update or delete on public.obligation_fulfilment_assessments
  for each row execute function public.prevent_obligation_fulfilment_history_mutation();

create trigger prevent_obligation_fulfilment_evidence_mutation
  before update or delete on public.obligation_fulfilment_assessment_evidence
  for each row execute function public.prevent_obligation_fulfilment_history_mutation();

alter table public.obligation_fulfilment_assessments enable row level security;
alter table public.obligation_fulfilment_assessment_evidence enable row level security;

create policy obligation_fulfilment_assessment_member_select
  on public.obligation_fulfilment_assessments
  for select to authenticated
  using (public.is_organization_member(organization_id));

create policy obligation_fulfilment_evidence_member_select
  on public.obligation_fulfilment_assessment_evidence
  for select to authenticated
  using (public.is_organization_member(organization_id));
