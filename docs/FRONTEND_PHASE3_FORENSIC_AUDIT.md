# Operion OS — Frontend Phase 3 Forensic Audit

Audit date: 2026-08-21
Scope: `frontend/` directory only (read-only audit; no source code modified).

---

## 1. Executive Summary

The current frontend is a **very early, disconnected prototype scaffold** — not a functioning product surface, and not yet meaningfully related to the verified Phase 2 / Phase 3A / Phase 3B backend foundation audited in parallel this session.

Key facts:
- There are **three competing, mutually-exclusive root entry points** (`frontend/App.jsx`, `frontend/src/App.jsx` rendered via `frontend/src/main.jsx`) with duplicated/divergent logic, not a single coherent application.
- There is **no router** (no `react-router-dom` or equivalent) and **no navigation system** — every page is a standalone component with its own `fetch`/`axios` calls and no shared layout.
- `frontend/package.json` is **misconfigured**: its `"name"` is `"operion-backend"` (appears to be a copy of the backend's `package.json`), and it lists **none of the packages the code actually imports** (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `recharts`, `socket.io-client`) while listing backend-only packages (`express`, `pg`, `stripe`, `multer`, `pdf-parse`) that the frontend does not use.
- A **hardcoded Supabase anon key and project URL** are committed in plaintext in `frontend/src/supabaseClient.js` (a second, unused Supabase client file, separate from the environment-variable-based one in `frontend/src/lib/supabaseClient.js`).
- A **hardcoded contract UUID** (`a339bfce-1c19-4fd9-bf05-130ebf1b1a7e`) is embedded in three different files as the only contract the UI can ever display.
- Auth token handling is inconsistent and unsafe: different pages read `localStorage.getItem("token")`, `localStorage.getItem("sb-token")`, or the in-memory Supabase session — none of which are the same value, meaning most pages' "authenticated" API calls are silently sending `Bearer undefined`.
- There is **no `Horizon`-named frontend code anywhere in this repository.** "Horizon" exists only as backend routes/services (`routes/horizonRoutes.js`, `services/*Horizon*`). The audit's assumption that a Horizon UI exists to forensically assess does not hold for this codebase as it currently stands — see §5.
- All frontend API calls target **legacy, pre-Phase-3 endpoints** (`/api/contracts/:id/decision`, `/api/ai/copilot`, `/api/maintenance/schedule`, `/api/control-center`) that have no relationship to the new Phase 3 route surface (`analysisRunRoutes.js`, `documentRoutes.js`, `foundationRoutes.js`) inspected on the backend side.
- One explicit mock-data block exists (`OperationsCenter.jsx`'s "MOCK ALERTS"); the rest of the data is a mix of real (but wrong-endpoint) `fetch`/`axios` calls returning into UI that assumes fields the current backend schema does not produce.

**Scores:**
- Architecture quality: **2/10** — no router, no shared layout, no state management, misconfigured build manifest, duplicate entry points.
- Product readiness: **1/10** — cannot display more than one hardcoded contract; not usable by a real user.
- Horizon quality: **N/A** — no Horizon frontend code exists to assess in this repository.
- Backend compatibility: **0/10** — zero frontend code calls any Phase 2/3A/3B endpoint; all calls target unrelated legacy routes.
- Technical debt: **HIGH-to-CRITICAL** (see §11).
- **Overall: 2/10.** This is not a foundation to refactor incrementally — it is a disposable prototype. Recommended direction: **structural rebuild**, reusing only the Supabase-auth concept and Tailwind visual language as a starting reference, not the code itself.

---

## 2. Current Architecture

| Aspect | Finding |
|---|---|
| Framework | React (JSX, `react-dom/client`), bundled via Vite (`vite.config.js` uses `@vitejs/plugin-react`). |
| Build system | Vite, but `frontend/package.json` declares **no** `vite`, `react`, `react-dom`, or `@vitejs/plugin-react` dependencies — the manifest does not match the code. `npm install` from this manifest would not produce a runnable app. |
| Routing | **None.** No `react-router-dom`, no route table, no `<Routes>`. `frontend/index.html` loads `src/main.jsx` → `src/App.jsx` directly; there is a second, separate `frontend/App.jsx` that is not wired to `index.html` at all (dead/orphaned file, or an alternate entry never connected). Pages under `src/pages/` (`Auth.jsx`, `ExecutiveDashboard.jsx`, `Copilot.jsx`, `ControlCenter.jsx`, `OperationsCenter.jsx`) are **not imported or rendered by anything** in `src/App.jsx` — they appear to be orphaned/unwired components. |
| State management | None (only local `useState`/`useEffect` per component). No Redux/Zustand/React Query/SWR. |
| API layer | None — no shared API client, no interceptor, no base-URL config module. Each file hardcodes its own `API` constant (`https://operionos-backend-1.onrender.com`) and repeats `fetch`/`axios` boilerplate. |
| Authentication | Supabase Auth (`supabase.auth.signInWithPassword`, `signUp`, `signOut`, `onAuthStateChange`) — used correctly in `Auth.jsx` and `AuthContext.jsx`, but the resulting session/token is **not consistently used** elsewhere (see §9). |
| Environment configuration | Only `frontend/src/lib/supabaseClient.js` uses `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` correctly. `frontend/src/supabaseClient.js` (used by the orphaned root `frontend/App.jsx`) hardcodes the URL and anon key directly in source instead. |
| Supabase integration | Two separate, inconsistent Supabase client instances exist (`src/supabaseClient.js` vs `src/lib/supabaseClient.js`), with different config (`persistSession`/`autoRefreshToken` only set in the `lib/` version). |
| Data fetching | Raw `fetch` (most files) or `axios` (`ExecutiveDashboard.jsx`) — no shared error/retry/caching layer. |
| Caching | None. |
| Error handling | Minimal — `try/catch` with `console.error` and a plain error string rendered in some pages; no error boundary, no toast/notification system. |
| Component architecture | Flat — no shared layout, header, sidebar, or design-system primitives. Every page re-implements its own header/loading/error markup inline. |
| Styling system | Mixed: some files use Tailwind utility classes (`ExecutiveDashboard.jsx`, `src/App.jsx`), others use inline `style={{...}}` objects exclusively (`OperationsCenter.jsx`, `ControlCenter.jsx`, `Auth.jsx`, `Copilot.jsx`). No Tailwind config file was found under `frontend/` (not inspected further beyond `vite.config.js`/`package.json`, since a config search is out of this audit's minimal-touch scope — its absence from `package.json` dependencies is itself a finding). |
| Design system | None — no shared tokens, no component library, no theme file. |
| TypeScript/JavaScript | Plain JavaScript/JSX throughout; no TypeScript. |
| Test infrastructure | **None found** — no test files, no test runner config, under `frontend/`. |

A separate, empty `frontend/operion/frontend/` directory exists containing only a stray `node_modules/` folder — no `package.json`, no `src/`. This is an orphaned artifact (likely from a misconfigured nested clone/checkout) and should be deleted once confirmed unnecessary — **not done in this audit**, flagged only.

---

## 3. Route Inventory

There is no router, so "routes" here means standalone page components that exist but are largely unwired to any navigation.

| Route/Page | Purpose | Functional? | Mocked? | Backend Endpoint | Relevant to new architecture? | Action |
|---|---|---|---|---|---|---|
| `frontend/App.jsx` (orphaned root entry) | Login + fetch a single hardcoded contract's "decision" | Partially — auth works, decision fetch targets a non-Phase-3 endpoint | No | `GET /api/contracts/:id/decision` (legacy) | No | REBUILD |
| `frontend/src/App.jsx` (actual wired entry, via `main.jsx`) | Fetch and render the same hardcoded contract's "decision" as an executive dashboard | Partially — no auth check at all, unauthenticated `fetch` | No | `GET /api/contracts/:id/decision` (legacy) | No | REBUILD |
| `src/pages/Auth.jsx` | Login/signup form | Yes (Supabase calls are real) | No | Supabase Auth directly | Partially (auth concept reusable) | REFACTOR |
| `src/pages/ExecutiveDashboard.jsx` | Duplicate of `src/App.jsx`'s dashboard, using `axios` + `localStorage.getItem("token")` | Partially — same hardcoded contract ID, token likely never set anywhere | No | `GET /api/contracts/:id/decision` (legacy) | No | REBUILD |
| `src/pages/Copilot.jsx` | Polls a fleet "AI Copilot" summary every 15s | Partially — real fetch, but to an unrelated legacy/simulated endpoint | No (data shape looks real-ish but endpoint is legacy) | `GET /api/ai/copilot` (legacy, unrelated to Phase 3) | No | DEFER / REBUILD (Copilot explicitly out of scope for Contract Intelligence Core per Rule 1) |
| `src/pages/ControlCenter.jsx` | Fleet risk dashboard with pie/bar charts (`recharts`) | Partially — real fetch, unrelated legacy endpoint | No | `GET /api/control-center` (legacy) | No | DEFER (fleet/aircraft risk, not contract intelligence) |
| `src/pages/OperationsCenter.jsx` | Maintenance calendar (`react-big-calendar`) + alerts | Partially — real fetch for schedule, **explicit mock data block for alerts** | **MIXED** (schedule real-ish call, alerts hard-coded array) | `GET /api/maintenance/schedule` (legacy) | No | DEFER |

None of these pages call, reference, or map to any of the new Phase 3 route groups (`analysisRunRoutes.js`, `documentRoutes.js`, `foundationRoutes.js`, `contractRoutes.js`, `searchRoutes.js`, `horizonRoutes.js`, `portfolioRoutes.js`, `operionDashboardRoutes.js`). **Zero backend compatibility with the new architecture exists today.**

---

## 4. Component Inventory

| Component/File | Classification | Reason |
|---|---|---|
| `frontend/App.jsx` | **REMOVE** | Orphaned duplicate entry point; not wired to `index.html`; superseded by `src/App.jsx`. |
| `frontend/src/App.jsx` | **REBUILD** | No auth guard, hardcoded contract ID, calls a legacy endpoint that has no relationship to Phase 3 evidence/clause/obligation data. |
| `src/context/AuthContext.jsx` | **REFACTOR** | Sound Supabase session pattern (`onAuthStateChange`, cleanup), but unused by any page except itself — no page consumes `useAuth()`. Worth keeping the pattern, needs to actually be wired into the app and extended with organization context. |
| `src/lib/supabaseClient.js` | **KEEP** (as the canonical client) | Correct environment-variable usage, sensible auth options (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`). This should be the *only* Supabase client going forward. |
| `src/supabaseClient.js` | **REMOVE** | Duplicate client with hardcoded secrets; a real security risk (see §9) and functionally redundant with `src/lib/supabaseClient.js`. |
| `src/lib/socket.js` | **DEFER** | Real-time socket connection to a legacy backend URL; not connected to any Phase 3 concept (no analysis-run progress/streaming exists yet on the backend). Revisit once/if analysis-run progress streaming is designed. |
| `src/utils/operionMapper.js` | **REBUILD** | Maps a `decision_chain` shape (`clause`, `why_it_matters`, `risk_trigger`, `owner`, `recommendation`, `severity_score`) that does not correspond to the Phase 3 evidence/clause schema (`clauses`, `intelligence_evidence`, `obligations`, `risks`, `recommendations` tables). The *idea* of a frontend mapper/adapter layer between backend and UI is worth keeping; this specific mapping is not. |
| `src/pages/Auth.jsx` | **REFACTOR** | Working login/signup logic; needs proper routing, loading states, and error UX instead of `window.location.href` hard navigation. |
| `src/pages/ExecutiveDashboard.jsx`, `src/pages/Copilot.jsx`, `src/pages/ControlCenter.jsx`, `src/pages/OperationsCenter.jsx` | **REBUILD or DEFER** | All target legacy, non-Phase-3 endpoints; none map to Contract Intelligence workflow stages. `ControlCenter`/`OperationsCenter`/`Copilot` are fleet-operations concepts, not contract-intelligence concepts — explicitly **OUT OF SCOPE / DEFER** per Rule 1 and Rule 4 until Contract Intelligence Core exists in the UI. |
| Chart/calendar library usage (`recharts` in `ControlCenter.jsx`, `react-big-calendar` in `OperationsCenter.jsx`) | **KEEP (as candidate libraries)** | Reasonable choices for future risk/deadline visualizations once wired to real Phase 3 data — but not the current implementations. |

No "generic dashboard components," "upload components," or "search components" exist anywhere in this frontend — there is no document upload UI, no analysis-run UI, no clause/evidence viewer, no search UI at all. These must be built from scratch (§7).

---

## 5. Horizon Assessment

**Finding: there is no Horizon-branded frontend implementation anywhere in this repository.** A repository-wide search for "Horizon" inside `frontend/` returned zero matches. "Horizon" exists exclusively as backend concepts (`routes/horizonRoutes.js` and related services on the backend side, outside this audit's frontend scope). 

Therefore the requested KEEP/REFACTOR/REBUILD/DEFER breakdown for "the existing Horizon implementation" cannot be produced against real code, because that code does not exist in this workspace. To avoid fabricating a Horizon UI assessment:

- **KEEP:** Nothing Horizon-specific exists to keep.
- **REFACTOR:** N/A.
- **REBUILD:** N/A.
- **DEFER:** N/A.

**What can be salvaged from the current (non-Horizon) prototype**, mapped onto the same KEEP/REFACTOR/REBUILD/DEFER framework the task requested for Horizon:
- **KEEP:** the Supabase-auth session pattern in `AuthContext.jsx`/`lib/supabaseClient.js`; the dark, card-based Tailwind visual language in `ExecutiveDashboard.jsx`/`src/App.jsx` (rounded-3xl cards, neutral-900/950 palette) as a *starting* visual reference only.
- **REFACTOR:** the "decision chain" concept (clause → why it matters → risk → recommendation) in `operionMapper.js` is conceptually close to the target Contract Intelligence workflow (clause → evidence → risk → recommendation) and could inform the new domain model, but its concrete shape must be rebuilt against the actual Phase 3 schema.
- **REBUILD:** all page components, the API layer, and the entry-point structure.
- **DEFER:** fleet/aircraft operational dashboards (`ControlCenter`, `OperationsCenter`, `Copilot`) — these are adjacent products, not Contract Intelligence, per Rule 1/Rule 4.

If a separate Horizon frontend repository exists outside this workspace, it was not accessible to this audit and must be separately reviewed before this assessment can be considered complete for Horizon specifically.

---

## 6. Backend Compatibility Matrix

| Frontend capability | Current endpoint called | New backend capability (Phase 3) | Compatible? | Required action |
|---|---|---|---|---|
| Contract "decision" dashboard | `GET /api/contracts/:id/decision` | No equivalent Phase 3 endpoint found among audited Phase 3 route files (`analysisRunRoutes.js`, `documentRoutes.js`, `foundationRoutes.js`) | **No** | Replace with calls against the Phase 3 analysis-run/clause/evidence endpoints once their HTTP surface is confirmed. |
| AI Copilot summary | `GET /api/ai/copilot` | Unrelated to Contract Intelligence Core; backend has a separate `copilotRoutes.js` not audited here | **Unknown/Out of scope** | Defer per Rule 1. |
| Maintenance schedule | `GET /api/maintenance/schedule` | No Phase 3 equivalent — this is fleet-maintenance domain, not contract intelligence | **No** | Defer/remove from Contract Intelligence product scope. |
| Fleet control center | `GET /api/control-center` | No Phase 3 equivalent | **No** | Defer. |
| Authentication | Supabase Auth directly (client-side) | Backend has its own `authRoutes.js`/`authMiddleware.js`/`userAuthMiddleware.js`, unaudited in this frontend-only pass | **Likely compatible in principle** (Supabase Auth is the shared identity layer) | Confirm the backend expects a Supabase-issued JWT in `Authorization: Bearer`, and standardize how the frontend attaches it (currently inconsistent — see §9). |
| Document upload | None exists | Backend has Phase 2 document ingestion (`documentRoutes.js`, `services/documentIngestionService.js`) | **No frontend counterpart at all** | Build from scratch. |
| Analysis run monitoring | None exists | Backend has `analysisRunRoutes.js`/`analysisRunService.js` with a defined state machine | **No frontend counterpart at all** | Build from scratch. |
| Clause/evidence viewer | None exists | Backend has the full Phase 3B deterministic clause + evidence model (`clauses`, `intelligence_evidence`, `clause_evidence`) | **No frontend counterpart at all** | Build from scratch. |
| Obligations/deadlines/risks/recommendations | None exists | Backend schema tables exist (`003_phase3a_foundation.sql`) though population (Phase 3C) is not yet authorized | **No frontend counterpart at all** | Build from scratch once Phase 3C is authorized. |
| Search | None exists | Backend has `searchRoutes.js`/`contract_search_chunks` foundation | **No frontend counterpart at all** | Build from scratch. |

---

## 7. Contract Intelligence Workflow Gap Analysis

| Stage | Existing frontend support | Current implementation | Backend compatible? | Missing UI | Priority |
|---|---|---|---|---|---|
| Upload contract | None | — | N/A (Phase 2 ingestion exists on backend) | Entire upload flow (file picker, progress, validation) | **Critical** |
| Document | None | — | N/A | Document list/detail view | **Critical** |
| Document version | None | — | N/A | Version history view | High |
| Analysis run | None | — | N/A (backend state machine exists) | Run trigger + status/progress view | **Critical** |
| Source pages | None | — | Backend intentionally reports `derived_unavailable` provenance | Page/source viewer honoring "derived vs available" honesty | Medium |
| Evidence | None | — | Backend has exact offset/hash contract | Evidence excerpt viewer linked from clauses | High |
| Clauses | None | — | Backend has deterministic clause segmentation (Phase 3B) | Clause list + detail, parent/child hierarchy view, category/confidence badges | **Critical** |
| Obligations | None | — | Schema exists, population not yet authorized (Phase 3C) | Deferred until Phase 3C | Deferred |
| Deadlines | None | — | Schema exists, not yet authorized | Deferred | Deferred |
| Risks | None | — | Schema exists, not yet authorized | Deferred | Deferred |
| Recommendations | None | — | Schema exists, not yet authorized | Deferred | Deferred |
| Search | None | — | Foundation exists (`contract_search_chunks`) | Search UI | Medium |

**Conclusion:** the frontend currently supports **zero** of the twelve target workflow stages. The entire Contract Intelligence UX must be built new; nothing in the current codebase should be "wired up" to it as-is.

---

## 8. Mock Data Inventory

| Location | Data | Classification |
|---|---|---|
| `frontend/src/pages/OperationsCenter.jsx` (`setAlerts([...])`, labeled `MOCK ALERTS` in-source) | Three hardcoded alert objects ("Aircraft OH-LWA approaching heavy maintenance threshold", etc.) | **MOCK DATA** |
| `frontend/App.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/ExecutiveDashboard.jsx` | Hardcoded contract UUID `a339bfce-1c19-4fd9-bf05-130ebf1b1a7e` used as the only contract the UI can ever query | **MIXED** — the fetch itself is real, but the input is a fixed demo record, not user-driven data |
| `frontend/src/supabaseClient.js` | Hardcoded Supabase URL + anon key (real-looking, not a placeholder) | **REAL BACKEND DATA (credential)**, but committed insecurely — see §9 |
| `frontend/src/pages/Copilot.jsx`, `ControlCenter.jsx`, `OperationsCenter.jsx` (schedule portion) | Live `fetch` calls to legacy endpoints | **REAL BACKEND DATA** (but from legacy/unrelated endpoints, not Phase 3) |

No fake obligations/risks/deadlines/recommendations arrays were found (unsurprising, since no UI exists for those concepts yet).

---

## 9. Authentication & Tenant Security Assessment

- **Authentication flow:** Supabase email/password auth is implemented correctly in `Auth.jsx` and `AuthContext.jsx` (`signInWithPassword`, `signUp`, `onAuthStateChange`, unsubscribe cleanup).
- **Token handling — inconsistent and broken across pages:**
  - `frontend/App.jsx` correctly reads `session?.access_token` from the live Supabase session.
  - `ExecutiveDashboard.jsx` reads `localStorage.getItem("token")` — a key that nothing in this codebase ever sets. This call will always send `Authorization: Bearer null`.
  - `OperationsCenter.jsx` and `ControlCenter.jsx` read `localStorage.getItem("sb-token")` — also never set anywhere in the codebase. Same problem.
  - `frontend/src/App.jsx` (the actual wired entry point) makes its data-fetch with **no Authorization header at all**.
- **Organization/tenant context:** **entirely absent.** No page or context reads or transmits an organization ID; there is no "current organization" concept, no organization switcher, and no mechanism to scope any request to a tenant. Given the backend's heavy organization-scoping/RLS model (confirmed in the parallel backend audit), the frontend today could not correctly participate in that model even for a single authenticated user.
- **Authorization / forbidden handling:** No page distinguishes 401 vs 403 vs other errors; all failures collapse into a generic `error.message` string.
- **Session refresh/logout:** `AuthContext.jsx` and `Auth.jsx` handle logout via `supabase.auth.signOut()` correctly (one via context, one via full-page navigation `window.location.href`), but since most pages don't consume `AuthContext` at all, logout state is not actually reflected in most of the UI.
- **Stale/expired sessions:** No handling — no interceptor exists to catch a 401 and force re-authentication.
- **Credential exposure risk:** `frontend/src/supabaseClient.js` hardcodes a real-looking Supabase URL and anon key directly in a source file that (based on the backend's own tracked-`.env` finding pattern from the parallel audit) may already be committed to version control. Anon keys are designed to be public, but committing them via hardcoding rather than environment variables is still poor practice and inconsistent with the correct pattern already present in `lib/supabaseClient.js`.

**Overall: the current frontend cannot safely or correctly participate in the backend's tenant/RLS model as built.** This must be redesigned as part of any rebuild — a single canonical API client that (a) always reads the live Supabase session token, (b) attaches an organization context header/param, and (c) handles 401/403 uniformly, is a hard prerequisite.

---

## 10. Design System Assessment

- **Typography:** No defined type scale; ad hoc Tailwind classes (`text-5xl font-bold`, `text-2xl font-bold`) repeated inconsistently across files with no shared component.
- **Color system:** A recognizable dark palette recurs (`bg-neutral-950`/`bg-neutral-900`, `border-neutral-800`, green/red/amber accents) across the Tailwind-based pages — this is the closest thing to a "visual language" worth preserving as a *starting reference* for the future spatial/premium redesign, but it is duplicated inline everywhere rather than defined as tokens.
- **Spacing/layout:** Ad hoc (`p-6`, `gap-6`, inline `style={{padding:24}}`) — no layout primitives (no `<Container>`, `<Grid>`, `<Stack>` components).
- **Cards/panels:** A repeated visual pattern (`bg-neutral-900 border border-neutral-800 rounded-3xl p-6`) appears across `ExecutiveDashboard.jsx`/`src/App.jsx` but is copy-pasted inline each time rather than extracted into a `<Card>` component — a clear, low-risk candidate for extraction in the rebuild.
- **Tables:** Only ad hoc `<div>` rows (`ControlCenter.jsx`'s fleet list) — no real table component.
- **Charts:** `recharts` (Pie/Bar) used once in `ControlCenter.jsx`; `react-big-calendar` used once in `OperationsCenter.jsx`. Reasonable library choices to keep evaluating for future evidence/deadline timeline visualizations.
- **Navigation, modals, drawers, tabs, command/search interfaces:** **None exist.**
- **Loading/empty/error states:** Present but minimal and inconsistent — every page reimplements its own full-screen "Loading..." div and its own error string render; no shared component.
- **Responsive behaviour:** Only Tailwind responsive prefixes (`lg:`, `xl:`, `md:`) in the Tailwind-based pages; the inline-style pages have no responsive handling at all.
- **Animation/motion:** None found.
- **Accessibility:** No ARIA attributes, no semantic landmarks, no focus management, no alt text (no images present); form inputs in `Auth.jsx` lack associated `<label>` elements.

**Conclusion:** there is no design system to "audit and reuse" beyond a rough color/card visual pattern. The future spatial/premium/motion-rich Operion design should be built as a genuine new design-token + component-primitive system; nothing here provides meaningful scaffolding beyond inspiration for the dark palette.

---

## 11. Technical Debt

### CRITICAL
- `frontend/package.json` does not declare the packages the app actually imports (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `recharts`, `socket.io-client`) and incorrectly declares itself `"name": "operion-backend"` — a fresh `npm install` would not produce a working app.
- Hardcoded Supabase credentials in `frontend/src/supabaseClient.js`.
- Hardcoded contract UUID as the only queryable contract, in three files.
- Broken/inconsistent auth-token retrieval (`localStorage` keys that are never set) in `ExecutiveDashboard.jsx`, `OperationsCenter.jsx`, `ControlCenter.jsx`.
- Three competing/duplicate root-level app implementations (`frontend/App.jsx`, `frontend/src/App.jsx`, plus unwired `src/pages/*`) with no single source of truth for the app's entry point.

### HIGH
- No router — pages exist but cannot be navigated to.
- No organization/tenant context anywhere in the frontend, incompatible with the backend's RLS/org-scoping model.
- Two divergent Supabase client instances (`src/supabaseClient.js` vs `src/lib/supabaseClient.js`).
- Zero frontend/backend schema alignment — every API call targets a legacy endpoint unrelated to the audited Phase 2/3A/3B data model.
- Orphaned `frontend/operion/frontend/` directory containing only a stray `node_modules/`.

### MEDIUM
- No shared API/error-handling layer (each page repeats its own `fetch`/`try-catch` boilerplate).
- No design tokens/reusable primitives — the "Card" pattern is copy-pasted five+ times.
- Mixed styling approaches (Tailwind vs inline `style` objects) within the same app.
- No test infrastructure at all.

### LOW
- Inconsistent code formatting (heavy manual line-breaking in some files, e.g. `OperationsCenter.jsx`).
- Emoji-based section headers in JSX (cosmetic, but inconsistent with a "premium" product direction).
- No accessibility attributes on form inputs (`Auth.jsx`).

---

## 12. Recommended Frontend Architecture

Proposed structure (not implemented in this task):

```
frontend/
  src/
    app/                      # App shell: router, providers, layout
      routes.tsx              # Central route table (react-router-dom)
      providers.tsx           # AuthProvider, OrganizationProvider, QueryClientProvider
    api/                      # One canonical API client
      client.ts               # fetch wrapper: attaches Supabase JWT + org header, handles 401/403
      contracts.ts            # typed calls: documents, versions, analysis runs
      clauses.ts
      evidence.ts
      search.ts
    domain/                   # Frontend-side types mirroring backend contracts
      contract.ts
      analysisRun.ts
      clause.ts
      evidence.ts
    features/                 # Feature-oriented modules (not "pages/" grab-bag)
      auth/
      organizations/
      contracts/
      documents/
      analysis-runs/
      clauses/
      evidence/
      search/
    ui/                       # Design-system primitives (Card, Panel, Table, Badge, LoadingState, ErrorState, EmptyState)
    lib/
      supabaseClient.ts        # single canonical client, env-var based
```

Key principles:
- **One** Supabase client, environment-variable based, session-aware.
- **One** API client that always attaches the live session token and an explicit organization context (mirroring the backend's `organization_id` scoping everywhere).
- Routing via `react-router-dom` with an auth guard and an organization-selection guard.
- Feature-oriented folders instead of a flat `pages/` dump, so each Contract Intelligence workflow stage (upload → document → version → analysis run → evidence → clauses → …) is its own cohesive module.
- A small design-system layer (`ui/`) extracted from the one genuinely reusable pattern found (the dark card style), formalized into tokens before the future spatial redesign begins.
- No fleet/maintenance/Copilot pages in the initial rebuild — those are explicitly deferred per Rule 1/Rule 4.

---

## 13. Target Product Information Architecture

Deliberately narrow, per instruction:

```
Contracts
  → Documents
    → Document Versions
      → Analysis Runs
        → Evidence (source-linked)
        → Clauses (hierarchical, evidence-linked)
        → Recommendations (once Phase 3C authorized)
Search (cross-contract)
```

No fleet operations, no maintenance calendar, no AI Copilot chat, no predictive/simulation surfaces belong in this initial information architecture.

---

## 14. Phase 3 Frontend Roadmap

- **Phase F1 — Foundation:** Fix `package.json`, remove duplicate entry points/orphaned directory, establish one canonical Supabase client + router + auth guard, remove hardcoded secrets/contract IDs.
- **Phase F2 — Backend Integration:** Build the canonical API client against the real Phase 3 route surface (auth, organization context, error handling); confirm actual HTTP contracts for document/analysis-run endpoints (not yet enumerated in this frontend-only audit — requires a backend route inventory pass).
- **Phase F3 — Contract Intelligence UX:** Upload → Document → Version → Analysis Run screens; run status/progress.
- **Phase F4 — Evidence & Search:** Clause list/detail with parent hierarchy, evidence excerpt viewer with exact offsets, honest source/page provenance display, search UI.
- **Phase F5 — Aviation Intelligence UX:** Aviation-specific taxonomy display (categories, obligation types, deadline types) once Phase 3C is authorized.
- **Phase F6 — Visual Redesign & Motion:** Introduce the spatial/premium/motion-rich design system, replacing the current inline-style/Tailwind patchwork.
- **Phase F7 — Predictive Risk UI:** Not before F1–F6 are complete and Contract Intelligence Core is functional end-to-end, per Rule 1.

---

## 15. Exact Recommended Next Implementation Task

**Phase F1, Task 1 — Frontend foundation repair (no new features):**
1. Fix `frontend/package.json` to declare the actual runtime dependencies (`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, and any chart/calendar libs actually kept) and correct its `"name"`.
2. Delete the orphaned `frontend/App.jsx` and the empty `frontend/operion/frontend/` directory (confirm with the user before deleting, since deletion is destructive).
3. Consolidate to a single Supabase client (`src/lib/supabaseClient.js`, environment-variable based) and delete `src/supabaseClient.js`.
4. Install `react-router-dom`, define a minimal route table wiring `Auth.jsx` as `/auth` and a placeholder authenticated home route, with an auth guard reading from `AuthContext`.
5. Remove the hardcoded contract UUID and all calls to legacy endpoints (`/api/contracts/:id/decision`, `/api/ai/copilot`, `/api/maintenance/schedule`, `/api/control-center`) from the initial route set — these pages should be parked, not deleted, pending the Rule 1/Rule 4 deferral decision.

This task is scoped narrowly enough to be implemented in a single follow-up session without repeating this audit, and it does not require any backend changes or Phase 3C authorization.

---

## Audit Metadata

**Files inspected:** `frontend/App.jsx`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/supabaseClient.js`, `frontend/src/lib/supabaseClient.js`, `frontend/src/lib/socket.js`, `frontend/src/utils/operionMapper.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/Auth.jsx`, `frontend/src/pages/ExecutiveDashboard.jsx`, `frontend/src/pages/Copilot.jsx`, `frontend/src/pages/ControlCenter.jsx`, `frontend/src/pages/OperationsCenter.jsx`, `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, plus directory listings of `frontend/`, `frontend/src/`, `frontend/operion/`, `frontend/operion/frontend/`, and repository-wide searches for "Horizon" and mock/placeholder data patterns under `frontend/`.

**Report created:** `docs/FRONTEND_PHASE3_FORENSIC_AUDIT.md` (this file) — the only file created or modified by this task.
