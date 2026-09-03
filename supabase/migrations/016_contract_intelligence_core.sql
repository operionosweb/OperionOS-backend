alter table public.contracts add column if not exists contract_number text;
alter table public.contracts add column if not exists contract_type_confidence numeric(5,4)
  check (contract_type_confidence is null or contract_type_confidence between 0 and 1);
alter table public.contracts add column if not exists renewal_date date;
alter table public.contracts add column if not exists auto_renewal boolean;
alter table public.contracts add column if not exists governing_law text;
alter table public.contracts add column if not exists currency text
  check (currency is null or currency ~ '^[A-Z]{3}$');
alter table public.contracts add column if not exists source_document_id uuid;
alter table public.contracts add column if not exists metadata_confidence numeric(5,4)
  check (metadata_confidence is null or metadata_confidence between 0 and 1);

alter table public.contracts drop constraint if exists contracts_source_document_fk;
alter table public.contracts add constraint contracts_source_document_fk
  foreign key (source_document_id, organization_id)
  references public.documents(id, organization_id) on delete restrict not valid;

create table if not exists public.contract_intelligence_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  analysis_run_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  classification jsonb not null default '{}'::jsonb,
  executive_summary text,
  key_commercial_terms jsonb not null default '[]'::jsonb,
  key_operational_terms jsonb not null default '[]'::jsonb,
  key_obligations jsonb not null default '[]'::jsonb,
  key_deadlines jsonb not null default '[]'::jsonb,
  key_risks jsonb not null default '[]'::jsonb,
  unusual_or_missing_terms jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  aircraft_identifiers jsonb not null default '[]'::jsonb,
  evidence_claims jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, analysis_run_id),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete cascade,
  foreign key (analysis_run_id, organization_id) references public.analysis_runs(id, organization_id) on delete cascade
);

alter table public.aircraft_contract_relationships add column if not exists source_evidence_id uuid;
alter table public.aircraft_contract_relationships add column if not exists source_identifier text;
alter table public.aircraft_contract_relationships drop constraint if exists aircraft_contract_source_evidence_fk;
alter table public.aircraft_contract_relationships add constraint aircraft_contract_source_evidence_fk
  foreign key (source_evidence_id, organization_id)
  references public.intelligence_evidence(id, organization_id) on delete restrict not valid;

create index if not exists contract_profiles_scope_idx
  on public.contract_intelligence_profiles (organization_id, contract_id, created_at desc);
create index if not exists contract_number_scope_idx
  on public.contracts (organization_id, contract_number);
create index if not exists aircraft_contract_identifier_idx
  on public.aircraft_contract_relationships (organization_id, source_identifier)
  where source_identifier is not null;

alter table public.contract_intelligence_profiles enable row level security;
drop policy if exists contract_profiles_member_select on public.contract_intelligence_profiles;
create policy contract_profiles_member_select on public.contract_intelligence_profiles
  for select using (public.is_organization_member(organization_id));
grant select on public.contract_intelligence_profiles to authenticated;
grant all on public.contract_intelligence_profiles to service_role;

drop trigger if exists prevent_contract_profile_update on public.contract_intelligence_profiles;
create trigger prevent_contract_profile_update before update on public.contract_intelligence_profiles
  for each row execute function public.prevent_phase3_result_update();