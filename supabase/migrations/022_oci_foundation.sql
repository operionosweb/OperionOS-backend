-- Isolated, service-only OCI. No bootstrap identity, customer tables or production data.
begin;
create table public.oci_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'super_admin'),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create table public.oci_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  entity_kind text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create table public.oci_settings (
  scope text primary key check (scope='stages'),
  value jsonb not null check (jsonb_typeof(value)='array'),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.oci_settings(scope,value) values ('stages',
  '["Identified","Researched","Qualified","Contacted","Engaged","Discovery meeting","Product demonstration","Pilot proposed","Pilot active","Proposal submitted","Negotiation","Won","Lost","Nurture"]');
create table public.oci_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('accounts','contacts','market','opportunities','activities','discovery','pilots','revenue')),
  data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<=100000),
  account_id uuid references public.oci_records(id) on delete restrict,
  opportunity_id uuid references public.oci_records(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Stable provider UUID attribution, not a live identity relationship. Identity deletion
  -- must not rewrite immutable/versioned commercial records or invent mutation actors.
  created_by uuid,
  updated_by uuid,
  check (kind not in ('contacts','opportunities','activities','discovery','pilots','revenue') or account_id is not null),
  check (kind <> 'accounts' or (account_id is null and opportunity_id is null)),
  check (kind <> 'opportunities' or opportunity_id is null),
  check (account_id is null or account_id<>id),
  check (opportunity_id is null or opportunity_id<>id)
);
create index oci_records_kind_status_idx on public.oci_records(kind,status,updated_at desc);
create unique index oci_accounts_active_identity_idx on public.oci_records
  (lower(btrim(data->>'name')),lower(btrim(coalesce(data->>'country',''))))
  where kind='accounts' and status='active';
create unique index oci_contacts_active_email_idx on public.oci_records
  (account_id,lower(btrim(data->>'email')))
  where kind='contacts' and status='active' and nullif(btrim(data->>'email'),'') is not null;
create index oci_records_account_idx on public.oci_records(account_id) where status='active';
create index oci_records_opportunity_idx on public.oci_records(opportunity_id) where status='active';
create index oci_audit_created_idx on public.oci_audit_events(created_at desc);

-- Serialize this small internal workspace, including stage configuration, before row locks.
-- This prevents parent archive/link and opportunity account-change races across transactions.
create function public.oci_lock_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(782134, 22);
  return null;
end $$;
create trigger oci_records_mutation_lock before insert or update or delete on public.oci_records
  for each statement execute function public.oci_lock_mutation();
create trigger oci_settings_mutation_lock before insert or update or delete on public.oci_settings
  for each statement execute function public.oci_lock_mutation();

create function public.oci_validate_record() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent public.oci_records; configured jsonb; privacy_erasure boolean := false;
begin
  if tg_op='DELETE' then raise exception 'OCI records must be archived' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    -- The only archived-record mutation is irreversible contact minimisation.
    -- Exact payload and unchanged links prevent a general archived-edit bypass.
    privacy_erasure := old.kind='contacts' and
      new.data='{"name":"Erased contact","privacyErased":true}'::jsonb and
      not(old.data @> '{"privacyErased":true}'::jsonb) and new.status='archived' and
      new.account_id is not distinct from old.account_id and
      new.opportunity_id is not distinct from old.opportunity_id;
    if new.id<>old.id or new.kind<>old.kind or new.created_at<>old.created_at or new.created_by is distinct from old.created_by
      or new.version<>old.version+1 or (old.status='archived' and not privacy_erasure)
      then raise exception 'Invalid OCI version or immutable field' using errcode='40001'; end if;
    if new.data ? 'privacyErased' and not privacy_erasure then
      raise exception 'Invalid OCI privacy payload' using errcode='23514'; end if;
    if new.status='archived' and exists(select 1 from public.oci_records where status='active' and (account_id=new.id or opportunity_id=new.id))
      then raise exception 'Active OCI records reference this parent' using errcode='23514'; end if;
    if new.kind='opportunities' and new.account_id is distinct from old.account_id and
      exists(select 1 from public.oci_records where status='active' and opportunity_id=new.id and account_id is distinct from new.account_id)
      then raise exception 'Opportunity dependents must retain same account' using errcode='23514'; end if;
  elsif new.version<>1 or new.status<>'active' then
    raise exception 'Invalid initial OCI record state' using errcode='23514';
  end if;
  if tg_op='INSERT' and new.data ? 'privacyErased' then
    raise exception 'Privacy marker cannot be created through ordinary CRUD' using errcode='23514'; end if;
  if new.updated_by is null then raise exception 'OCI actor required' using errcode='23514'; end if;
  if new.status='active' then
    if new.account_id is not null then
      select * into parent from public.oci_records where id=new.account_id;
      if not found or parent.kind<>'accounts' or parent.status<>'active' then
        raise exception 'Invalid OCI account parent' using errcode='23514'; end if;
    end if;
    if new.opportunity_id is not null then
      select * into parent from public.oci_records where id=new.opportunity_id;
      if not found or parent.kind<>'opportunities' or parent.status<>'active' or parent.account_id is distinct from new.account_id then
        raise exception 'Invalid OCI opportunity parent or account' using errcode='23514'; end if;
    end if;
    if new.kind='opportunities' then
      select value into configured from public.oci_settings where scope='stages';
      if new.data->>'stage' is null or not (configured ? (new.data->>'stage')) then
        raise exception 'Invalid OCI stage' using errcode='23514'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger oci_records_validate before insert or update or delete on public.oci_records
  for each row execute function public.oci_validate_record();

create function public.oci_validate_settings() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'OCI settings cannot be deleted' using errcode='23514'; end if;
  if jsonb_typeof(new.value)<>'array' or jsonb_array_length(new.value) not between 2 and 30 or
    not(new.value ? 'Won' and new.value ? 'Lost') then raise exception 'Invalid OCI stages' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(new.value) v where jsonb_typeof(v)<>'string') or
    exists(select 1 from jsonb_array_elements_text(new.value) v where length(v) not between 1 and 60 or btrim(v)<>v or v ~ '[[:cntrl:]]') or
    (select count(distinct lower(v)) from jsonb_array_elements_text(new.value) v)<>jsonb_array_length(new.value) or
    exists(select 1 from public.oci_records where kind='opportunities' and not(new.value ? (data->>'stage')))
    then raise exception 'Duplicate or referenced OCI stages' using errcode='23514'; end if;
  if new.updated_by is null then raise exception 'OCI actor required' using errcode='23514'; end if;
  return new;
end $$;
create trigger oci_settings_validate before insert or update or delete on public.oci_settings
  for each row execute function public.oci_validate_settings();

-- AFTER triggers are part of the same transaction: audit failure rolls back the mutation.
-- Never copy data, contact details, stage names or financial contents into audit metadata.
create function public.oci_audit_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_table_name='oci_records' then
    insert into public.oci_audit_events(actor_id,action,entity_kind,entity_id,metadata)
      values(new.updated_by,case when tg_op='INSERT' then 'record.created'
        when new.kind='contacts' and new.data='{"name":"Erased contact","privacyErased":true}'::jsonb then 'record.privacy_erased'
        when new.status='archived' then 'record.archived' else 'record.updated' end,
        new.kind,new.id,jsonb_build_object('version',new.version));
  else
    insert into public.oci_audit_events(actor_id,action,entity_kind,metadata)
      values(new.updated_by,'settings.stages.updated','settings',jsonb_build_object('count',jsonb_array_length(new.value)));
  end if;
  return new;
end $$;
create trigger oci_records_audit after insert or update on public.oci_records
  for each row execute function public.oci_audit_mutation();
create trigger oci_settings_audit after insert or update on public.oci_settings
  for each row execute function public.oci_audit_mutation();

-- Role changes are audited even through operator SQL or auth-user cascade deletion.
-- Later operator transactions may SET LOCAL oci.actor_id to their verified UUID.
-- Do not infer an update/delete actor from the original provisioner's created_by.
create function public.oci_audit_role_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare actor uuid; target uuid; assigned_role text; assigned_status text;
begin
  actor := nullif(current_setting('oci.actor_id',true),'')::uuid;
  if tg_op='DELETE' then
    target := old.user_id; assigned_role := old.role; assigned_status := old.status;
  else
    target := new.user_id; assigned_role := new.role; assigned_status := new.status;
    if tg_op='INSERT' and actor is null then actor := new.created_by; end if;
  end if;
  insert into public.oci_audit_events(actor_id,action,entity_kind,entity_id,metadata)
    values(actor,case tg_op when 'INSERT' then 'role.assigned' when 'UPDATE' then 'role.updated' else 'role.removed' end,
      'role',target,jsonb_build_object('role',assigned_role,'status',assigned_status));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger oci_user_roles_audit after insert or update or delete on public.oci_user_roles
  for each row execute function public.oci_audit_role_mutation();

alter table public.oci_records enable row level security;
alter table public.oci_settings enable row level security;
alter table public.oci_user_roles enable row level security;
alter table public.oci_audit_events enable row level security;
revoke all on public.oci_records,public.oci_settings,public.oci_user_roles,public.oci_audit_events from public,anon,authenticated;
grant select,insert,update on public.oci_records,public.oci_settings to service_role;
grant select,insert,update,delete on public.oci_user_roles to service_role;
grant select,insert on public.oci_audit_events to service_role;
revoke all on function public.oci_lock_mutation(),public.oci_validate_record(),public.oci_validate_settings(),public.oci_audit_mutation(),public.oci_audit_role_mutation() from public,anon,authenticated;
commit;
