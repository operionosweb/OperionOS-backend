create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager', 'admin', 'owner')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null,
  content_hash text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (contract_id, version_number),
  unique (contract_id, content_hash)
);

create table if not exists public.contract_clauses (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references public.contract_versions(id) on delete cascade,
  clause_number text,
  title text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  contract_clause_id uuid not null references public.contract_clauses(id) on delete cascade,
  owner text,
  description text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'complete', 'waived')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  request_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id, status);
create index if not exists contracts_organization_idx
  on public.contracts (organization_id, created_at desc);
create index if not exists audit_events_organization_idx
  on public.audit_events (organization_id, created_at desc);

create or replace function public.is_organization_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_member(uuid) to service_role;

create or replace function public.prevent_contract_organization_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'contract organization cannot be changed';
  end if;

  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'contract creator cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_contract_organization_change on public.contracts;
create trigger prevent_contract_organization_change
  before update on public.contracts
  for each row execute function public.prevent_contract_organization_change();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_versions enable row level security;
alter table public.contract_clauses enable row level security;
alter table public.contract_obligations enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select using (public.is_organization_member(id));

drop policy if exists memberships_self_select on public.organization_memberships;
create policy memberships_self_select on public.organization_memberships
  for select using (user_id = auth.uid());

drop policy if exists contracts_member_access on public.contracts;
create policy contracts_member_access on public.contracts
  for all using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id) and created_by = auth.uid());

drop policy if exists versions_member_access on public.contract_versions;
drop policy if exists versions_member_select on public.contract_versions;
create policy versions_member_select on public.contract_versions
  for select using (exists (
    select 1 from public.contracts c
    where c.id = contract_id and public.is_organization_member(c.organization_id)
  ));

drop policy if exists versions_member_insert on public.contract_versions;
create policy versions_member_insert on public.contract_versions
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and public.is_organization_member(c.organization_id)
    )
  );

drop policy if exists versions_member_update on public.contract_versions;
create policy versions_member_update on public.contract_versions
  for update using (exists (
    select 1 from public.contracts c
    where c.id = contract_id and public.is_organization_member(c.organization_id)
  )) with check (exists (
    select 1 from public.contracts c
    where c.id = contract_id and public.is_organization_member(c.organization_id)
  ));

drop policy if exists versions_member_delete on public.contract_versions;
create policy versions_member_delete on public.contract_versions
  for delete using (exists (
    select 1 from public.contracts c
    where c.id = contract_id and public.is_organization_member(c.organization_id)
  ));

drop policy if exists clauses_member_access on public.contract_clauses;
create policy clauses_member_access on public.contract_clauses
  for all using (exists (
    select 1 from public.contract_versions v
    join public.contracts c on c.id = v.contract_id
    where v.id = contract_version_id and public.is_organization_member(c.organization_id)
  ));

drop policy if exists obligations_member_access on public.contract_obligations;
create policy obligations_member_access on public.contract_obligations
  for all using (exists (
    select 1
    from public.contract_clauses cc
    join public.contract_versions v on v.id = cc.contract_version_id
    join public.contracts c on c.id = v.contract_id
    where cc.id = contract_clause_id and public.is_organization_member(c.organization_id)
  ));

drop policy if exists audit_events_member_select on public.audit_events;
create policy audit_events_member_select on public.audit_events
  for select using (organization_id is not null and public.is_organization_member(organization_id));

drop policy if exists audit_events_member_insert on public.audit_events;
create policy audit_events_member_insert on public.audit_events
  for insert with check (
    organization_id is not null
    and actor_id = auth.uid()
    and public.is_organization_member(organization_id)
  );
