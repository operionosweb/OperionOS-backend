-- Organisation-scoped AI Intelligence Budget, jobs, usage and reusable results.
create table if not exists public.ai_intelligence_budgets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_period_start date not null,
  billing_period_end date not null,
  allocated_intelligence bigint not null default 0 check (allocated_intelligence >= 0),
  consumed_intelligence bigint not null default 0 check (consumed_intelligence >= 0),
  reserved_intelligence bigint not null default 0 check (reserved_intelligence >= 0),
  warning_threshold numeric(5,2) not null default 80 check (warning_threshold between 0 and 100),
  hard_limit boolean not null default true,
  updated_at timestamptz not null default now(),
  check (billing_period_end >= billing_period_start)
);
create table if not exists public.ai_intelligence_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, contract_id uuid, document_version_id uuid,
  operation_type text not null, status text not null check (status in ('pending','estimating','awaiting_confirmation','processing','completed','failed','cancelled','budget_blocked')),
  estimated_intelligence bigint not null default 0 check (estimated_intelligence >= 0), actual_intelligence bigint not null default 0 check (actual_intelligence >= 0),
  provider text, model text, technical_usage jsonb not null default '{}'::jsonb, cost numeric(12,6), error jsonb,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.ai_intelligence_usage (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.ai_intelligence_jobs(id) on delete cascade, user_id uuid references auth.users(id) on delete set null,
  operation_type text not null, estimated_intelligence bigint not null, actual_intelligence bigint not null, provider text, model text,
  technical_usage jsonb not null default '{}'::jsonb, cost numeric(12,6), created_at timestamptz not null default now()
);
create table if not exists public.ai_intelligence_cache (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'), operation_type text not null, analysis_version text not null,
  prompt_version text, provider text, model text, result jsonb not null, intelligence_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), valid_until timestamptz
);
create unique index if not exists ai_cache_identity_idx
  on public.ai_intelligence_cache (organization_id, document_hash, operation_type, analysis_version, coalesce(model, ''));
create index if not exists ai_jobs_org_created_idx on public.ai_intelligence_jobs (organization_id, created_at desc);
create index if not exists ai_usage_org_created_idx on public.ai_intelligence_usage (organization_id, created_at desc);
alter table public.ai_intelligence_budgets enable row level security;
alter table public.ai_intelligence_jobs enable row level security;
alter table public.ai_intelligence_usage enable row level security;
alter table public.ai_intelligence_cache enable row level security;
drop policy if exists ai_budget_member_access on public.ai_intelligence_budgets;
create policy ai_budget_member_access on public.ai_intelligence_budgets for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists ai_jobs_member_access on public.ai_intelligence_jobs;
create policy ai_jobs_member_access on public.ai_intelligence_jobs for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));
drop policy if exists ai_usage_member_select on public.ai_intelligence_usage;
create policy ai_usage_member_select on public.ai_intelligence_usage for select using (public.is_organization_member(organization_id));
drop policy if exists ai_cache_member_access on public.ai_intelligence_cache;
create policy ai_cache_member_access on public.ai_intelligence_cache for all using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));