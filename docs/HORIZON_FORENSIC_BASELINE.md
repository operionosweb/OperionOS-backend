# Operion OS Horizon Forensic Baseline

Date: 2026-08-20
Canonical repository: `operionosweb/OperionOS-backend`
Reference archive: `C:\Users\meeli\Downloads\Operion OS Horizon web.zip`

## Scope and Evidence

This baseline was rebuilt from the current workspace and the newly located Horizon ZIP. The ZIP was extracted to a temporary analysis directory because it is not part of the Git working tree. The archive contains duplicate entries for four web files (`ProfileAPI.js`, `APIIntegrations.jsx`, `Toast.jsx`, and `Pagination.jsx`); those duplicates are treated as archive-integrity/stale-copy evidence, not as separate implementations.

The current workspace contains three relevant application surfaces:

- The canonical Git repository `OperionOS-backend`, cloned from `https://github.com/operionosweb/OperionOS-backend.git`.
- A nested Vite frontend inside that repository at `frontend/`.
- A separate workspace prototype at `Operion VS Code & Kilo/` containing a Next.js frontend and FastAPI backend. It is not a second canonical repository for Operion OS.

The Horizon archive is a monorepo with `apps/api`, `apps/web`, and `apps/pocketbase`. Its API has 25 route modules and its PocketBase application contains 408 migration files. It is a reference implementation, not a migration source.

## Executive Findings

### Critical

1. **Credentials are present in the Horizon archive's committed `apps/api/.env`.** The file contains a JWT secret and PocketBase/admin configuration values. Treat all values as compromised: rotate them, remove the file from any published history, and add secret scanning to the canonical repository. No secret values are reproduced here.
2. **Tenant isolation is not established in the current runtime.** The current backend registers `tenantContext` globally, but most routes do not require a verified user or organization membership. The legacy contract routes expose unauthenticated reads, use a shared API key for writes, and the Horizon route accepts a caller-supplied `tenant` body value.
3. **The current backend uses a Supabase service-role client in application services.** That bypasses Supabase RLS. Every service-role query must enforce organization scope in application code or move the request path to a user-scoped Supabase client/RPC boundary.

### High

4. **There are competing data models and migration roots.** The current repository has `routes/supabase/migrations` with supplier/clause/obligation/risk tables and `supabase/migrations` with the Phase 1 organization/contract/audit foundation. Neither is the single authoritative schema yet.
5. **The current contract write path performs ingestion, AI analysis, embedding, and portfolio analytics in one service call.** `services/contractService.js` imports multiple AI/vector engines directly. This makes retries, idempotency, auditability, and failure isolation difficult.
6. **The Horizon API has broad unauthenticated route exposure.** `apps/api/src/routes/ai.js` and `apps/api/src/routes/audit-log.js` define handlers without attaching `authenticateToken` at the router boundary. Audit-log filters are assembled from request values and should not be copied into the canonical API.
7. **Horizon PocketBase startup is coupled to a local superuser.** `pocketbaseClient.js` authenticates a superuser during module initialization and exits the process when PocketBase is unavailable. This is unsuitable as the canonical request authorization model.

### Medium

8. **The canonical repository has multiple frontend histories.** `frontend/` is a Vite application inside the backend repository, while the other workspace has a Next.js application and legacy pages. Keep one frontend runtime in the canonical repository and archive/remove the others after a deliberate migration decision.
9. **The canonical backend has a large set of overlapping engines.** Contract extraction, clause parsing, risk scoring, ingestion, copilot, economics, portfolio, search, memory, and orchestration appear in multiple modules. Names alone do not establish a stable contract between them.
10. **The Horizon archive also contains duplicate/stale product surfaces.** Its four duplicate ZIP entries and large collection of demo contexts, mock data, dashboard components, and alternate routes indicate that visual/product breadth exceeds the certainty of the underlying production contracts.

## What Horizon Provides

Horizon is valuable as a product and domain reference:

- A mature aviation/maritime operations vocabulary: movement plans, providers, alerts, reports, execution status, fleet/contract views, obligations, audit views, and dashboards.
- A broad contract-intelligence presentation model: contracts, versions, clauses, obligations, risk categories, liability exposure, insurance analysis, executive summaries, variance, health/sync state, and clause usage.
- A multi-provider UI and AI concept, including provider comparison and AI chat surfaces.
- An explicit audit-log product surface and a large evolving persistence history in PocketBase migrations.
- A cohesive monorepo shape: one root package with `apps/web`, `apps/api`, and `apps/pocketbase`.
- Useful frontend interaction patterns and domain terminology, subject to product validation and accessibility review.

Horizon does **not** provide a safe canonical security or persistence foundation. PocketBase, superuser access, committed environment values, client-side demo state, and migration history must not be copied wholesale.

## Current Repository Assessment

### Keep

- `OperionOS-backend` as the only GitHub repository and system-of-record.
- The existing Express/ESM runtime and its deployable Node 20 target.
- Supabase/PostgreSQL as the persistence direction.
- The newly added Phase 1 concepts: authenticated user, organization membership, organization-scoped context, canonical contracts/versions/clauses/obligations, and audit events.
- Aviation-specific domain engines as isolated candidates for later adaptation, after contracts and tests are defined.

### Adapt

- Horizon's contract concepts into the canonical relational model, preserving normalized entities rather than denormalized AI response blobs.
- Horizon's dashboard/product vocabulary into API DTOs owned by canonical domain modules.
- Existing AI provider routing, extraction normalization, risk analysis, embeddings, and audit traces behind asynchronous application services and explicit versioned schemas.
- The nested Vite frontend only if it is selected as the canonical client; otherwise migrate validated screens into one chosen frontend and delete the duplicate runtime.

### Rebuild

- Authentication and authorization around one identity provider, verified bearer tokens, explicit organization membership, role/permission checks, and request-scoped authorization.
- Database ownership and migrations into one `supabase/migrations` chain with RLS policies, organization foreign keys, and tested service-layer scope enforcement.
- Contract ingestion as an idempotent workflow: upload, immutable document/version, extraction job, normalized clauses/obligations, risk assessments, and audit events.
- Audit as append-only, organization-scoped, actor/request/model aware persistence rather than console logs or Redis-only traces.
- API boundaries with request validation, consistent error handling, rate limits, CORS allowlists, security headers, and route-level auth declarations.
- Test coverage around auth, tenant isolation, RLS, ingestion idempotency, schema normalization, and AI failure/retry behavior.

### Discard

- Horizon's committed secrets and any copied credentials.
- PocketBase superuser request plumbing as a production authorization mechanism.
- Client-supplied tenant values, default organizations, shared API keys for user actions, and unauthenticated contract intelligence routes.
- Demo-only mock datasets and presentation-only fields as persistence contracts.
- Duplicate migration roots and alternate implementations after their contents are reconciled.
- Any AI engine that cannot return a versioned, validated schema with provenance and an auditable failure state.

## Duplication Register

| Area | Current/Horizon evidence | Decision |
| --- | --- | --- |
| Frontend | Canonical `frontend/`, separate workspace `frontend/`, Horizon `apps/web` | Select one client runtime inside the canonical repo; migrate by feature, then remove duplicates |
| Persistence | `routes/supabase/migrations`, `supabase/migrations`, Horizon `apps/pocketbase/pb_migrations` | Keep only canonical Supabase migrations; use Horizon migrations as domain evidence |
| Ingestion | `contractIngestionEngine.js` and `contractIngestionService.js` | Define one ingestion port and one implementation |
| Extraction | `aiExtractionService.js`, `clauseParser.js`, `contractExtractionEngine.js`, Horizon AI/UI extraction concepts | Keep provider adapters separate from normalization and persistence |
| Risk | `contractRiskEngine.js`, `contractRiskScoringEngine.js`, `portfolioRiskEngine.js`, Horizon risk dashboards | Split contract risk assessment from portfolio aggregation; version both |
| Audit | `auditService.js`, `auditEngine.js`, `foundationAuditService.js`, Horizon `audit-log.js` | Use one append-only relational audit contract; Redis may be a derived queue/cache only |
| Auth | API-key middleware, admin JWT login, Supabase client, Horizon PocketBase auth, prototype FastAPI JWT | Choose Supabase Auth/user JWT plus organization membership |
| Search/memory | `searchEngine.js`, semantic/vector services, Horizon search and demo data | Define a canonical read model and retrieval interface before adding embeddings |

## Target Operion OS Architecture

```text
React/Vite client in canonical repo
        |
        v
Express API composition root
        |
        +-- request ID, security headers, CORS allowlist, rate limits
        +-- bearer-token verification
        +-- organization membership and permission policy
        +-- validated route command/query
        |
        +-- domain application services
        |     +-- organizations and memberships
        |     +-- contracts and immutable versions
        |     +-- clauses and obligations
        |     +-- risk assessments and portfolio projections
        |     +-- audit events
        |
        +-- repositories / Supabase boundary
        |     +-- organization-scoped queries
        |     +-- RLS-backed user access
        |     +-- service-role jobs with explicit scope
        |
        +-- asynchronous jobs
              +-- document extraction
              +-- provider/LLM routing
              +-- embeddings and search projections
              +-- notifications and scheduled risk checks

Supabase PostgreSQL + Storage + Auth
```

The domain API should never accept organization ownership from a request body. The organization must come from verified membership context, and every persisted domain row must carry an organization foreign key or have an auditable ownership path.

## Canonical Phase Gates

Before production contract data or AI processing is enabled:

1. Rotate and revoke all credentials found in the Horizon archive and scan Git history.
2. Select and rename one migration root; reconcile current SQL before applying new migrations.
3. Apply and test organization membership and RLS policies against two organizations and two users.
4. Remove or protect legacy public contract, Horizon, admin, dashboard, search, provider, and copilot routes.
5. Add repository tests that prove user A cannot read, mutate, or search user B's organization data.
6. Define versioned DTOs for contracts, versions, clauses, obligations, risk assessments, and audit events.
7. Move extraction/embedding to jobs with idempotency keys and provider/model provenance.
8. Choose the canonical frontend runtime inside this repository and remove the competing client surface.

## Baseline Decision

Use the current `OperionOS-backend` repository as the canonical implementation base. Preserve Horizon as a read-only reference archive. Adopt its validated domain vocabulary and product workflows, but rebuild identity, tenancy, persistence, audit, asynchronous processing, and route security on the canonical Supabase/PostgreSQL architecture.
