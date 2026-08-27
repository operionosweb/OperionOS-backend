-- Step 2: allow deterministic PDF/DOCX contract ingestion without starting AI analysis.
alter table public.documents drop constraint if exists documents_mime_type_check;
alter table public.documents add constraint documents_mime_type_check check (
  mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
);

alter table public.document_versions drop constraint if exists document_versions_mime_type_check;
alter table public.document_versions add constraint document_versions_mime_type_check check (
  mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
);

-- Storage remains private. Replace the PDF-only path policy with the same
-- organization-scoped path contract for both supported source formats.
drop policy if exists contract_storage_member_read on storage.objects;
create policy contract_storage_member_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F-]+/documents/[0-9a-fA-F-]+/versions/[0-9a-fA-F-]+/source[.](pdf|docx)$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );

drop policy if exists contract_storage_member_insert on storage.objects;
create policy contract_storage_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F-]+/documents/[0-9a-fA-F-]+/versions/[0-9a-fA-F-]+/source[.](pdf|docx)$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );

drop policy if exists contract_storage_member_delete on storage.objects;
create policy contract_storage_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contract-documents'
    and name ~ '^organizations/[0-9a-fA-F-]+/documents/[0-9a-fA-F-]+/versions/[0-9a-fA-F-]+/source[.](pdf|docx)$'
    and public.is_organization_member(split_part(name, '/', 2)::uuid)
  );
