-- Step 3: durable deterministic pages independent of AI analysis runs.
create table if not exists public.contract_document_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  page_number integer not null check (page_number > 0),
  text_content text not null default '',
  text_length integer not null default 0 check (text_length >= 0),
  char_start integer not null check (char_start >= 0),
  char_end integer not null check (char_end >= char_start),
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (document_version_id, page_number),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade,
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete cascade,
  foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete cascade
);

create index if not exists contract_document_pages_version_idx
  on public.contract_document_pages (organization_id, document_version_id, page_number);

alter table public.contract_document_pages enable row level security;
drop policy if exists contract_document_pages_member_access on public.contract_document_pages;
create policy contract_document_pages_member_access on public.contract_document_pages
  for all using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));
