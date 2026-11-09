-- Append-only, tenant-scoped evidence for aviation outcomes and deterministic forecasts.

alter table public.clauses
  add constraint clauses_aviation_outcome_scope_key
  unique (id, organization_id, contract_id, document_version_id, analysis_run_id);

alter table public.obligations
  add constraint obligations_aviation_outcome_scope_key
  unique (id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id);

create table public.aviation_contract_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  clause_id uuid not null,
  obligation_id uuid not null,
  outcome_type text not null check (outcome_type in (
    'flight_hours', 'flight_cycles', 'charge', 'maintenance_charge',
    'fx_adjustment', 'fuel_adjustment', 'operational_disruption',
    'supplier_impact', 'other'
  )),
  classification text not null check (classification in (
    'verified_actual', 'partially_verified', 'unverified_reported',
    'estimated', 'hypothetical'
  )),
  value numeric(24, 8) not null,
  unit text not null check (length(trim(unit)) > 0),
  measurement_basis text not null check (measurement_basis in (
    'cumulative_to_date', 'reporting_period_total', 'event_value'
  )),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  asset_identifier text,
  period_start date not null,
  period_end date not null,
  methodology text not null check (length(trim(methodology)) > 0),
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  verified_at timestamptz,
  supersedes_outcome_id uuid,
  correction_reason text,
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, organization_id, contract_id),
  unique (organization_id, contract_id, dedupe_key),
  unique (supersedes_outcome_id),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete restrict,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete restrict,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete restrict,
  foreign key (clause_id, organization_id, contract_id, document_version_id, analysis_run_id)
    references public.clauses(id, organization_id, contract_id, document_version_id, analysis_run_id)
    on delete restrict,
  foreign key (obligation_id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id)
    references public.obligations(id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id)
    on delete restrict,
  foreign key (supersedes_outcome_id, organization_id, contract_id)
    references public.aviation_contract_outcomes(id, organization_id, contract_id) on delete restrict,
  check (period_start <= period_end),
  check (outcome_type not in ('flight_hours', 'flight_cycles') or (value >= 0 and currency is null)),
  check (
    outcome_type not in ('flight_hours', 'flight_cycles')
    or measurement_basis in ('cumulative_to_date', 'reporting_period_total')
  ),
  check (
    outcome_type in ('flight_hours', 'flight_cycles')
    or measurement_basis <> 'cumulative_to_date'
  ),
  check (
    outcome_type not in ('charge', 'maintenance_charge', 'fx_adjustment', 'fuel_adjustment')
    or currency is not null
  ),
  check (
    (classification = 'verified_actual' and verified_at is not null)
    or (classification <> 'verified_actual' and verified_at is null)
  ),
  check (
    (supersedes_outcome_id is null and correction_reason is null)
    or (supersedes_outcome_id is not null and length(trim(correction_reason)) > 0)
  )
);

create table public.aviation_contract_outcome_evidence (
  outcome_id uuid not null,
  organization_id uuid not null,
  contract_id uuid not null,
  evidence_id uuid not null,
  relationship text not null check (relationship in ('supports', 'contradicts', 'context')),
  period_status text not null check (period_status in ('matches', 'mismatches', 'not_assessed')),
  reviewer_note text,
  primary key (outcome_id, evidence_id),
  foreign key (outcome_id, organization_id, contract_id)
    references public.aviation_contract_outcomes(id, organization_id, contract_id) on delete restrict,
  foreign key (evidence_id, organization_id, contract_id)
    references public.intelligence_evidence(id, organization_id, contract_id) on delete restrict
);

create table public.aviation_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  clause_id uuid not null,
  obligation_id uuid not null,
  forecast_type text not null check (forecast_type = 'operational_utilisation_threshold'),
  metric text not null check (metric in ('flight_hours', 'flight_cycles')),
  unit text not null,
  contractual_limit numeric(24, 8) not null check (contractual_limit > 0),
  generated_at timestamptz not null,
  last_observed_date date not null,
  estimated_threshold_date date not null,
  forecast_horizon_days integer not null check (forecast_horizon_days > 0),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  assumption text not null check (length(trim(assumption)) > 0),
  methodology_version text not null check (length(trim(methodology_version)) > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, organization_id, contract_id),
  unique (organization_id, contract_id, dedupe_key),
  foreign key (contract_id, organization_id)
    references public.contracts(id, organization_id) on delete restrict,
  foreign key (document_version_id, organization_id)
    references public.document_versions(id, organization_id) on delete restrict,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete restrict,
  foreign key (clause_id, organization_id, contract_id, document_version_id, analysis_run_id)
    references public.clauses(id, organization_id, contract_id, document_version_id, analysis_run_id)
    on delete restrict,
  foreign key (obligation_id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id)
    references public.obligations(id, organization_id, contract_id, document_version_id, analysis_run_id, clause_id)
    on delete restrict
);

create table public.aviation_forecast_snapshot_evidence (
  snapshot_id uuid not null,
  organization_id uuid not null,
  contract_id uuid not null,
  evidence_id uuid not null,
  primary key (snapshot_id, evidence_id),
  foreign key (snapshot_id, organization_id, contract_id)
    references public.aviation_forecast_snapshots(id, organization_id, contract_id) on delete restrict,
  foreign key (evidence_id, organization_id, contract_id)
    references public.intelligence_evidence(id, organization_id, contract_id) on delete restrict
);

create index aviation_contract_outcomes_scope_history_idx
  on public.aviation_contract_outcomes
    (organization_id, contract_id, document_version_id, obligation_id, period_end, created_at);
create index aviation_forecast_snapshots_scope_history_idx
  on public.aviation_forecast_snapshots
    (organization_id, contract_id, document_version_id, obligation_id, generated_at);

create or replace function public.validate_aviation_outcome_correction()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prior public.aviation_contract_outcomes%rowtype;
begin
  if new.supersedes_outcome_id is null then
    return new;
  end if;

  select * into prior
    from public.aviation_contract_outcomes
   where id = new.supersedes_outcome_id
     and organization_id = new.organization_id
     and contract_id = new.contract_id
   for update;

  if not found
    or prior.document_version_id <> new.document_version_id
    or prior.analysis_run_id <> new.analysis_run_id
    or prior.clause_id <> new.clause_id
    or prior.obligation_id <> new.obligation_id
    or prior.outcome_type <> new.outcome_type
    or prior.unit <> new.unit
    or prior.measurement_basis <> new.measurement_basis
    or prior.currency is distinct from new.currency
    or prior.period_start <> new.period_start
    or prior.period_end <> new.period_end
    or exists (
      select 1 from public.aviation_contract_outcomes newer
       where newer.supersedes_outcome_id = prior.id
    ) then
    raise exception 'Outcome corrections must preserve the original scope and reporting dimensions and may only supersede the latest record';
  end if;
  return new;
end;
$$;

create trigger validate_aviation_outcome_correction_before_insert
  before insert on public.aviation_contract_outcomes
  for each row execute function public.validate_aviation_outcome_correction();

create or replace function public.prevent_aviation_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Aviation outcome and forecast history is append-only';
end;
$$;

create trigger prevent_aviation_contract_outcome_mutation
  before update or delete on public.aviation_contract_outcomes
  for each row execute function public.prevent_aviation_history_mutation();
create trigger prevent_aviation_contract_outcome_evidence_mutation
  before update or delete on public.aviation_contract_outcome_evidence
  for each row execute function public.prevent_aviation_history_mutation();
create trigger prevent_aviation_forecast_snapshot_mutation
  before update or delete on public.aviation_forecast_snapshots
  for each row execute function public.prevent_aviation_history_mutation();
create trigger prevent_aviation_forecast_snapshot_evidence_mutation
  before update or delete on public.aviation_forecast_snapshot_evidence
  for each row execute function public.prevent_aviation_history_mutation();

create or replace function public.validate_verified_aviation_outcome_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_outcome_id uuid;
begin
  target_outcome_id := (to_jsonb(new) ->> case
    when tg_table_name = 'aviation_contract_outcomes' then 'id'
    else 'outcome_id'
  end)::uuid;

  if exists (
    select 1
      from public.aviation_contract_outcomes o
     where o.id = target_outcome_id
       and o.classification = 'verified_actual'
       and (
         not exists (
           select 1
             from public.aviation_contract_outcome_evidence oe
             join public.intelligence_evidence e
               on e.id = oe.evidence_id
              and e.organization_id = oe.organization_id
              and e.contract_id = oe.contract_id
            where oe.outcome_id = o.id
              and oe.organization_id = o.organization_id
              and oe.contract_id = o.contract_id
              and oe.relationship = 'supports'
              and oe.period_status = 'matches'
              and e.review_status = 'verified'
         )
         or exists (
           select 1
             from public.aviation_contract_outcome_evidence oe
            where oe.outcome_id = o.id
              and oe.relationship = 'contradicts'
         )
       )
  ) then
    raise exception 'Verified actual outcomes require period-matched verified supporting evidence and no contradictory evidence';
  end if;

  return null;
end;
$$;

create constraint trigger validate_aviation_outcome_after_insert
  after insert on public.aviation_contract_outcomes
  deferrable initially deferred
  for each row execute function public.validate_verified_aviation_outcome_evidence();
create constraint trigger validate_aviation_outcome_evidence_after_insert
  after insert on public.aviation_contract_outcome_evidence
  deferrable initially deferred
  for each row execute function public.validate_verified_aviation_outcome_evidence();

alter table public.aviation_contract_outcomes enable row level security;
alter table public.aviation_contract_outcome_evidence enable row level security;
alter table public.aviation_forecast_snapshots enable row level security;
alter table public.aviation_forecast_snapshot_evidence enable row level security;

grant select on public.aviation_contract_outcomes,
  public.aviation_contract_outcome_evidence,
  public.aviation_forecast_snapshots,
  public.aviation_forecast_snapshot_evidence
  to authenticated;

create policy aviation_contract_outcomes_member_select
  on public.aviation_contract_outcomes for select to authenticated
  using (public.is_organization_member(organization_id));
create policy aviation_contract_outcome_evidence_member_select
  on public.aviation_contract_outcome_evidence for select to authenticated
  using (public.is_organization_member(organization_id));
create policy aviation_forecast_snapshots_member_select
  on public.aviation_forecast_snapshots for select to authenticated
  using (public.is_organization_member(organization_id));
create policy aviation_forecast_snapshot_evidence_member_select
  on public.aviation_forecast_snapshot_evidence for select to authenticated
  using (public.is_organization_member(organization_id));

revoke all on public.aviation_contract_outcomes,
  public.aviation_contract_outcome_evidence,
  public.aviation_forecast_snapshots,
  public.aviation_forecast_snapshot_evidence
  from public, anon, authenticated;
grant select, insert on public.aviation_contract_outcomes,
  public.aviation_contract_outcome_evidence,
  public.aviation_forecast_snapshots,
  public.aviation_forecast_snapshot_evidence
  to service_role;
