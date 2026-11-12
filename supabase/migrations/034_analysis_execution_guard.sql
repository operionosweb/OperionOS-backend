-- Activation remains disabled. Do not silently change existing ownership.
do $$
begin
  if exists (select 1 from public.analysis_write_fences) then
    raise exception 'ANALYSIS_FENCE_UPGRADE_REQUIRES_REVIEW' using errcode = 'P0001';
  end if;
end;
$$;

alter table public.analysis_write_fences add column execution_id uuid not null;

create or replace function public.guard_analysis_fence_generation()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.analysis_run_id is distinct from old.analysis_run_id
     or new.created_at is distinct from old.created_at
     or new.generation < old.generation
     or ((new.worker_id is distinct from old.worker_id
          or new.execution_id is distinct from old.execution_id
          or new.token_hash is distinct from old.token_hash)
         and new.generation <= old.generation)
     or (old.expires_at <= clock_timestamp() and new.expires_at > old.expires_at
         and new.generation <= old.generation) then
    raise exception 'ANALYSIS_FENCE_GENERATION_INVALID' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.assert_analysis_write_fence(p_organization_id uuid, p_analysis_run_id uuid)
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
     or current_setting('operion.fence_execution', true) is distinct from v_fence.execution_id::text
     or current_setting('operion.fence_generation', true) is distinct from v_fence.generation::text
     or v_token is null or v_token !~ '^[0-9a-f]{64}$'
     or encode(sha256(convert_to(v_token, 'UTF8')), 'hex') is distinct from v_fence.token_hash then
    raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.begin_analysis_fenced_write(
  p_organization_id uuid, p_analysis_run_id uuid, p_worker_id uuid,
  p_generation bigint, p_token text
) returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  raise exception 'ANALYSIS_FENCE_EXECUTION_REQUIRED' using errcode = 'P0001';
end;
$$;

create function public.begin_analysis_fenced_write_v2(
  p_organization_id uuid, p_analysis_run_id uuid, p_worker_id uuid,
  p_execution_id uuid, p_generation bigint, p_token text
) returns void language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if p_organization_id is null or p_analysis_run_id is null or p_worker_id is null
     or p_execution_id is null or p_generation is null or p_generation < 1
     or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
  end if;
  perform set_config('operion.fence_organization', p_organization_id::text, true);
  perform set_config('operion.fence_run', p_analysis_run_id::text, true);
  perform set_config('operion.fence_worker', p_worker_id::text, true);
  perform set_config('operion.fence_execution', p_execution_id::text, true);
  perform set_config('operion.fence_generation', p_generation::text, true);
  perform set_config('operion.fence_token', p_token, true);
  perform public.assert_analysis_write_fence(p_organization_id, p_analysis_run_id);
end;
$$;

-- Contract metadata and relationships are shared across runs. Until their
-- ownership model is resolved, reject all writes for a contract with a fence.
create function public.block_fenced_contract_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if exists (
    select 1 from public.analysis_write_fences f
    join public.analysis_runs r on r.id = f.analysis_run_id and r.organization_id = f.organization_id
    where r.organization_id = old.organization_id and r.contract_id = old.id
  ) then
    raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger block_fenced_contract_write before update or delete on public.contracts
  for each row execute function public.block_fenced_contract_write();

create function public.block_fenced_aircraft_relationship()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_op <> 'INSERT' and exists (
    select 1 from public.analysis_write_fences f
    join public.analysis_runs r on r.id = f.analysis_run_id and r.organization_id = f.organization_id
    where r.organization_id = old.organization_id and r.contract_id = old.contract_id
  ) then
    raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
  end if;
  if tg_op <> 'DELETE' and exists (
    select 1 from public.analysis_write_fences f
    join public.analysis_runs r on r.id = f.analysis_run_id and r.organization_id = f.organization_id
    where r.organization_id = new.organization_id and r.contract_id = new.contract_id
  ) then
    raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger block_fenced_aircraft_relationship before insert or update or delete on public.aircraft_contract_relationships
  for each row execute function public.block_fenced_aircraft_relationship();

revoke all on function public.begin_analysis_fenced_write_v2(uuid, uuid, uuid, uuid, bigint, text) from public, anon, authenticated, service_role;
revoke all on function public.block_fenced_contract_write() from public, anon, authenticated, service_role;
revoke all on function public.block_fenced_aircraft_relationship() from public, anon, authenticated, service_role;
