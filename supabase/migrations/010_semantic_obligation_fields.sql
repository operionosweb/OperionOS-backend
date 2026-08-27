-- Step 5: structured semantic obligation fields. No deadline or risk calculations.
alter table public.obligations
  add column if not exists actor text,
  add column if not exists action text,
  add column if not exists object text,
  add column if not exists beneficiary text,
  add column if not exists condition text,
  add column if not exists timing_expression text,
  add column if not exists consequence text,
  add column if not exists modality text not null default 'mandatory',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.obligations drop constraint if exists obligations_modality_check;
alter table public.obligations add constraint obligations_modality_check
  check (modality in ('mandatory', 'prohibited', 'discretionary', 'conditional'));
