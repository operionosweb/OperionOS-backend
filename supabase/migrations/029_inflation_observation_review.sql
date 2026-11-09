-- Inflation requires a new category and a recorded human verification boundary.
-- Apply only through the approved Operion migration workflow, not OCI migrations.
alter table public.external_market_observations
  drop constraint external_market_observations_category_check;
alter table public.external_market_observations
  add constraint external_market_observations_category_check
  check (category in ('fuel', 'fx', 'interest', 'inflation'));
alter table public.external_market_observations
  add column reviewed_by uuid,
  add column reviewed_at timestamptz;
alter table public.external_market_observations
  add constraint inflation_observation_review_required
  check (category <> 'inflation' or (
    reviewed_by is not null and reviewed_at is not null
    and publication_timestamp is not null
    and date_trunc('month', observation_date::timestamp)::date = observation_date
    and publication_timestamp >= observation_date
    and reviewed_at >= publication_timestamp
  ));
