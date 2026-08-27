# Step 3 Document Parsing and Structural Intelligence

Step 3 adds deterministic structural processing after upload:

`document text -> pages -> sections/subsections -> fixed-size chunks`

The implementation is in `services/documentStructureService.js`. It has no AI or provider dependency. It preserves exact source offsets, computes SHA-256 content hashes for pages and chunks, recognizes numbered/article/section headings, and links nested sections through `parent_section_id` during persistence.

Upload now persists pages into `contract_document_pages` and structure into the existing `contract_sections` and `contract_document_chunks` tables. The tenant-scoped read surface is `GET /api/documents/:id/structure`. The Contract Workspace displays page/section hierarchy and chunk counts.

Page boundaries are honest: explicit form-feed boundaries are represented as pages. When the source parser cannot provide page boundaries, the structure reports `derived_unavailable` rather than inventing PDF page numbers. PDF/DOCX text extraction remains deterministic metadata processing; clause semantics, obligations, risk, embeddings, and other AI operations are not invoked.

The default chunk size is 4,000 characters. Chunking is deterministic and does not consume AI Intelligence Budget. Structural persistence is organization-scoped through every query and row.

Migration `009_document_structure_pages.sql` adds the durable page table with organization-scoped RLS. Validation: 120 backend tests pass, frontend production build passes, changed-file diagnostics pass, and `git diff --check` passes. Live Supabase RLS/storage execution remains pending because no dedicated test database is available; production data was not used.
