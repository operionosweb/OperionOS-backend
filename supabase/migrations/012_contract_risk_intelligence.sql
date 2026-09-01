alter table public.risks
  drop constraint if exists risks_risk_category_check,
  drop constraint if exists risks_risk_category_check1;

alter table public.risks
  add column if not exists risk_type text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists rationale text,
  add column if not exists source_type text,
  add column if not exists source_references jsonb not null default '[]'::jsonb,
  add column if not exists financial_exposure jsonb,
  add column if not exists consequence text,
  add column if not exists affected_obligation_ids uuid[] not null default '{}',
  add column if not exists affected_deadline_ids uuid[] not null default '{}',
  add column if not exists condition text,
  add column if not exists status text not null default 'identified',
  add column if not exists risk_version text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists risk_identity text;

alter table public.risks
  add constraint risks_contract_category_check check (risk_category in (
    'liability', 'indemnity', 'insurance', 'payment/commercial',
    'maintenance/operational', 'delivery/redelivery', 'termination/default',
    'compliance/sanctions', 'data protection/confidentiality',
    'service-level/performance', 'missing protection',
    'financial', 'operational', 'compliance', 'timing',
    'termination_default', 'commercial', 'dependency', 'data_information'
  )),
  add constraint risks_source_type_check check (source_type in (
    'clause', 'obligation', 'deadline', 'condition', 'trigger', 'consequence',
    'contractual_definition', 'cross_reference', 'multiple'
  )),
  add constraint risks_status_check check (status in (
    'identified', 'validated', 'requires_review', 'informational',
    'active_analysis', 'analysis_failed'
  )),
  add constraint risks_probability_absent_check check (probability is null),
  add constraint risks_identity_check check (risk_identity is null or risk_identity ~ '^[0-9a-f]{64}$');

create unique index if not exists risks_identity_scope_uidx
  on public.risks (organization_id, analysis_run_id, risk_identity);

create index if not exists risks_contract_version_scope_idx
  on public.risks (organization_id, contract_id, document_version_id, analysis_run_id, severity);

create index if not exists risks_obligation_ids_idx
  on public.risks using gin (affected_obligation_ids);

create index if not exists risks_deadline_ids_idx
  on public.risks using gin (affected_deadline_ids);