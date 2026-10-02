alter table public.commercial_sources
  add column if not exists canonical_url text,
  add column if not exists normalized_url text,
  add column if not exists domain text,
  add column if not exists original_url_hash text,
  add column if not exists normalized_url_hash text,
  add column if not exists content_hash text,
  add column if not exists content_status text not null default 'NOT_REQUESTED'
    check (content_status in ('NOT_REQUESTED', 'PROVIDED', 'UNAVAILABLE', 'FAILED')),
  add column if not exists extraction_status text not null default 'NOT_REQUESTED'
    check (extraction_status in ('NOT_REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED')),
  add column if not exists quality_confidence numeric(5,4)
    check (quality_confidence is null or quality_confidence between 0 and 1),
  add column if not exists review_status text not null default 'NEW'
    check (review_status in ('NEW', 'REVIEWED', 'VERIFIED', 'REJECTED', 'DEFERRED')),
  add column if not exists duplicate_status text not null default 'UNIQUE'
    check (duplicate_status in ('UNIQUE', 'DUPLICATE', 'POSSIBLE_DUPLICATE')),
  add column if not exists duplicate_of_source_id uuid references public.commercial_sources(id) on delete restrict,
  add column if not exists duplicate_reason text,
  add column if not exists duplicate_confidence numeric(5,4)
    check (duplicate_confidence is null or duplicate_confidence between 0 and 1),
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.commercial_ai_proposals (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.commercial_sources(id) on delete cascade,
  proposal_type text not null check (proposal_type in ('SIGNAL', 'COMPANY', 'PERSON')),
  proposed_data jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  status text not null default 'NEW' check (status in ('NEW', 'APPROVED', 'REJECTED', 'EDITED', 'DEFERRED')),
  promoted_entity_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_entity_match_proposals (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.commercial_sources(id) on delete cascade,
  entity_type text not null check (entity_type in ('COMPANY', 'PERSON')),
  candidate_entity_id uuid,
  proposed_entity jsonb not null,
  match_evidence jsonb not null default '[]'::jsonb,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  status text not null default 'NEW' check (status in ('NEW', 'APPROVED', 'REJECTED', 'DEFERRED')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_review_decisions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('SOURCE', 'AI_PROPOSAL', 'ENTITY_MATCH')),
  subject_id uuid not null,
  previous_status text,
  new_status text not null,
  decision text not null check (decision in ('APPROVE', 'REJECT', 'DEFER', 'EDIT', 'VERIFY')),
  reason text,
  changes jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists commercial_sources_review_idx
  on public.commercial_sources (review_status, duplicate_status, created_at desc);
create index if not exists commercial_sources_normalized_hash_idx
  on public.commercial_sources (normalized_url_hash) where normalized_url_hash is not null;
create index if not exists commercial_sources_content_hash_idx
  on public.commercial_sources (content_hash) where content_hash is not null;
create index if not exists commercial_sources_domain_idx
  on public.commercial_sources (domain, created_at desc);
create index if not exists commercial_ai_proposals_review_idx
  on public.commercial_ai_proposals (status, proposal_type, created_at desc);
create index if not exists commercial_entity_matches_review_idx
  on public.commercial_entity_match_proposals (status, entity_type, created_at desc);
create index if not exists commercial_review_decisions_subject_idx
  on public.commercial_review_decisions (subject_type, subject_id, created_at desc);

alter table public.commercial_ai_proposals enable row level security;
alter table public.commercial_entity_match_proposals enable row level security;
alter table public.commercial_review_decisions enable row level security;

revoke all on public.commercial_ai_proposals, public.commercial_entity_match_proposals,
  public.commercial_review_decisions from anon, authenticated;
grant all on public.commercial_ai_proposals, public.commercial_entity_match_proposals,
  public.commercial_review_decisions to service_role;
