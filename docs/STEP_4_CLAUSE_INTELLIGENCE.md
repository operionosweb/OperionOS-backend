# Step 4 Clause Intelligence

Step 4 adds explicit semantic clause analysis on top of the deterministic Step 3 structure.

The workflow is:

`structured chunks -> deterministic relevance selection -> AI Gateway -> strict clause schema -> source evidence -> analysis run/database`

The implementation is in `services/clauseIntelligenceService.js`. Candidate selection uses legal/obligation terms, returns only positively relevant chunks when signals exist, and caps the request at 12 chunks. No whole-document prompt is sent.

The API action is `POST /api/contracts/:id/analyze` with `document_version_id` and optional `confirmation`. It requires authentication, organization membership, and contract write permission. Upload does not invoke this action. The Gateway remains responsible for provider routing, budget checks, caching, and tenant scope.

Every semantic clause must contain a title, bounded confidence, review status, allowed category, source chunk indexes, and source text. The service verifies referenced chunks, uses persisted source text for evidence, records character offsets when available, stores provider/model provenance from the Gateway job, and persists clauses, evidence, clause-evidence links, and the completed/failed analysis run.

The Contract Workspace exposes an explicit `Analyse clauses` action and displays returned clause intelligence. Analysis failures are surfaced without claiming success.

Validation: 122 backend tests pass, frontend production build passes, changed-file diagnostics pass, and `git diff --check` passes. Live Supabase RLS/storage/database verification remains pending because no dedicated test database is available; production data was not used.
