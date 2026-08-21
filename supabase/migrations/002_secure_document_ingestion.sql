create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  document_type text not null default 'aviation_contract',
  filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size > 0),
  storage_provider text not null default 'supabase',
  storage_key text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed', 'requires_ocr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sha256)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size > 0),
  page_count integer check (page_count is null or page_count > 0),
  extraction_status text not null default 'queued'
    check (extraction_status in ('queued', 'processing', 'completed', 'failed', 'requires_ocr')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (document_id, version_number),
  unique (organization_id, sha256)
);

create table if not exists public.document_version_extractions (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null unique references public.document_versions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  text_content text,
  text_length integer not null default 0 check (text_length >= 0),
  text_truncated boolean not null default false,
  extraction_status text not null
    check (extraction_status in ('completed', 'failed', 'requires_ocr')),
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  pipeline_version text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists documents_contract_idx
  on public.documents (organization_id, contract_id, created_at desc);
create index if not exists document_versions_document_idx
  on public.document_versions (organization_id, document_id, version_number desc);
create index if not exists analysis_runs_contract_idx
  on public.analysis_runs (organization_id, contract_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('contract-documents', 'contract-documents', false)
on conflict (id) do update set public = false;

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_version_extractions enable row level security;
alter table public.analysis_runs enable row level security;

 drop policy if exists documents_member_access on public.documents;
create policy documents_member_access on public.documents
  for all using (public.is_organization_member(organization_id))
  with check (
    public.is_organization_member(organization_id)
    and created_by = auth.uid()
    and exists (
      select 1
      from public.contracts c
      where c.id = contract_id
        and c.organization_id = documents.organization_id
    )
  );

drop policy if exists document_versions_member_access on public.document_versions;
create policy document_versions_member_access on public.document_versions
  for all using (public.is_organization_member(organization_id))
  with check (
    public.is_organization_member(organization_id)
    and created_by = auth.uid()
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.organization_id = document_versions.organization_id
    )
  );

drop policy if exists document_extractions_member_access on public.document_version_extractions;
create policy document_extractions_member_access on public.document_version_extractions
  for all using (public.is_organization_member(organization_id))
  with check (
    public.is_organization_member(organization_id)
    and exists (
      select 1
      from public.document_versions dv
      where dv.id = document_version_id
        and dv.organization_id = document_version_extractions.organization_id
    )
  );

drop policy if exists analysis_runs_member_access on public.analysis_runs;
create policy analysis_runs_member_access on public.analysis_runs
  for all using (public.is_organization_member(organization_id))
  with check (
    public.is_organization_member(organization_id)
    and requested_by = auth.uid()
    and exists (
      select 1
      from public.contracts c
      where c.id = contract_id
        and c.organization_id = analysis_runs.organization_id
    )
    and exists (
      select 1
      from public.document_versions dv
      where dv.id = document_version_id
        and dv.organization_id = analysis_runs.organization_id
    )
  );

create or replace function public.prevent_document_ownership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.contract_id is distinct from old.contract_id
     or new.created_by is distinct from old.created_by
     or new.storage_key is distinct from old.storage_key
     or new.sha256 is distinct from old.sha256 then
    raise exception 'document ownership and source identity are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_document_ownership_change on public.documents;
create trigger prevent_document_ownership_change
  before update on public.documents
  for each row execute function public.prevent_document_ownership_change();

create or replace function public.prevent_document_version_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.document_id is distinct from old.document_id
     or new.organization_id is distinct from old.organization_id
     or new.version_number is distinct from old.version_number
     or new.created_by is distinct from old.created_by
     or new.storage_key is distinct from old.storage_key
     or new.sha256 is distinct from old.sha256
     or new.file_size is distinct from old.file_size then
    raise exception 'document version source identity is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_document_version_change on public.document_versions;
create trigger prevent_document_version_change
  before update on public.document_versions
  for each row execute function public.prevent_document_version_change();

create or replace function public.prevent_analysis_run_ownership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.contract_id is distinct from old.contract_id
     or new.document_version_id is distinct from old.document_version_id
     or new.requested_by is distinct from old.requested_by
     or new.pipeline_version is distinct from old.pipeline_version then
    raise exception 'analysis run ownership and identity are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_analysis_run_ownership_change on public.analysis_runs;
create trigger prevent_analysis_run_ownership_change
  before update on public.analysis_runs
  for each row execute function public.prevent_analysis_run_ownership_change();

-- The application uses the service role for storage operations and still applies
-- organization predicates in every request-path query. These policies protect
-- direct authenticated Supabase access as an independent database backstop.
drop policy if exists contract_storage_member_read on storage.objects;
create policy contract_storage_member_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/documents/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/versions/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/source[.]pdf$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );

drop policy if exists contract_storage_member_insert on storage.objects;
create policy contract_storage_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/documents/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/versions/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/source[.]pdf$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );

drop policy if exists contract_storage_member_delete on storage.objects;
create policy contract_storage_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/documents/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/versions/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/source\.pdf$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );
