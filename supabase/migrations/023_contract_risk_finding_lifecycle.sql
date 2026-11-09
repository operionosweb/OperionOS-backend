alter table public.risks
  drop constraint if exists risks_status_check;

alter table public.risks
  add constraint risks_status_check check (status in (
    'identified', 'validated', 'requires_review', 'informational',
    'active_analysis', 'analysis_failed', 'resolved', 'superseded'
  ));
