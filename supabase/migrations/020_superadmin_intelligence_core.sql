alter table public.commercial_people
  add column if not exists verification_source_id uuid references public.commercial_sources(id) on delete set null;

alter table public.commercial_people
  drop constraint if exists commercial_people_verified_source_check;
alter table public.commercial_people
  add constraint commercial_people_verified_source_check
  check (verification_status <> 'VERIFIED_FACT' or verification_source_id is not null) not valid;

alter table public.commercial_signals
  add column if not exists title text,
  add column if not exists extracted_fact text,
  add column if not exists ai_interpretation text,
  add column if not exists source_id uuid references public.commercial_sources(id) on delete set null,
  add column if not exists review_status text not null default 'NEW'
    check (review_status in ('NEW', 'REVIEWED', 'QUALIFIED', 'DISMISSED', 'ACTIONED'));

alter table public.commercial_signals
  drop constraint if exists commercial_signals_title_check;
alter table public.commercial_signals
  add constraint commercial_signals_title_check check (title is not null) not valid;
alter table public.commercial_signals
  drop constraint if exists commercial_signals_fact_check;
alter table public.commercial_signals
  add constraint commercial_signals_fact_check check (extracted_fact is not null) not valid;
alter table public.commercial_signals
  drop constraint if exists commercial_signals_verified_source_check;
alter table public.commercial_signals
  add constraint commercial_signals_verified_source_check
  check (verification_status <> 'VERIFIED_FACT' or source_id is not null) not valid;
alter table public.commercial_signals
  drop constraint if exists commercial_signals_signal_type_check;
alter table public.commercial_signals
  add constraint commercial_signals_signal_type_check check (signal_type in (
    'FLEET_EXPANSION', 'FLEET_RENEWAL', 'AIRCRAFT_ACQUISITION', 'AIRCRAFT_DISPOSAL',
    'NETWORK_EXPANSION', 'MRO_EXPANSION', 'SUPPLIER_RELATIONSHIP', 'OUTSOURCING',
    'AIRPORT_OPERATION', 'CONTRACT_ANNOUNCEMENT', 'LEADERSHIP_CHANGE',
    'REGULATORY_DEVELOPMENT', 'RESTRUCTURING', 'FINANCING_ACTIVITY',
    'GEOGRAPHIC_EXPANSION', 'OPERATIONAL_DISRUPTION', 'PROCUREMENT_ACTIVITY',
    'PARTNERSHIP_ANNOUNCEMENT', 'TECHNOLOGY_ADOPTION', 'STRATEGIC_CHANGE', 'OTHER'
  ));

alter table public.commercial_opportunities
  add column if not exists primary_source_id uuid references public.commercial_sources(id) on delete set null;

alter table public.commercial_opportunities
  drop constraint if exists commercial_opportunities_evidence_check;
alter table public.commercial_opportunities
  add constraint commercial_opportunities_evidence_check
  check (signal_id is not null or primary_source_id is not null) not valid;

create table if not exists public.commercial_recommended_actions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete cascade,
  person_id uuid references public.commercial_people(id) on delete set null,
  evidence_source_id uuid not null references public.commercial_sources(id) on delete restrict,
  action_type text not null check (action_type in (
    'RESEARCH_ORGANISATION', 'MONITOR_SIGNAL', 'IDENTIFY_DECISION_MAKER',
    'CONTACT_PERSON', 'PREPARE_AVIATION_MESSAGE', 'INVESTIGATE_CONTRACT_EXPOSURE',
    'FOLLOW_UP_LATER'
  )),
  action_text text not null,
  reason text not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  status text not null default 'NEW' check (status in ('NEW', 'REVIEWED', 'QUALIFIED', 'DISMISSED', 'ACTIONED')),
  reasoning_method text not null default 'MANUAL' check (reasoning_method in ('DETERMINISTIC', 'AI_GROUNDED', 'MANUAL')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, action_type, action_text)
);

alter table public.commercial_evidence_links
  drop constraint if exists commercial_evidence_links_entity_type_check;
alter table public.commercial_evidence_links
  add constraint commercial_evidence_links_entity_type_check
  check (entity_type in ('COMPANY', 'PERSON', 'SIGNAL', 'OPPORTUNITY', 'ACTION'));

create index if not exists commercial_actions_review_idx
  on public.commercial_recommended_actions (status, updated_at desc);
create index if not exists commercial_actions_opportunity_idx
  on public.commercial_recommended_actions (opportunity_id, status);
create index if not exists commercial_signals_review_idx
  on public.commercial_signals (review_status, created_at desc);

alter table public.commercial_recommended_actions enable row level security;
revoke all on public.commercial_recommended_actions from anon, authenticated;
grant all on public.commercial_recommended_actions to service_role;