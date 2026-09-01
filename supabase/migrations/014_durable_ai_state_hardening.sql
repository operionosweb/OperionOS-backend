-- Complete server-owned state protection and make AI cache identity provider-safe.
drop index if exists public.ai_cache_identity_idx;
create unique index ai_cache_identity_idx on public.ai_intelligence_cache (
  organization_id,
  document_hash,
  operation_type,
  analysis_version,
  coalesce(prompt_version, ''),
  coalesce(provider, ''),
  coalesce(model, '')
);

alter table public.ai_intelligence_jobs
  add column if not exists request_key text;

create unique index if not exists ai_jobs_active_request_uidx
  on public.ai_intelligence_jobs (organization_id, request_key)
  where request_key is not null and status in ('pending', 'estimating', 'processing');

drop policy if exists analysis_runs_member_access on public.analysis_runs;
drop policy if exists analysis_runs_member_select on public.analysis_runs;
create policy analysis_runs_member_select on public.analysis_runs
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists document_extractions_member_access on public.document_version_extractions;
drop policy if exists document_extractions_member_select on public.document_version_extractions;
create policy document_extractions_member_select on public.document_version_extractions
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists clauses_member_access on public.contract_clauses;
drop policy if exists clauses_member_select on public.contract_clauses;
create policy clauses_member_select on public.contract_clauses
  for select to authenticated
  using (exists (
    select 1
    from public.contract_versions v
    join public.contracts c on c.id = v.contract_id
    where v.id = contract_version_id
      and public.is_organization_member(c.organization_id)
  ));

drop policy if exists obligations_member_access on public.contract_obligations;
drop policy if exists obligations_member_select on public.contract_obligations;
create policy obligations_member_select on public.contract_obligations
  for select to authenticated
  using (exists (
    select 1
    from public.contract_clauses cc
    join public.contract_versions v on v.id = cc.contract_version_id
    join public.contracts c on c.id = v.contract_id
    where cc.id = contract_clause_id
      and public.is_organization_member(c.organization_id)
  ));