-- No application role can create an ownership row or invoke the transaction
-- entry point. Reclamation remains disabled until every write path is fenced.
create table public.analysis_write_fences (
  organization_id uuid not null,
  analysis_run_id uuid not null,
  worker_id uuid not null,
  generation bigint not null check (generation > 0),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  state text not null default 'active' check (state in ('active', 'manual_review')),
  created_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, analysis_run_id),
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete restrict
);
alter table public.analysis_write_fences enable row level security;
revoke all on public.analysis_write_fences from public, anon, authenticated, service_role;

create function public.prevent_analysis_fence_activation()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  raise exception 'ANALYSIS_FENCE_ACTIVATION_DISABLED' using errcode = 'P0001';
end;
$$;
create trigger prevent_analysis_fence_activation before insert on public.analysis_write_fences
  for each row execute function public.prevent_analysis_fence_activation();

create function public.guard_analysis_fence_generation()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.analysis_run_id is distinct from old.analysis_run_id
     or new.created_at is distinct from old.created_at
     or new.generation < old.generation
     or ((new.worker_id is distinct from old.worker_id or new.token_hash is distinct from old.token_hash)
         and new.generation <= old.generation)
     or (old.expires_at <= clock_timestamp() and new.expires_at > old.expires_at
         and new.generation <= old.generation) then
    raise exception 'ANALYSIS_FENCE_GENERATION_INVALID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_analysis_fence_generation before update on public.analysis_write_fences
  for each row execute function public.guard_analysis_fence_generation();

create function public.assert_analysis_write_fence(p_organization_id uuid, p_analysis_run_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_fence public.analysis_write_fences%rowtype;
  v_token text := current_setting('operion.fence_token', true);
  v_run_status text;
begin
  select * into v_fence from public.analysis_write_fences
    where organization_id = p_organization_id and analysis_run_id = p_analysis_run_id for update;
  if not found then raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001'; end if;
  select status into v_run_status from public.analysis_runs
    where id = p_analysis_run_id and organization_id = p_organization_id;
  if v_fence.state <> 'active' or v_fence.expires_at <= clock_timestamp()
     or v_run_status not in ('processing', 'extracting', 'analysing', 'indexing')
     or current_setting('operion.fence_organization', true) is distinct from p_organization_id::text
     or current_setting('operion.fence_run', true) is distinct from p_analysis_run_id::text
     or current_setting('operion.fence_worker', true) is distinct from v_fence.worker_id::text
     or current_setting('operion.fence_generation', true) is distinct from v_fence.generation::text
     or v_token is null or v_token !~ '^[0-9a-f]{64}$'
     or encode(sha256(convert_to(v_token, 'UTF8')), 'hex') is distinct from v_fence.token_hash then
    raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
  end if;
end;
$$;

create function public.begin_analysis_fenced_write(
  p_organization_id uuid, p_analysis_run_id uuid, p_worker_id uuid,
  p_generation bigint, p_token text
) returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if p_organization_id is null or p_analysis_run_id is null or p_worker_id is null
     or p_generation is null or p_generation < 1 or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
  end if;
  perform set_config('operion.fence_organization', p_organization_id::text, true);
  perform set_config('operion.fence_run', p_analysis_run_id::text, true);
  perform set_config('operion.fence_worker', p_worker_id::text, true);
  perform set_config('operion.fence_generation', p_generation::text, true);
  perform set_config('operion.fence_token', p_token, true);
  perform public.assert_analysis_write_fence(p_organization_id, p_analysis_run_id);
end;
$$;

create function public.guard_fenced_analysis_row()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op <> 'INSERT' and exists (
    select 1 from public.analysis_write_fences f
    where f.organization_id = old.organization_id and f.analysis_run_id = old.analysis_run_id
  ) then
    perform public.assert_analysis_write_fence(old.organization_id, old.analysis_run_id);
  end if;
  if tg_op <> 'DELETE' and exists (
    select 1 from public.analysis_write_fences f
    where f.organization_id = new.organization_id and f.analysis_run_id = new.analysis_run_id
  ) then
    perform public.assert_analysis_write_fence(new.organization_id, new.analysis_run_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'document_version_pages', 'contract_parties', 'intelligence_evidence',
    'clauses', 'obligations', 'deadlines', 'risks', 'recommendations',
    'contract_search_chunks', 'contract_intelligence_profiles'
  ] loop
    execute format('create trigger guard_fenced_analysis_row before insert or update or delete on public.%I for each row execute function public.guard_fenced_analysis_row()', v_table);
  end loop;
end;
$$;

create function public.guard_fenced_analysis_status()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if exists (select 1 from public.analysis_write_fences f
    where f.organization_id = old.organization_id and f.analysis_run_id = old.id) then
    perform public.assert_analysis_write_fence(old.organization_id, old.id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_fenced_analysis_status before update or delete on public.analysis_runs
  for each row execute function public.guard_fenced_analysis_status();

create function public.guard_fenced_evidence_link()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row jsonb;
  v_org uuid;
  v_parent_run uuid;
  v_evidence_run uuid;
  v_managed boolean;
begin
  for v_row in
    select case when tg_op = 'INSERT' then null else to_jsonb(old) end
    union all
    select case when tg_op = 'DELETE' then null else to_jsonb(new) end
  loop
    if v_row is null then continue; end if;
    v_org := (v_row->>'organization_id')::uuid;
    execute format('select analysis_run_id from public.%I where organization_id = $1 and id = $2', tg_argv[0])
      into v_parent_run using v_org, (v_row->>tg_argv[1])::uuid;
    select e.analysis_run_id into v_evidence_run from public.intelligence_evidence e
      where e.organization_id = v_org and e.id = (v_row->>'evidence_id')::uuid;
    select exists (select 1 from public.analysis_write_fences f
      where f.organization_id = v_org and f.analysis_run_id in (v_parent_run, v_evidence_run))
      into v_managed;
    if v_managed then
      if v_parent_run is null or v_parent_run is distinct from v_evidence_run then
        raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
      end if;
      perform public.assert_analysis_write_fence(v_org, v_parent_run);
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_fenced_evidence_link before insert or update or delete on public.clause_evidence
  for each row execute function public.guard_fenced_evidence_link('clauses', 'clause_id');
create trigger guard_fenced_evidence_link before insert or update or delete on public.obligation_evidence
  for each row execute function public.guard_fenced_evidence_link('obligations', 'obligation_id');
create trigger guard_fenced_evidence_link before insert or update or delete on public.deadline_evidence
  for each row execute function public.guard_fenced_evidence_link('deadlines', 'deadline_id');
create trigger guard_fenced_evidence_link before insert or update or delete on public.risk_evidence
  for each row execute function public.guard_fenced_evidence_link('risks', 'risk_id');
create trigger guard_fenced_evidence_link before insert or update or delete on public.recommendation_evidence
  for each row execute function public.guard_fenced_evidence_link('recommendations', 'recommendation_id');
create trigger guard_fenced_evidence_link before insert or update or delete on public.party_evidence
  for each row execute function public.guard_fenced_evidence_link('contract_parties', 'party_id');

revoke all on function public.assert_analysis_write_fence(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.begin_analysis_fenced_write(uuid, uuid, uuid, bigint, text) from public, anon, authenticated, service_role;
revoke all on function public.prevent_analysis_fence_activation() from public, anon, authenticated, service_role;
revoke all on function public.guard_analysis_fence_generation() from public, anon, authenticated, service_role;
revoke all on function public.guard_fenced_analysis_row() from public, anon, authenticated, service_role;
revoke all on function public.guard_fenced_analysis_status() from public, anon, authenticated, service_role;
revoke all on function public.guard_fenced_evidence_link() from public, anon, authenticated, service_role;
