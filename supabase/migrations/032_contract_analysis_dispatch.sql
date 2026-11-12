-- A staged run supplies the foreign key needed by document structure, but is
-- not runnable until the verified upload and dispatch intent are committed.
alter table public.analysis_runs drop constraint analysis_runs_phase3_status_check;
alter table public.analysis_runs add constraint analysis_runs_phase3_status_check
  check (status in (
    'awaiting_ingestion', 'queued', 'processing', 'extracting', 'analysing',
    'indexing', 'completed', 'failed', 'cancelled', 'requires_review'
  ));

create table public.contract_analysis_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  journal_id uuid not null,
  analysis_run_id uuid not null,
  state text not null default 'pending' check (state in ('pending', 'dispatched')),
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  unique (journal_id),
  unique (analysis_run_id),
  foreign key (journal_id, organization_id)
    references public.contract_upload_journal(id, organization_id) on delete restrict,
  foreign key (analysis_run_id, organization_id)
    references public.analysis_runs(id, organization_id) on delete restrict,
  check ((state = 'dispatched') = (dispatched_at is not null))
);
create index contract_analysis_outbox_pending_idx
  on public.contract_analysis_outbox (created_at, id) where state = 'pending';
alter table public.contract_analysis_outbox enable row level security;
revoke all on public.contract_analysis_outbox from public, anon, authenticated, service_role;
grant select on public.contract_analysis_outbox to service_role;

create or replace function public.prevent_analysis_run_invalid_transition()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.status in ('completed', 'cancelled') then
    raise exception 'terminal analysis runs are immutable';
  end if;
  if not (
    (old.status = 'awaiting_ingestion' and new.status in ('queued', 'failed', 'cancelled')) or
    (old.status = 'queued' and new.status in ('processing', 'failed', 'cancelled')) or
    (old.status = 'processing' and new.status in ('extracting', 'failed', 'cancelled')) or
    (old.status = 'extracting' and new.status in ('analysing', 'failed', 'cancelled')) or
    (old.status = 'analysing' and new.status in ('indexing', 'failed', 'cancelled', 'requires_review')) or
    (old.status = 'indexing' and new.status in ('completed', 'failed', 'cancelled', 'requires_review')) or
    (old.status = 'failed' and new.status = 'processing')
  ) then
    raise exception 'invalid analysis run transition from % to %', old.status, new.status;
  end if;
  return new;
end;
$$;

create function public.guard_analysis_ingestion_readiness()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_state text;
begin
  select j.state into v_state from public.contract_upload_journal j
    where j.organization_id = new.organization_id and j.document_version_id = new.document_version_id;
  if found and v_state <> 'ready'
     and new.status not in ('awaiting_ingestion', 'failed', 'cancelled') then
    raise exception 'verified ingestion required before analysis';
  end if;
  if tg_op = 'UPDATE' and old.status = 'awaiting_ingestion' and new.status = 'queued'
     and not exists (
       select 1 from public.contract_analysis_outbox o
       join public.contract_upload_journal j on j.id = o.journal_id and j.organization_id = o.organization_id
       where o.organization_id = new.organization_id and o.analysis_run_id = new.id
         and o.state = 'dispatched' and j.state = 'ready'
     ) then
    raise exception 'committed dispatch required before queueing';
  end if;
  return new;
end;
$$;
create trigger guard_analysis_ingestion_readiness
  before insert or update of status on public.analysis_runs
  for each row execute function public.guard_analysis_ingestion_readiness();

create function public.guard_analysis_result_ingestion()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if exists (
    select 1 from public.contract_upload_journal j
    where j.organization_id = new.organization_id and j.document_version_id = new.document_version_id
      and j.state <> 'ready'
  ) or exists (
    select 1 from public.analysis_runs r
    where r.organization_id = new.organization_id and r.id = new.analysis_run_id
      and r.status = 'awaiting_ingestion'
  ) then
    raise exception 'verified ingestion and dispatch required before analysis writes';
  end if;
  return new;
end;
$$;
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'contract_parties', 'intelligence_evidence', 'clauses', 'obligations',
    'deadlines', 'risks', 'recommendations', 'contract_search_chunks',
    'contract_intelligence_profiles'
  ] loop
    execute format('create trigger guard_analysis_result_ingestion before insert or update on public.%I for each row execute function public.guard_analysis_result_ingestion()', v_table);
  end loop;
end;
$$;

create function public.enqueue_verified_contract_analysis()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.state <> 'ready' then return new; end if;
  if not exists (
    select 1 from public.documents d
    join public.document_versions v on v.id = new.document_version_id and v.organization_id = new.organization_id
      and v.document_id = d.id and v.contract_id = new.contract_id
    join public.document_version_extractions e on e.document_version_id = v.id and e.organization_id = v.organization_id
    join public.analysis_runs r on r.id = new.analysis_run_id and r.organization_id = new.organization_id
      and r.contract_id = new.contract_id and r.document_version_id = v.id
    where d.id = new.document_id and d.organization_id = new.organization_id
      and d.contract_id = new.contract_id and d.status = 'ready'
      and v.extraction_status = 'completed' and v.processing_status = 'processed'
      and e.extraction_status = 'completed' and length(e.text_content) > 0
      and r.status = 'awaiting_ingestion'
      and exists (select 1 from public.contract_sections s where s.organization_id = new.organization_id and s.document_version_id = v.id)
      and exists (select 1 from public.contract_document_chunks c where c.organization_id = new.organization_id and c.document_version_id = v.id)
  ) then
    raise exception 'completed ingestion and staged analysis required';
  end if;
  insert into public.contract_analysis_outbox (organization_id, journal_id, analysis_run_id)
    values (new.organization_id, new.id, new.analysis_run_id);
  return new;
end;
$$;
create trigger enqueue_verified_contract_analysis
  after update of state on public.contract_upload_journal
  for each row execute function public.enqueue_verified_contract_analysis();

create function public.dispatch_contract_analysis(p_organization_id uuid, p_journal_id uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_event public.contract_analysis_outbox%rowtype;
begin
  select * into v_event from public.contract_analysis_outbox
    where organization_id = p_organization_id and journal_id = p_journal_id for update;
  if not found then raise exception 'analysis dispatch not found'; end if;
  if v_event.state = 'dispatched' then return v_event.analysis_run_id; end if;
  update public.contract_analysis_outbox set state = 'dispatched', dispatched_at = clock_timestamp()
    where id = v_event.id and state = 'pending';
  update public.analysis_runs set status = 'queued'
    where id = v_event.analysis_run_id and organization_id = p_organization_id
      and status = 'awaiting_ingestion';
  if not found then raise exception 'staged analysis is unavailable'; end if;
  return v_event.analysis_run_id;
end;
$$;

create function public.dispatch_pending_contract_analyses(p_limit integer)
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_event record;
  v_count integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'dispatch limit must be between 1 and 100'; end if;
  for v_event in
    select organization_id, journal_id from public.contract_analysis_outbox
    where state = 'pending' order by created_at, id for update skip locked limit p_limit
  loop
    perform public.dispatch_contract_analysis(v_event.organization_id, v_event.journal_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.inspect_contract_upload_recovery(p_organization_id uuid, p_limit integer)
returns table (
  journal_id uuid, upload_state text, analysis_run_id uuid, analysis_state text,
  dispatch_state text, classification text, reason text
)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_organization_id is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'organization and a limit between 1 and 100 are required';
  end if;
  return query
    select j.id, j.state, j.analysis_run_id, r.status, o.state,
      case when j.state = 'ready' and o.state = 'pending' and r.status = 'awaiting_ingestion'
        then 'RETRY_ELIGIBLE' else 'MANUAL_REVIEW_REQUIRED' end,
      case
        when j.state = 'ready' and o.state = 'pending' and r.status = 'awaiting_ingestion'
          then 'Verified ingestion has a pending dispatch'
        when j.state = 'ready' and o.id is null
          then 'Ready upload has no dispatch event'
        when j.state = 'ready'
          then 'Analysis and dispatch state require review'
        when j.state = 'requires_ocr'
          then 'Document requires OCR review'
        when j.state = 'manual_review'
          then 'Upload is already marked for manual review'
        else 'Upload completion and activity are not established'
      end
    from public.contract_upload_journal j
    left join public.contract_analysis_outbox o on o.organization_id = j.organization_id and o.journal_id = j.id
    left join public.analysis_runs r on r.organization_id = j.organization_id and r.id = j.analysis_run_id
    where j.organization_id = p_organization_id
      and (j.state <> 'ready' or o.id is null or o.state = 'pending'
        or (o.state = 'dispatched' and r.status in ('awaiting_ingestion', 'failed', 'cancelled')))
    order by j.updated_at, j.id
    limit p_limit;
end;
$$;

revoke all on function public.dispatch_contract_analysis(uuid, uuid) from public, anon, authenticated;
revoke all on function public.dispatch_pending_contract_analyses(integer) from public, anon, authenticated;
revoke all on function public.inspect_contract_upload_recovery(uuid, integer) from public, anon, authenticated;
grant execute on function public.dispatch_contract_analysis(uuid, uuid) to service_role;
grant execute on function public.dispatch_pending_contract_analyses(integer) to service_role;
grant execute on function public.inspect_contract_upload_recovery(uuid, integer) to service_role;
