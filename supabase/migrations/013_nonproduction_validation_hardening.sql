-- Server-owned AI accounting and deterministic structure remain readable by
-- organization members, but authenticated clients cannot mutate them directly.

drop policy if exists ai_budget_member_access on public.ai_intelligence_budgets;
drop policy if exists ai_budget_member_select on public.ai_intelligence_budgets;
create policy ai_budget_member_select on public.ai_intelligence_budgets
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists ai_jobs_member_access on public.ai_intelligence_jobs;
drop policy if exists ai_jobs_member_select on public.ai_intelligence_jobs;
create policy ai_jobs_member_select on public.ai_intelligence_jobs
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists ai_usage_member_select on public.ai_intelligence_usage;
create policy ai_usage_member_select on public.ai_intelligence_usage
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists ai_cache_member_access on public.ai_intelligence_cache;
drop policy if exists ai_cache_member_select on public.ai_intelligence_cache;
create policy ai_cache_member_select on public.ai_intelligence_cache
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists contract_sections_member_access on public.contract_sections;
drop policy if exists contract_sections_member_select on public.contract_sections;
create policy contract_sections_member_select on public.contract_sections
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists contract_chunks_member_access on public.contract_document_chunks;
drop policy if exists contract_chunks_member_select on public.contract_document_chunks;
create policy contract_chunks_member_select on public.contract_document_chunks
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists contract_analyses_member_access on public.contract_intelligence_analyses;
drop policy if exists contract_analyses_member_select on public.contract_intelligence_analyses;
create policy contract_analyses_member_select on public.contract_intelligence_analyses
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists contract_document_pages_member_access on public.contract_document_pages;
drop policy if exists contract_document_pages_member_select on public.contract_document_pages;
create policy contract_document_pages_member_select on public.contract_document_pages
  for select to authenticated
  using (public.is_organization_member(organization_id));
