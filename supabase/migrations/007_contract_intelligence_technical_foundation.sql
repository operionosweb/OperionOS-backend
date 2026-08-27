-- Contract Intelligence technical foundation; no extraction or analysis is performed here.
alter table public.contracts add column if not exists contract_type text;
alter table public.contracts add column if not exists counterparty_reference text;
alter table public.contracts add column if not exists effective_date date;
alter table public.contracts add column if not exists expiry_date date;
alter table public.document_versions add column if not exists contract_id uuid;
alter table public.document_versions add column if not exists version_identifier text;
alter table public.document_versions add column if not exists version_status text not null default 'current';
alter table public.document_versions add column if not exists processing_status text not null default 'uploaded';
alter table public.document_versions add column if not exists analysis_status text not null default 'not_started';
alter table public.document_versions add column if not exists updated_at timestamptz not null default now();
alter table public.document_versions add constraint document_versions_contract_fk foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade not valid;
alter table public.document_versions add constraint document_versions_version_status_check check (version_status in ('draft', 'current', 'superseded', 'amendment'));
alter table public.document_versions add constraint document_versions_processing_status_check check (processing_status in ('uploaded', 'queued', 'processing', 'processed', 'failed'));
alter table public.document_versions add constraint document_versions_analysis_status_check check (analysis_status in ('not_started', 'queued', 'processing', 'completed', 'failed'));
create table if not exists public.contract_sections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null, document_id uuid not null, document_version_id uuid not null, parent_section_id uuid,
  heading text, section_order integer not null check (section_order >= 0), page_start integer, page_end integer, source_text text not null default '', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (id, organization_id), unique (document_version_id, section_order),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete cascade,
  foreign key (parent_section_id, organization_id) references public.contract_sections(id, organization_id) on delete cascade
);
create table if not exists public.contract_document_chunks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null, document_id uuid not null, document_version_id uuid not null, section_id uuid, page_number integer,
  chunk_order integer not null check (chunk_order >= 0), source_text text not null, content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique (id, organization_id), unique (document_version_id, chunk_order),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete cascade,
  foreign key (section_id, organization_id) references public.contract_sections(id, organization_id) on delete set null
);
create table if not exists public.contract_intelligence_analyses (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null, document_version_id uuid not null, intelligence_job_id uuid references public.ai_intelligence_jobs(id) on delete set null,
  analysis_type text not null, schema_version text not null, processing_version text not null, prompt_version text, provider text, model text, status text not null default 'pending', result jsonb, created_at timestamptz not null default now(), completed_at timestamptz,
  unique (id, organization_id), unique (document_version_id, analysis_type, schema_version, processing_version)
);
alter table public.contract_intelligence_analyses add constraint contract_analyses_contract_org_fk foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade;
alter table public.contract_intelligence_analyses add constraint contract_analyses_version_org_fk foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete cascade;
alter table public.contract_intelligence_analyses add constraint contract_analyses_status_check check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled'));
create index if not exists contract_sections_version_order_idx on public.contract_sections (organization_id, document_version_id, section_order);
create index if not exists contract_chunks_version_order_idx on public.contract_document_chunks (organization_id, document_version_id, chunk_order);
alter table public.contract_sections enable row level security;
alter table public.contract_document_chunks enable row level security;
alter table public.contract_intelligence_analyses enable row level security;
drop policy if exists contract_sections_member_access on public.contract_sections;
create policy contract_sections_member_access on public.contract_sections for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists contract_chunks_member_access on public.contract_document_chunks;
create policy contract_chunks_member_access on public.contract_document_chunks for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists contract_analyses_member_access on public.contract_intelligence_analyses;
create policy contract_analyses_member_access on public.contract_intelligence_analyses for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));