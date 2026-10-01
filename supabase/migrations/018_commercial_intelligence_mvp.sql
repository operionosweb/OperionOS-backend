create table if not exists public.commercial_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  legal_name text,
  website text,
  country text,
  region text,
  aviation_segment text not null check (aviation_segment in (
    'Airline', 'Aircraft Leasing', 'MRO', 'Airport', 'Ground Handling',
    'Aviation Consultancy', 'Aviation Services', 'Aircraft Manufacturer',
    'Engine Manufacturer', 'Aviation Supplier', 'Other Aviation'
  )),
  company_type text,
  fleet_information text,
  aviation_activities jsonb not null default '[]'::jsonb,
  known_contract_categories jsonb not null default '[]'::jsonb,
  operational_characteristics jsonb not null default '[]'::jsonb,
  likely_pain_points jsonb not null default '[]'::jsonb,
  operion_relevance text,
  intelligence_status text not null default 'DRAFT' check (intelligence_status in ('DRAFT', 'RESEARCHING', 'REVIEWED', 'ARCHIVED')),
  opportunity_status text not null default 'IDENTIFIED' check (opportunity_status in ('IDENTIFIED', 'ACTIVE', 'CUSTOMER', 'DISQUALIFIED')),
  internal_notes text,
  origin text not null default 'MANUAL' check (origin in ('MANUAL', 'EXTERNAL_SOURCE', 'AI_ENRICHED')),
  entity_resolution jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text,
  source_url text,
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  excerpt text,
  source_type text not null check (source_type in ('COMPANY_WEBSITE', 'NEWS', 'REGULATORY', 'PUBLIC_FILING', 'INDUSTRY', 'MANUAL_NOTE', 'OTHER')),
  verification_status text not null default 'UNVERIFIED_SIGNAL' check (verification_status in ('VERIFIED_FACT', 'AI_INFERENCE', 'UNVERIFIED_SIGNAL')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  name text,
  role_title text not null,
  role_category text not null check (role_category in ('CEO', 'CFO', 'GENERAL_COUNSEL', 'HEAD_OF_LEGAL', 'COO', 'HEAD_OF_OPERATIONS', 'CPO', 'HEAD_OF_PROCUREMENT', 'FLEET_DIRECTOR', 'HEAD_OF_LEASING', 'CONTRACTS_DIRECTOR', 'COMMERCIAL_DIRECTOR', 'RISK_DIRECTOR', 'DIGITAL_TRANSFORMATION_DIRECTOR', 'OTHER')),
  linkedin_url text,
  email text,
  relevance_reason text,
  decision_scope text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'UNVERIFIED_SIGNAL' check (verification_status in ('VERIFIED_FACT', 'AI_INFERENCE', 'UNVERIFIED_SIGNAL')),
  origin text not null default 'MANUAL' check (origin in ('MANUAL', 'EXTERNAL_SOURCE', 'AI_ENRICHED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  signal_type text not null check (signal_type in ('FLEET_EXPANSION', 'FLEET_RENEWAL', 'AIRCRAFT_ACQUISITION', 'AIRCRAFT_DISPOSAL', 'NETWORK_EXPANSION', 'MRO_EXPANSION', 'SUPPLIER_RELATIONSHIP', 'OUTSOURCING', 'AIRPORT_OPERATION', 'CONTRACT_ANNOUNCEMENT', 'LEADERSHIP_CHANGE', 'REGULATORY_DEVELOPMENT', 'RESTRUCTURING', 'FINANCING_ACTIVITY', 'GEOGRAPHIC_EXPANSION', 'OPERATIONAL_DISRUPTION', 'PROCUREMENT_ACTIVITY', 'OTHER')),
  description text not null,
  signal_date date,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  relevance text,
  operion_implication text,
  verification_status text not null default 'UNVERIFIED_SIGNAL' check (verification_status in ('VERIFIED_FACT', 'AI_INFERENCE', 'UNVERIFIED_SIGNAL')),
  origin text not null default 'MANUAL' check (origin in ('MANUAL', 'EXTERNAL_SOURCE', 'AI_ENRICHED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  signal_id uuid references public.commercial_signals(id) on delete set null,
  key_person_id uuid references public.commercial_people(id) on delete set null,
  title text not null,
  opportunity_type text not null check (opportunity_type in ('CONTRACT_INTELLIGENCE', 'CONTRACT_RISK', 'CONTRACT_COMPLIANCE', 'CONTRACT_RENEWAL', 'SUPPLIER_RISK', 'AVIATION_OPERATIONAL_RISK', 'PREDICTIVE_CONTRACT_INTELLIGENCE', 'OTHER')),
  aviation_segment text,
  potential_contract_use_case text,
  why_company text,
  why_now text,
  why_operion text,
  why_person text,
  value_hypothesis text,
  recommended_approach jsonb not null default '{}'::jsonb,
  suggested_outreach jsonb not null default '{}'::jsonb,
  primary_next_action text,
  secondary_action text,
  status text not null default 'IDENTIFIED' check (status in ('IDENTIFIED', 'QUALIFYING', 'CONTACTED', 'ENGAGED', 'PILOT_DISCUSSION', 'PILOT', 'CUSTOMER', 'DISQUALIFIED')),
  priority text not null default 'MEDIUM' check (priority in ('HIGH', 'MEDIUM', 'LOW')),
  priority_reasons jsonb not null default '[]'::jsonb,
  reasoning_method text not null default 'DETERMINISTIC' check (reasoning_method in ('DETERMINISTIC', 'AI_GROUNDED', 'MANUAL')),
  origin text not null default 'MANUAL' check (origin in ('MANUAL', 'EXTERNAL_SOURCE', 'AI_ENRICHED')),
  created_by uuid references auth.users(id) on delete set null,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_evidence_links (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.commercial_sources(id) on delete cascade,
  entity_type text not null check (entity_type in ('COMPANY', 'PERSON', 'SIGNAL', 'OPPORTUNITY')),
  entity_id uuid not null,
  claim text,
  support_type text not null default 'SUPPORTS' check (support_type in ('SUPPORTS', 'CONTRADICTS', 'CONTEXT')),
  created_at timestamptz not null default now(),
  unique (source_id, entity_type, entity_id, claim)
);

create index if not exists commercial_companies_review_idx on public.commercial_companies (intelligence_status, last_reviewed_at desc);
create unique index if not exists commercial_companies_identity_uidx on public.commercial_companies (normalized_name, coalesce(country, ''));
create index if not exists commercial_people_company_idx on public.commercial_people (company_id, role_category);
create index if not exists commercial_signals_company_date_idx on public.commercial_signals (company_id, signal_date desc);
create index if not exists commercial_opportunities_status_idx on public.commercial_opportunities (status, priority, updated_at desc);
create index if not exists commercial_evidence_entity_idx on public.commercial_evidence_links (entity_type, entity_id);

alter table public.commercial_companies enable row level security;
alter table public.commercial_sources enable row level security;
alter table public.commercial_people enable row level security;
alter table public.commercial_signals enable row level security;
alter table public.commercial_opportunities enable row level security;
alter table public.commercial_evidence_links enable row level security;

revoke all on public.commercial_companies, public.commercial_sources, public.commercial_people,
  public.commercial_signals, public.commercial_opportunities, public.commercial_evidence_links from anon, authenticated;
grant all on public.commercial_companies, public.commercial_sources, public.commercial_people,
  public.commercial_signals, public.commercial_opportunities, public.commercial_evidence_links to service_role;