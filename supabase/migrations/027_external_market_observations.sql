create table if not exists public.external_market_observations (
  id uuid primary key default gen_random_uuid(),
  indicator_id text not null,
  category text not null check (category in ('fuel', 'fx', 'interest')),
  value numeric(24, 10) not null,
  unit text not null,
  currency text,
  base_currency text,
  quote_currency text,
  market_applicability text,
  observation_date date not null,
  publication_timestamp timestamptz,
  retrieval_timestamp timestamptz not null,
  source_id text not null,
  source_reference text not null,
  data_quality_status text not null
    check (data_quality_status in ('verified', 'unverified')),
  record_type text not null
    check (record_type in ('published_observation', 'forecast', 'unverified')),
  is_historical boolean not null default false,
  update_status text not null default 'recorded'
    check (update_status in ('recorded', 'revision')),
  created_at timestamptz not null default now(),
  check (length(trim(indicator_id)) > 0),
  check (length(trim(unit)) > 0),
  check (length(trim(source_id)) > 0),
  check (length(trim(source_reference)) > 0),
  check (value > 0),
  check (
    category <> 'fx'
    or (base_currency is not null and quote_currency is not null and base_currency <> quote_currency)
  )
);

create unique index if not exists external_market_observations_dedupe_idx
  on public.external_market_observations (
    source_id,
    indicator_id,
    observation_date,
    value,
    unit,
    coalesce(currency, ''),
    coalesce(base_currency, ''),
    coalesce(quote_currency, '')
  );

create index if not exists external_market_observations_latest_idx
  on public.external_market_observations (indicator_id, observation_date desc, retrieval_timestamp desc);

alter table public.external_market_observations enable row level security;
revoke all on public.external_market_observations from public, anon, authenticated;
grant select, insert on public.external_market_observations to service_role;
