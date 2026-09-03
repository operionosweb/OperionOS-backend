# Contract Intelligence Core Architecture

## Scope

This milestone extends the existing production contract pipeline. It does not add a second workspace, AI stack, document store, or aviation UI. Deterministic demo data remains an explicitly labelled fallback.

## Discovered architecture

- **Runtime:** Express 5 in `index.js`, with route modules under `routes/`.
- **Authentication and tenancy:** Supabase user authentication, organization membership, role permissions, organization predicates in repositories/services, and PostgreSQL RLS.
- **Database:** Supabase PostgreSQL migrations under `supabase/migrations/`. The production entities already include organizations, contracts, documents, versions, extractions, analysis runs, parties, clauses, obligations, deadlines, risks, recommendations, evidence, search chunks, aircraft, and aircraft-contract relationships.
- **Storage:** private Supabase Storage bucket `contract-documents`; immutable tenant-shaped object keys; source paths are removed from API responses.
- **Upload:** `POST /api/contracts/upload` accepts memory-buffered PDF/DOCX files, validates bytes/MIME/size, stores the original, and creates tenant-scoped contract, document, version, extraction, structure, and analysis-run records.
- **Text/structure:** `documentIngestionService` uses `pdf-parse` and `mammoth`; `documentStructureService` persists pages, sections, and chunks.
- **Intelligence stages:** Phase 3 services provide deterministic clauses, obligations, deadlines, risks, evidence, and optional existing AI-gateway normalization/reasoning.
- **AI:** the existing `aiGateway` and `contractAssistantService` are the only provider and grounded-answer paths to extend.
- **Search:** PostgreSQL search chunks and existing search services provide the foundation; results must remain tenant-scoped and evidence-addressable.
- **Aviation:** migration 015 already models global aircraft plus tenant-scoped many-to-many `aircraft_contract_relationships`.
- **Frontend:** the protected production `ContractWorkspace` already resolves contract -> document -> version -> analysis run -> intelligence APIs. The demo workspace and synthetic Live Tracking provider remain fallback surfaces.

## Implemented flow

Upload persists page-aware PDF or DOCX structure and creates a queued analysis run. `POST /api/analysis-runs/:id/process` now composes clauses, obligations, deadlines, risks, immutable profile generation, full-text indexing, and exact tenant-aircraft relationship matching behind explicit analysis state transitions. The production Contract Workspace invokes this operation, polls status, and displays the grounded profile and page-aware search results. Manual stage endpoints remain available for compatibility.

Migration `016_contract_intelligence_core.sql` and its clean-database/live validation coverage are implemented in the repository. It must be applied to the target Supabase environment before the profile, relationship-evidence, and contract metadata writes can run there.

## Implementation plan

1. Preserve actual PDF page boundaries and ordered DOCX blocks in the existing extraction representation.
2. Extend the current schema for supported contract metadata, classification confidence, summaries/claims, processing errors, and relationship evidence without duplicating Phase 3 tables.
3. Add deterministic aviation-first metadata/classification, summary, recommendation, and aircraft-identifier extraction services. Unknown values remain null.
4. Add one idempotent pipeline orchestrator over the existing clause, obligation, deadline, risk, evidence, search, and relationship repositories. Persist state transitions and terminal failures.
5. Expose orchestration, summary, search, evidence, and relationship capabilities through the existing contract/analysis/aviation route conventions with current auth and tenancy middleware.
6. Connect the existing production Contract Workspace and current Live Tracking dependency experience to these APIs, retaining explicit demo fallback.
7. Validate with a clearly synthetic aircraft-lease fixture. Core extraction tests remain deterministic; provider behavior is mocked where AI is exercised.

## Processing semantics

- Document ingestion states: `uploaded -> processing -> ready|requires_ocr|failed`.
- Analysis states: `queued -> processing -> extracting -> analysing -> indexing -> completed|failed`.
- `ready` means source text and structure are stored. It does not mean contract intelligence is complete.
- Reprocessing the same document version and pipeline version must reuse or replace the same scoped stage outputs rather than duplicate them.
- Errors expose a stable code and safe message while logs omit contract content.

## Evidence invariant

Every persisted finding or recommendation that asserts contract content must carry or resolve to the same tenant-scoped document version, page, clause/section, character/block locator, and exact source excerpt. Relative deadlines remain relative unless a supported trigger date establishes a calculation basis. Aircraft relationships require an identifier found in source evidence or an explicitly labelled demo fixture.
