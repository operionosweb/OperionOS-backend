-- Storage is external to PostgreSQL. These records reserve source identity
-- atomically and retain uncertain transfers for manual reconciliation.
create table public.contract_upload_journal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null,
  document_id uuid not null,
  document_version_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  storage_bucket text not null check (length(storage_bucket) between 1 and 255),
  storage_key text not null,
  filename text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size bigint not null check (file_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'reserved' check (state in ('reserved', 'transferring', 'stored', 'ready', 'requires_ocr', 'manual_review')),
  analysis_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sha256),
  unique (document_version_id),
  unique (storage_bucket, storage_key),
  unique (id, organization_id),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete restrict,
  foreign key (document_id, organization_id) references public.documents(id, organization_id) on delete restrict,
  foreign key (document_version_id, organization_id) references public.document_versions(id, organization_id) on delete restrict,
  foreign key (analysis_run_id, organization_id) references public.analysis_runs(id, organization_id) on delete restrict,
  check ((state in ('ready', 'requires_ocr')) = (analysis_run_id is not null))
);

create index contract_upload_journal_recovery_idx
  on public.contract_upload_journal (organization_id, state, updated_at);

create table public.contract_upload_events (
  id bigint generated always as identity primary key,
  journal_id uuid not null,
  organization_id uuid not null,
  state text not null,
  created_at timestamptz not null default now(),
  foreign key (journal_id, organization_id) references public.contract_upload_journal(id, organization_id) on delete restrict
);

alter table public.contract_upload_journal enable row level security;
alter table public.contract_upload_events enable row level security;
revoke all on public.contract_upload_journal, public.contract_upload_events from public, anon, authenticated;
revoke all on public.contract_upload_journal, public.contract_upload_events from service_role;
grant select on public.contract_upload_journal, public.contract_upload_events to service_role;

create function public.guard_contract_upload_journal()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.contract_id is distinct from old.contract_id
     or new.document_id is distinct from old.document_id
     or new.document_version_id is distinct from old.document_version_id
     or new.requested_by is distinct from old.requested_by
     or new.storage_bucket is distinct from old.storage_bucket
     or new.storage_key is distinct from old.storage_key
     or new.filename is distinct from old.filename
     or new.mime_type is distinct from old.mime_type
     or new.file_size is distinct from old.file_size
     or new.sha256 is distinct from old.sha256
     or new.created_at is distinct from old.created_at then
    raise exception 'upload reservation identity is immutable';
  end if;
  if not (
    (old.state = 'reserved' and new.state in ('transferring', 'manual_review')) or
    (old.state = 'transferring' and new.state in ('stored', 'manual_review')) or
    (old.state = 'stored' and new.state in ('ready', 'requires_ocr', 'manual_review'))
  ) then
    raise exception 'invalid upload journal transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_contract_upload_journal
  before update on public.contract_upload_journal
  for each row execute function public.guard_contract_upload_journal();

create function public.record_contract_upload_event()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  insert into public.contract_upload_events (journal_id, organization_id, state)
  values (new.id, new.organization_id, new.state);
  return new;
end;
$$;

create trigger record_contract_upload_event
  after insert or update on public.contract_upload_journal
  for each row execute function public.record_contract_upload_event();

create function public.reject_contract_upload_event_change()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'upload events are append-only';
end;
$$;

create trigger reject_contract_upload_event_change
  before update or delete on public.contract_upload_events
  for each row execute function public.reject_contract_upload_event_change();

create function public.reserve_contract_upload(
  p_organization_id uuid, p_user_id uuid, p_contract_id uuid, p_document_id uuid,
  p_new_document_id uuid, p_version_id uuid, p_title text, p_filename text,
  p_mime_type text, p_file_size bigint, p_sha256 text, p_page_count integer,
  p_storage_bucket text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_contract_id uuid := p_contract_id;
  v_document_id uuid := coalesce(p_document_id, p_new_document_id);
  v_journal_id uuid := gen_random_uuid();
  v_storage_key text;
  v_version_number integer;
begin
  if not exists (
    select 1 from public.organization_memberships
    where organization_id = p_organization_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'active organization membership required' using errcode = '42501';
  end if;
  if p_document_id is not null and p_contract_id is null then
    raise exception 'contract required for existing document';
  end if;
  if p_contract_id is null then
    insert into public.contracts (organization_id, created_by, title, status)
    values (p_organization_id, p_user_id, p_title, 'draft') returning id into v_contract_id;
  elsif not exists (
    select 1 from public.contracts where id = p_contract_id and organization_id = p_organization_id
  ) then
    raise exception 'contract not found';
  end if;
  if p_mime_type not in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') then
    raise exception 'unsupported document type';
  end if;
  v_storage_key := 'organizations/' || p_organization_id || '/documents/' || v_document_id ||
    '/versions/' || p_version_id || '/source' ||
    case when p_mime_type = 'application/pdf' then '.pdf' else '.docx' end;
  if p_document_id is null then
    insert into public.documents (
      id, organization_id, contract_id, created_by, document_type, filename, mime_type,
      file_size, storage_provider, storage_key, sha256, status
    ) values (
      v_document_id, p_organization_id, v_contract_id, p_user_id, 'aviation_contract',
      p_filename, p_mime_type, p_file_size, 'supabase', v_storage_key, p_sha256, 'uploaded'
    );
  else
    perform 1 from public.documents
      where id = v_document_id and organization_id = p_organization_id and contract_id = v_contract_id
      for update;
    if not found then raise exception 'document not found'; end if;
  end if;
  select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.document_versions where document_id = v_document_id and organization_id = p_organization_id;
  insert into public.document_versions (
    id, document_id, contract_id, organization_id, version_number, sha256, storage_key,
    mime_type, file_size, page_count, extraction_status, created_by
  ) values (
    p_version_id, v_document_id, v_contract_id, p_organization_id, v_version_number,
    p_sha256, v_storage_key, p_mime_type, p_file_size, p_page_count, 'queued', p_user_id
  );
  insert into public.contract_upload_journal (
    id, organization_id, contract_id, document_id, document_version_id, requested_by,
    storage_bucket, storage_key, filename, mime_type, file_size, sha256
  ) values (
    v_journal_id, p_organization_id, v_contract_id, v_document_id, p_version_id, p_user_id,
    p_storage_bucket, v_storage_key, p_filename, p_mime_type, p_file_size, p_sha256
  );
  return jsonb_build_object('journal_id', v_journal_id, 'contract_id', v_contract_id,
    'document_id', v_document_id, 'version_id', p_version_id,
    'version_number', v_version_number, 'storage_key', v_storage_key);
end;
$$;

create function public.transition_contract_upload(
  p_organization_id uuid, p_journal_id uuid, p_expected_state text,
  p_next_state text, p_analysis_run_id uuid default null
) returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if p_next_state in ('ready', 'requires_ocr') and not exists (
    select 1 from public.analysis_runs r
    join public.contract_upload_journal j on j.id = p_journal_id and j.organization_id = p_organization_id
    where r.id = p_analysis_run_id and r.organization_id = j.organization_id
      and r.contract_id = j.contract_id and r.document_version_id = j.document_version_id
  ) then raise exception 'analysis run scope mismatch'; end if;
  update public.contract_upload_journal
    set state = p_next_state, analysis_run_id = p_analysis_run_id
    where id = p_journal_id and organization_id = p_organization_id and state = p_expected_state;
  if not found then raise exception 'upload state conflict'; end if;
end;
$$;

revoke all on function public.reserve_contract_upload(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, text, integer, text) from public, anon, authenticated;
revoke all on function public.transition_contract_upload(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_contract_upload(uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, text, integer, text) to service_role;
grant execute on function public.transition_contract_upload(uuid, uuid, text, text, uuid) to service_role;
