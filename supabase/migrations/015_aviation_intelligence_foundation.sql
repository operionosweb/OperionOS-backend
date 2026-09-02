create table if not exists public.aircraft (
  id uuid primary key default gen_random_uuid(),
  registration text,
  icao24 text,
  callsign text,
  aircraft_type text,
  icao_type_designator text,
  manufacturer text,
  model text,
  operator_name text,
  serial_number text,
  category text,
  country_code text,
  data_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source, icao24)
);

create table if not exists public.aircraft_organization_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('owns', 'leases', 'operates', 'manages')),
  active boolean not null default true,
  effective_from date,
  effective_to date,
  source_reference text,
  created_at timestamptz not null default now(),
  unique (organization_id, aircraft_id, relationship_type)
);

create table if not exists public.aviation_flights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aircraft_id uuid references public.aircraft(id) on delete set null,
  provider_flight_id text,
  flight_number text,
  callsign text,
  origin_iata text,
  origin_icao text,
  destination_iata text,
  destination_icao text,
  scheduled_departure timestamptz,
  actual_departure timestamptz,
  scheduled_arrival timestamptz,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  status text,
  route jsonb,
  data_source text not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, data_source, provider_flight_id)
);

create table if not exists public.flight_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flight_id uuid not null references public.aviation_flights(id) on delete cascade,
  aircraft_id uuid references public.aircraft(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  altitude_meters double precision,
  ground_speed_kph double precision,
  track_degrees double precision check (track_degrees is null or track_degrees between 0 and 360),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  vertical_speed_mps double precision,
  squawk text,
  on_ground boolean,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  data_source text not null,
  unique (organization_id, flight_id, observed_at)
);

create table if not exists public.aircraft_contract_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('governed_by', 'leased_under', 'operated_under', 'maintained_under', 'insured_under', 'financed_under', 'supported_by')),
  active boolean not null default true,
  effective_from date,
  effective_to date,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  source_reference text,
  created_at timestamptz not null default now(),
  unique (organization_id, aircraft_id, contract_id, relationship_type)
);

create index if not exists aircraft_organization_active_idx on public.aircraft_organization_relationships (organization_id, active, aircraft_id);
create index if not exists aviation_flights_organization_updated_idx on public.aviation_flights (organization_id, source_updated_at desc);
create index if not exists flight_positions_scope_time_idx on public.flight_positions (organization_id, flight_id, observed_at desc);
create index if not exists aircraft_contract_scope_idx on public.aircraft_contract_relationships (organization_id, aircraft_id, active);

alter table public.aircraft enable row level security;
alter table public.aircraft_organization_relationships enable row level security;
alter table public.aviation_flights enable row level security;
alter table public.flight_positions enable row level security;
alter table public.aircraft_contract_relationships enable row level security;

create policy aircraft_member_select on public.aircraft for select to authenticated using (exists (
  select 1 from public.aircraft_organization_relationships relationship
  where relationship.aircraft_id = id and relationship.active and public.is_organization_member(relationship.organization_id)
));
create policy aircraft_organization_member_select on public.aircraft_organization_relationships for select to authenticated using (public.is_organization_member(organization_id));
create policy aviation_flights_member_select on public.aviation_flights for select to authenticated using (public.is_organization_member(organization_id));
create policy flight_positions_member_select on public.flight_positions for select to authenticated using (public.is_organization_member(organization_id));
create policy aircraft_contract_member_select on public.aircraft_contract_relationships for select to authenticated using (public.is_organization_member(organization_id));

grant select on public.aircraft, public.aircraft_organization_relationships, public.aviation_flights, public.flight_positions, public.aircraft_contract_relationships to authenticated;
grant all on public.aircraft, public.aircraft_organization_relationships, public.aviation_flights, public.flight_positions, public.aircraft_contract_relationships to service_role;