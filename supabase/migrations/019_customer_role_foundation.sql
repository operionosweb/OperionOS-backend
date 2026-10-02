alter table public.organization_memberships
  drop constraint if exists organization_memberships_role_check;

alter table public.organization_memberships
  add constraint organization_memberships_role_check
  check (role in (
    'CUSTOMER_ADMIN', 'CUSTOMER_USER',
    'member', 'manager', 'admin', 'owner',
    'VIEWER', 'ANALYST', 'CONTRACT_MANAGER', 'ORG_ADMIN'
  ));

alter table public.organization_memberships
  alter column role set default 'CUSTOMER_USER';

comment on column public.organization_memberships.role is
  'Canonical roles are CUSTOMER_ADMIN and CUSTOMER_USER; other values are retained for existing memberships.';

-- Contract and document mutations are server-owned. Authenticated users retain
-- tenant-scoped reads, while backend APIs enforce organization role permissions.
drop policy if exists contracts_member_access on public.contracts;
drop policy if exists contracts_member_select on public.contracts;
create policy contracts_member_select on public.contracts
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists versions_member_insert on public.contract_versions;
drop policy if exists versions_member_update on public.contract_versions;
drop policy if exists versions_member_delete on public.contract_versions;

drop policy if exists documents_member_access on public.documents;
drop policy if exists documents_member_select on public.documents;
create policy documents_member_select on public.documents
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists document_versions_member_access on public.document_versions;
drop policy if exists document_versions_member_select on public.document_versions;
create policy document_versions_member_select on public.document_versions
  for select to authenticated
  using (public.is_organization_member(organization_id));

drop policy if exists contract_storage_member_insert on storage.objects;
drop policy if exists contract_storage_member_delete on storage.objects;