drop trigger prevent_analysis_fence_activation on public.analysis_write_fences;

alter table public.ai_intelligence_jobs
  add column analysis_run_id uuid;
alter table public.ai_intelligence_jobs
  add constraint ai_intelligence_jobs_analysis_run_scope_fk
  foreign key (analysis_run_id, organization_id)
  references public.analysis_runs(id, organization_id) on delete restrict;
create unique index ai_contract_analysis_run_idempotency_idx
  on public.ai_intelligence_jobs (organization_id, analysis_run_id, operation_type)
  where analysis_run_id is not null and operation_type = 'full_contract_analysis';

alter table public.ai_intelligence_usage
  add column analysis_run_id uuid;
alter table public.ai_intelligence_usage
  add constraint ai_intelligence_usage_analysis_run_scope_fk
  foreign key (analysis_run_id, organization_id)
  references public.analysis_runs(id, organization_id) on delete restrict;
create unique index ai_intelligence_usage_job_idempotency_idx
  on public.ai_intelligence_usage (job_id);

create or replace function public.guard_analysis_fence_generation()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.analysis_run_id is distinct from old.analysis_run_id
     or new.worker_id is distinct from old.worker_id
     or new.execution_id is distinct from old.execution_id
     or new.generation is distinct from old.generation
     or new.token_hash is distinct from old.token_hash
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at
     or (old.state = 'manual_review' and new.state <> old.state) then
    raise exception 'ANALYSIS_FENCE_TRANSFER_DISABLED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.prevent_analysis_fence_delete()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
  raise exception 'ANALYSIS_FENCE_DELETE_DISABLED' using errcode = 'P0001';
end;
$$;
create trigger prevent_analysis_fence_delete before delete on public.analysis_write_fences
  for each row execute function public.prevent_analysis_fence_delete();

create or replace function public.guard_fenced_analysis_row()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row jsonb;
  v_organization_id uuid;
  v_run_id uuid;
  v_status text;
begin
  for v_row in
    select case when tg_op = 'INSERT' then null else to_jsonb(old) end
    union all
    select case when tg_op = 'DELETE' then null else to_jsonb(new) end
  loop
    if v_row is null or nullif(v_row->>'analysis_run_id', '') is null then continue; end if;
    v_organization_id := (v_row->>'organization_id')::uuid;
    v_run_id := (v_row->>'analysis_run_id')::uuid;
    select r.status into v_status
      from public.analysis_runs r
     where r.id = v_run_id and r.organization_id = v_organization_id;
    if v_status is distinct from 'awaiting_ingestion' then
      perform public.assert_analysis_write_fence(v_organization_id, v_run_id);
    elsif exists (
      select 1 from public.analysis_write_fences f
       where f.organization_id = v_organization_id and f.analysis_run_id = v_run_id
    ) then
      raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_fenced_analysis_status()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_fence public.analysis_write_fences%rowtype;
  v_token text := current_setting('operion.fence_token', true);
begin
  if old.status = 'queued' and new.status = 'processing'
     and current_setting('operion.fence_claim', true) = old.organization_id::text || ':' || old.id::text then
    select * into v_fence from public.analysis_write_fences f
     where f.organization_id = old.organization_id and f.analysis_run_id = old.id for update;
    if not found or v_fence.state <> 'active' or v_fence.generation <> 1
       or v_fence.expires_at <= clock_timestamp()
       or current_setting('operion.fence_organization', true) is distinct from old.organization_id::text
       or current_setting('operion.fence_run', true) is distinct from old.id::text
       or current_setting('operion.fence_worker', true) is distinct from v_fence.worker_id::text
       or current_setting('operion.fence_execution', true) is distinct from v_fence.execution_id::text
       or current_setting('operion.fence_generation', true) is distinct from v_fence.generation::text
       or v_token is null or v_token !~ '^[0-9a-f]{64}$'
       or encode(sha256(convert_to(v_token, 'UTF8')), 'hex') is distinct from v_fence.token_hash then
      raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
    end if;
  elsif old.status = 'awaiting_ingestion'
        and new.status in ('queued', 'failed', 'cancelled')
        and not exists (
          select 1 from public.analysis_write_fences f
           where f.organization_id = old.organization_id and f.analysis_run_id = old.id
        ) then
    null;
  else
    perform public.assert_analysis_write_fence(old.organization_id, old.id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_fenced_evidence_link()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row jsonb;
  v_organization_id uuid;
  v_parent_run uuid;
  v_evidence_run uuid;
  v_managed boolean;
  v_active boolean;
begin
  for v_row in
    select case when tg_op = 'INSERT' then null else to_jsonb(old) end
    union all
    select case when tg_op = 'DELETE' then null else to_jsonb(new) end
  loop
    if v_row is null then continue; end if;
    v_organization_id := (v_row->>'organization_id')::uuid;
    execute format('select analysis_run_id from public.%I where organization_id = $1 and id = $2', tg_argv[0])
      into v_parent_run using v_organization_id, (v_row->>tg_argv[1])::uuid;
    select e.analysis_run_id into v_evidence_run
      from public.intelligence_evidence e
     where e.organization_id = v_organization_id and e.id = (v_row->>'evidence_id')::uuid;
    select exists (
      select 1 from public.analysis_write_fences f
       where f.organization_id = v_organization_id
         and f.analysis_run_id in (v_parent_run, v_evidence_run)
    ) into v_managed;
    select exists (
      select 1 from public.analysis_runs r
       where r.organization_id = v_organization_id
         and r.id in (v_parent_run, v_evidence_run)
         and r.status in ('queued', 'processing', 'extracting', 'analysing', 'indexing')
    ) into v_active;
    if v_managed or v_active then
      if v_parent_run is null or v_parent_run is distinct from v_evidence_run then
        raise exception 'ANALYSIS_FENCE_REJECTED' using errcode = 'P0001';
      end if;
      perform public.assert_analysis_write_fence(v_organization_id, v_parent_run);
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_fenced_contract_write()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_scope record;
  v_context_run uuid := nullif(current_setting('operion.fence_run', true), '')::uuid;
  v_context_org uuid := nullif(current_setting('operion.fence_organization', true), '')::uuid;
begin
  for v_scope in
    select distinct organization_id, contract_id
      from (values
        (case when tg_op = 'INSERT' then null else old.organization_id end,
         case when tg_op = 'INSERT' then null else old.id end),
        (case when tg_op = 'DELETE' then null else new.organization_id end,
         case when tg_op = 'DELETE' then null else new.id end)
      ) as changed(organization_id, contract_id)
     where organization_id is not null and contract_id is not null
  loop
    if v_context_run is not null then
      if not exists (
        select 1 from public.analysis_runs r
         where r.id = v_context_run and r.organization_id = v_context_org
           and r.organization_id = v_scope.organization_id
           and r.contract_id = v_scope.contract_id
      ) then
        raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
      end if;
      perform public.assert_analysis_write_fence(v_context_org, v_context_run);
    elsif exists (
      select 1 from public.analysis_runs r
       where r.organization_id = v_scope.organization_id
         and r.contract_id = v_scope.contract_id
         and r.status in ('processing', 'extracting', 'analysing', 'indexing')
    ) then
      raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger block_fenced_contract_write on public.contracts;
drop function public.block_fenced_contract_write();
create trigger guard_fenced_contract_write before insert or update or delete on public.contracts
  for each row execute function public.guard_fenced_contract_write();

create or replace function public.guard_fenced_aircraft_relationship()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_scope record;
  v_context_run uuid := nullif(current_setting('operion.fence_run', true), '')::uuid;
  v_context_org uuid := nullif(current_setting('operion.fence_organization', true), '')::uuid;
begin
  for v_scope in
    select distinct organization_id, contract_id
      from (values
        (case when tg_op = 'INSERT' then null else old.organization_id end,
         case when tg_op = 'INSERT' then null else old.contract_id end),
        (case when tg_op = 'DELETE' then null else new.organization_id end,
         case when tg_op = 'DELETE' then null else new.contract_id end)
      ) as changed(organization_id, contract_id)
     where organization_id is not null and contract_id is not null
  loop
    if v_context_run is not null then
      if not exists (
        select 1 from public.analysis_runs r
         where r.id = v_context_run and r.organization_id = v_context_org
           and r.organization_id = v_scope.organization_id
           and r.contract_id = v_scope.contract_id
      ) then
        raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
      end if;
      perform public.assert_analysis_write_fence(v_context_org, v_context_run);
    elsif exists (
      select 1 from public.analysis_runs r
       where r.organization_id = v_scope.organization_id
         and r.contract_id = v_scope.contract_id
         and r.status in ('processing', 'extracting', 'analysing', 'indexing')
    ) then
      raise exception 'ANALYSIS_FENCE_SHARED_WRITE_BLOCKED' using errcode = 'P0001';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger block_fenced_aircraft_relationship on public.aircraft_contract_relationships;
drop function public.block_fenced_aircraft_relationship();
create trigger guard_fenced_aircraft_relationship before insert or update or delete on public.aircraft_contract_relationships
  for each row execute function public.guard_fenced_aircraft_relationship();

create function public.claim_analysis_execution(p_organization_id uuid, p_analysis_run_id uuid)
returns table(worker_id uuid, execution_id uuid, generation bigint, token text)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_status text;
  v_contract_id uuid;
  v_worker_id uuid := gen_random_uuid();
  v_execution_id uuid := gen_random_uuid();
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if p_organization_id is null or p_analysis_run_id is null then
    raise exception 'ANALYSIS_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  select r.status, r.contract_id into v_status, v_contract_id
    from public.analysis_runs r
   where r.id = p_analysis_run_id and r.organization_id = p_organization_id
   for update;
  if not found then
    raise exception 'ANALYSIS_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'queued' then return; end if;
  if not exists (
    select 1 from public.contract_upload_journal j
    join public.contract_analysis_outbox o
      on o.journal_id = j.id and o.organization_id = j.organization_id
     where j.organization_id = p_organization_id
       and j.analysis_run_id = p_analysis_run_id and j.contract_id = v_contract_id
       and j.state = 'ready' and o.state = 'dispatched'
  ) then
    raise exception 'VERIFIED_INGESTION_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.analysis_write_fences(
    organization_id, analysis_run_id, worker_id, execution_id,
    generation, token_hash, expires_at, state
  ) values (
    p_organization_id, p_analysis_run_id, v_worker_id, v_execution_id,
    1, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    clock_timestamp() + interval '24 hours', 'active'
  );
  perform set_config('operion.fence_organization', p_organization_id::text, true);
  perform set_config('operion.fence_run', p_analysis_run_id::text, true);
  perform set_config('operion.fence_worker', v_worker_id::text, true);
  perform set_config('operion.fence_execution', v_execution_id::text, true);
  perform set_config('operion.fence_generation', '1', true);
  perform set_config('operion.fence_token', v_token, true);
  perform set_config('operion.fence_claim', p_organization_id::text || ':' || p_analysis_run_id::text, true);
  update public.analysis_runs
     set status = 'processing', started_at = clock_timestamp(),
         completed_at = null, error_code = null, error_message = null
   where id = p_analysis_run_id and organization_id = p_organization_id and status = 'queued';
  if not found then raise exception 'ANALYSIS_CLAIM_LOST' using errcode = 'P0001'; end if;
  return query select v_worker_id, v_execution_id, 1::bigint, v_token;
end;
$$;

revoke all on function public.claim_analysis_execution(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_analysis_execution(uuid, uuid) to service_role;
revoke all on function public.begin_analysis_fenced_write_v2(uuid, uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.begin_analysis_fenced_write_v2(uuid, uuid, uuid, uuid, bigint, text) to service_role;
revoke all on function public.guard_fenced_contract_write() from public, anon, authenticated, service_role;
revoke all on function public.guard_fenced_aircraft_relationship() from public, anon, authenticated, service_role;
revoke all on function public.prevent_analysis_fence_delete() from public, anon, authenticated, service_role;
