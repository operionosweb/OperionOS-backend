alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;
alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role in (
    'member', 'manager', 'admin', 'owner',
    'VIEWER', 'ANALYST', 'CONTRACT_MANAGER', 'ORG_ADMIN'
  ));

create table if not exists public.platform_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('SUPERADMIN', 'OPERION_ADMIN', 'OPERION_ANALYST')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists platform_user_roles_active_idx
  on public.platform_user_roles (user_id, role)
  where status = 'active';

alter table public.platform_user_roles enable row level security;
revoke all on public.platform_user_roles from anon, authenticated;
grant all on public.platform_user_roles to service_role;