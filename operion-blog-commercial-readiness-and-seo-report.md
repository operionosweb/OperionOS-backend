# Operion Blog Commercial Readiness and SEO Report

**Assessment date:** 9 November 2026
**Scope:** Existing Phase 48 Blog/CMS, public rendering, authorization, SEO/sitemap, launch blockers, and initial editorial package.
**Decision:** **Not approved for public launch verification or production CMS use.** Focused mocked tests and five isolated SSR browser tests pass, but database/RLS, live identity, deployment configuration and authenticated publishing remain unverified. Five unpublished Markdown drafts are supplied instead of writing to a CMS or database.

## Executive summary

The current repository already contains a purpose-built Blog/CMS slice: protected administration, draft/published/archived states, public published-only APIs, server-rendered pages, article metadata and structured data, generated sitemap, image handling, and responsive styles. The Phase 48 report correctly withheld production approval pending deployment and database verification. No CMS rebuild or schema change was warranted for this workstream.

The browser follow-up exposed an important API/SSR contract gap during source tracing: `PUBLIC_POST_FIELDS` omitted `status`, but the SSR privacy guard requires explicit `status === "published"`. Real SQL responses therefore lacked the state that mocked SSR fixtures had supplied, causing the index to omit articles and article SSR to return 404. The public projection now includes the non-sensitive status field; the admin projection avoids duplicating it. Published-only query filters and strict SSR privacy guards are unchanged. A projection regression test was added. This is the only application-source change owned by this workstream.

The main code-level testing gap in the current Blog test file was a single test covering the administrative state lifecycle end to end at the mocked controller boundary. A regression test now covers create → private draft → edit → publish → public visibility → unpublish → archive → restore, including audit-action calls and draft privacy. It is not a database or authenticated browser test.

The CMS is not a safe place to create the requested drafts yet: migration 026 is unapplied, its RLS behavior and backend database role are unverified, and no authorized disposable database or production-like identity/browser stack is available. The acceptance gate remains closed. The five complete editorial drafts are therefore stored as Markdown, remain unpublished, and have explicit review requirements.

## Phase 48 report and current-source audit

The Phase 48 report (`operion-phase48-blog-cms-security-seo-launch-verification-report.md`) recorded:

- Public Blog: not launch-verified; migration/deployment variables, live HTTP behavior and browser/accessibility verification were outstanding.
- CMS: server-side Super Admin authorization was source-reviewed and unit-tested, but actual role and database/RLS behavior were not verified.
- Migration 026: not applied; it enables RLS without creating policies, so the backend database role must have compatible owner or RLS-bypass privileges.
- Its focused Blog/SEO/deployment suite passed 17 tests at that time; the Playwright suite was blocked because Chromium was unavailable.
- No production change, database operation, migration or deployment was performed.

The current Blog code was audited directly; the repository was already broadly dirty at task start. This report does not treat the unrelated dirty product work as part of this Blog implementation.

### CMS and admin workflow

| Capability | Source-level result |
|---|---|
| Admin entry | `/app/admin/blog` is guarded by `platform:admin`; the navigation item is shown to users with that permission. The API admin router also applies `authenticateUser` and `requireSuperAdmin` before every admin operation. The API boundary—not the UI guard—is the authorization control. |
| Create/save draft | The controller inserts new records with `status='draft'`; the CMS editor saves through the protected create/update endpoints. |
| Edit | Existing non-archived posts can be edited. Slug changes maintain redirect records and avoid redirect cycles. |
| Preview | Preview is an in-memory CMS view, labelled private; it is not a public preview URL. A new article must first be saved to obtain a selected record before the Preview control appears. |
| Publish | The protected publish endpoint checks required editorial fields and content, then records the publish action. Public responses require published status. |
| Update published content | The editor saves changes to the existing post; publication status is retained. A human should review changes after saving. |
| Unpublish/archive/restore | Unpublish moves a published post back to draft. Archive is recoverable; restore returns it to draft. No hard-delete endpoint exists, which is a safer retention behavior but means permanent deletion is not supported. |
| Featured image | Admins can upload PNG/JPEG/WebP up to 3 MB, provide required alt text, and receive optimized WebP; decoding/resizing is bounded. CMS preview uses a protected media endpoint. Public media is returned only when referenced by a published, non-archived post. |
| Categories | Category values are restricted to a fixed aviation category list. The CMS does not manage category records or create new categories. Public API and listing support category filtering. |
| Metadata and body | The editor includes title, summary, category, author attribution, SEO/social title and description, canonical, indexability, content blocks, links, tables, image alt text and captions. Structured link blocks accept safe absolute HTTP(S)/mailto URLs; use the approved Operion origin for internal links. |
| Article history | Admin actions write an audit record and the protected API exposes bounded history. |

### Public rendering, privacy and SEO

- Public listing, article and image queries filter by publication state; draft/archived articles are not exposed by the public API. The Vercel SSR listing independently drops draft/archived records, and article SSR returns 404 unless the record is explicitly published and not archived.
- Public article and index responses are server-rendered HTML so the main text and head metadata do not depend on client JavaScript. Article status, slug and redirect handling are explicit. If the required backend URL is unset or unavailable, SSR fails closed with a service-unavailable response rather than rendering private data.
- Article SSR emits a title, description, robots directive, canonical URL, Open Graph title/description/type/URL, Twitter card/title/description, optional image and article dates/author metadata. JSON-LD includes `Article`/`BlogPosting` and `BreadcrumbList`. The index has its own canonical, `website` Open Graph type, `Blog` and breadcrumb data.
- Canonicals are constrained to the article’s own Operion slug; changing a slug preserves a redirect. `is_indexable=false` produces `noindex` and excludes the article from the sitemap. Drafts and archived articles are neither public nor sitemap entries.
- `/sitemap.xml` is a Vercel rewrite to the generated sitemap handler, which proxies the backend’s XML sitemap. The backend includes the static public path set and indexable, published, non-archived articles with last-modified dates. A static `frontend/public/sitemap.xml` is absent in the current worktree; the dynamic route is the configured implementation.
- `frontend/public/robots.txt` allows general public crawl access, specifically allows `OAI-SearchBot` and `PerplexityBot` for Blog, disallows `GPTBot` site-wide, disallows app/login paths and names the sitemap. Robots directives are crawl guidance, never access control; crawler fetches, indexing and ranking were not verified.
- `blog.css` includes mobile breakpoints and horizontally scrollable tables. Isolated Chromium tests now pass for SSR index-to-article navigation and article metadata, structured data, featured-image loading, internal links and no horizontal overflow at 1440, 768, 390 and 320 px. A fifth test verifies article text and links without JavaScript. These use synthetic records and in-memory route fulfillment, not a live API, CMS or database. Keyboard, screen-reader, contrast and authenticated editor behavior remain unverified.
- No RSS/Atom endpoint or feed link was found.
- Unique metadata can be authored and has defaults, but cross-article SEO-title uniqueness is not automatically enforced. Human editorial review is required. Length warnings are guidance, not a ranking guarantee.
- The public listing and article CTAs link to Operion/demo routes. The Blog does not add pop-ups or generic lead forms. Contextual links in the drafts point to existing product, intelligence, demo and related-article routes.
- A public HTML fetch of `/product` and `/intelligence` returned the SPA shell with the homepage title and canonical (`https://operionos.com/`) in the initial document. Client-side route metadata exists in the application, but browser execution could not be verified here. This is a deployment/rendering follow-up for those non-Blog routes; it is not changed in this Blog-only scope.

### Authorization, database/RLS and privacy evidence

The production router’s admin subrouter is wrapped by the real authentication and Super Admin permission middleware. Unit tests exercise a mocked Super Admin grant and ordinary-role denial, and the router test confirms all admin paths are mounted beneath the middleware. SSR and mocked controller tests confirm public draft exclusion and private image behavior.

These are source and mock-level results only. The current schema file, `supabase/migrations/026_superadmin_blog_cms.sql`, enables RLS on blog tables but defines no policies. Do not apply it until an approved non-production owner verifies schema shape, the application DB role, RLS behavior and role-based API access. No target database or production DB was accessed; no migration was run. The acceptance runner’s `ACCEPTANCE_EXECUTION_DISABLED` safety gate was not bypassed.

## Test and browser results

| Command/check | Result |
|---|---|
| `node --test test/blog-cms.test.js test/saas-routing-seo.test.js` | **Passed: 17 tests, 0 failures.** Covers content validation, rendered metadata/schema, responsive source rules, published-only reads and required status projection, slug redirects, upload validation, admin middleware/role behavior, sitemap/robots rules, SSR privacy, and the added CMS draft/edit/publish/unpublish/archive/restore lifecycle test. Controller lifecycle uses a fake query function; no database was contacted. |
| `frontend` → `npm run test:corporate`, then diagnostic `node --test tests/corporate-design.test.mjs` | **Blocked: 27 tests, 0 passed, 27 failed before page rendering.** Initially Chromium was missing. With the restored browser environment below, Chromium launched successfully, but every test failed at navigation with `net::ERR_NETWORK_ACCESS_DENIED` for `http://127.0.0.1:5173/`. These are corporate tests, not 27 Blog workflow tests. The suite and its network restrictions were not changed. |
| `frontend` → `node --test tests/blog-browser.test.mjs` with restored Chromium | **Passed: 5 tests, 0 failures.** Real Chromium renders the actual Blog SSR functions and production Blog CSS through synthetic in-memory routes, aborting external requests. Four viewport tests cover index/article navigation, headings, title/description/canonical, Open Graph/Twitter, JSON-LD, featured-image load, contextual product/demo links and no horizontal overflow; one mobile test verifies text/links with JavaScript disabled. No socket server, production API, database or real authenticated session is used. |
| SEO/browser acceptance runner | Not run. The existing safety gate refuses execution pending environment identity, ownership, containment and approval; it was not changed or bypassed. |
| Database/RLS/migration tests against a disposable DB | Not run. No authorized database was configured; migration 026 remains unapplied. |
| Public crawler, production sitemap/API headers, indexing, Lighthouse/Core Web Vitals | Not run. No ranking or indexing improvement is claimed. |

The five drafts are unpublished Markdown. No CMS write, production DB access, migration, commit, push or deployment occurred.

Browser commands used `PLAYWRIGHT_BROWSERS_PATH=C:\Users\meeli\.copilot\session-state\8d12d2a3-52a5-4c6d-b444-9673802f81b9\files\playwright-browsers`, the restored browser provided by the coordinating workstream. No browser dependency or acceptance safety gate was changed. The new Blog browser suite does not recheck product/Demo behavior.

## Editorial strategy and qualitative keyword/topic backlog

No keyword-volume, difficulty, ranking or paid SEO data was available or measured. Terms below are **qualitative hypotheses**, based on aviation-specific intent and the questions the material answers. They are not search-volume forecasts. Prioritize a narrow, useful page for one reader task; avoid repeating exact phrases unnaturally.

| Priority / pillar | Topic and qualitative query hypotheses | Audience and intent | Conversion path |
|---|---|---|---|
| 1 — Aviation Contract Intelligence | What aviation contract intelligence is; aviation contract analysis; airline contract obligations | Executive, legal, contract and risk teams; informational / vendor evaluation | Link to `/product`, `/intelligence`, `/request-demo` |
| 2 — Aircraft Leasing & Financing / Aviation Contract Risk | Aircraft lease agreement risks; lease return conditions; maintenance reserve clauses | Airline fleet, lessor, finance, legal and technical teams; practical checklist | Link to intelligence and a reviewed lease demonstration |
| 3 — Aviation Contract Risk | Aviation fuel price adjustment clause; airline fuel pass-through; jet-fuel benchmark in a contract | Airline fuel procurement, finance and commercial/legal teams; understand clause mechanics | Link to Phase 72-supported intelligence and demo, with scope limits |
| 4 — Aircraft Leasing & Financing | Aircraft lease SOFR clause; aircraft financing spread/reset; fixed vs floating lease finance | Aviation CFO, treasury, lessor and finance/legal teams; understand benchmark mechanics | Link to Phase 73-supported intelligence and demo, with scope limits |
| 5 — Aviation Contract Intelligence | Contract management vs contract intelligence; contract intelligence vs CLM | Procurement, legal and technology evaluators; comparison / buying research | Link to product and request-demo without claiming CLM replacement |
| Future — Predictive Aviation Intelligence | Evidence and governance for aviation contract obligations; measuring contract-risk alerts | Contract/risk executives and consultants; educational / operational | Only publish when the underlying capability and evidence are approved for public claims |
| Future — Indexation Intelligence | Aircraft lease CPI escalation clause; HICP-linked lease payment; indexation threshold, cap and floor | Aviation finance, legal and contract teams; understand indexation mechanics | **Do not market as generally available.** Current local Phase 74 work describes a CPI/HICP registry and clause calculation for ratio/share, threshold, cap and floor with platform-Super-Admin-reviewed ingest; there is no live data integration and migration 029 is prepared but unapplied. Publish only after release, data provenance, jurisdiction and production availability are independently verified. |

**Editorial sequencing:** publish the definition article first; follow with the leasing checklist; then publish fuel and financing explainers after finance/product review; finish with the management-vs-intelligence comparison. Cross-link them only after their canonical public pages exist. Review topics periodically against Search Console and a licensed keyword tool after launch; record measured data separately from hypotheses.

## Draft package and publication recommendations

| Draft | Audience / intent | Recommendation |
|---|---|---|
| [`docs/blog/drafts/01-what-is-aviation-contract-intelligence.md`](docs/blog/drafts/01-what-is-aviation-contract-intelligence.md) | Airline and lessor leaders, legal, contract and risk professionals; informational / product evaluation | **Publish first after product/legal review.** Confirm current public product wording and keep the Phase 72/73 boundary explicit. |
| [`docs/blog/drafts/02-hidden-risks-in-aircraft-leasing-agreements.md`](docs/blog/drafts/02-hidden-risks-in-aircraft-leasing-agreements.md) | Airline/lessor legal, finance, technical and redelivery teams; practical checklist | **Publish after aviation counsel and technical review.** U.S. Truth-in-Leasing material is scoped; confirm every regulatory statement for jurisdiction and aircraft applicability. |
| [`docs/blog/drafts/03-how-fuel-price-volatility-affects-aviation-contracts.md`](docs/blog/drafts/03-how-fuel-price-volatility-affects-aviation-contracts.md) | Airline CFO/fuel procurement and commercial/legal teams; understand adjustment mechanics | **Publish after fuel/finance and legal review.** Keep the sample synthetic; verify the EIA series and Phase 72 implementation remain current; do not imply a total fuel-cost, invoice or hedge result. |
| [`docs/blog/drafts/04-how-interest-rate-changes-affect-aircraft-leasing-agreements.md`](docs/blog/drafts/04-how-interest-rate-changes-affect-aircraft-leasing-agreements.md) | Aviation finance, treasury, accounting, legal and lessor teams; understand rate mechanics | **Publish after treasury/accounting and legal review.** Keep the USD/SOFR and simple annualized run-rate boundary visible; never describe the synthetic example as a current observation, scheduled payment or forecast. |
| [`docs/blog/drafts/05-contract-management-vs-contract-intelligence.md`](docs/blog/drafts/05-contract-management-vs-contract-intelligence.md) | Procurement, legal, executives and software evaluators; informational comparison | **Publish after product review.** Preserve the distinction between lifecycle practice and a variable vendor label; do not imply Operion replaces CLM. |

### Human publication checklist

1. Assign an accountable aviation subject-matter editor, legal reviewer and product owner for each article; accept or reject every change.
2. Verify every external reference still resolves and supports the associated statement. Recheck FAA applicability, current IFRS wording and benchmark/data source descriptions.
3. Confirm Operion product claims against the currently released product. For fuel, retain the Phase 72 indicator, inputs and non-forecast limitation. For financing, retain Phase 73’s fixed-rate / USD-SOFR scope and simple annualized-balance limitation.
4. Validate every figure and unit independently. Keep the two examples labelled synthetic; remove them if the product owner cannot approve their reproduction.
5. Review title, meta description, proposed canonical, social metadata, category, slug and uniqueness against all existing articles; avoid keyword stuffing. Confirm the final slug before cross-linking.
6. Convert the approved Markdown to CMS semantic blocks; keep the draft as a draft; include the intended related-article links only after those target URLs are published.
7. Select an approved/licensed cover image, provide meaningful alt text and caption, and verify mobile crop/readability. Do not use an unlicensed aircraft or customer image.
8. Use the private CMS preview; obtain legal/finance/product sign-off; check link destinations, heading order, tables, accessibility and desktop/tablet/mobile layouts in a real browser.
9. In an approved non-production environment, confirm the editor’s actual role, save/edit/preview/publish/unpublish/archive/restore, draft privacy, media privacy, audit history, SEO head output and sitemap behavior before any production workflow is approved.
10. Only an authorized human publisher may publish. After publication, inspect the public canonical, metadata, structured data, media, status and sitemap entry; monitor crawl/index status without promising rankings.

## Source evidence checked for these drafts

The following public references were checked using public web tools on the assessment date. They support background statements; they do not prove that a particular contract contains a term or that Operion has been deployed/configured for a customer:

- U.S. Energy Information Administration, [Petroleum & Other Liquids Spot Prices](https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm) — the U.S. Gulf Coast kerosene-type jet-fuel series; no current value is quoted in the drafts.
- IATA, [Jet Fuel Price Monitor](https://www.iata.org/en/publications/economics/fuel-monitor/) — describes its source and expressly says the data is for general information, not commercial or contractual decisions.
- Federal Reserve Bank of New York, [SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr) — defines SOFR as a broad overnight measure for borrowing cash collateralized by Treasury securities.
- FAA, [AC 91-37B: Truth in Leasing](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/1028946) — active FAA guidance on operational-control considerations and specified U.S.-registered aircraft.
- Legal Information Institute, [14 CFR § 91.23](https://www.law.cornell.edu/cfr/text/14/91.23) — public text of the U.S. regulation, with scope and exceptions; this is not universal aviation law.
- IFRS Foundation, [IFRS 16 Leases](https://www.ifrs.org/content/dam/ifrs/publications/html-standards/english/2026/issued/ifrs16.html) — official standard text, including lease-payment provisions tied to an index or rate; seek accounting advice for application.
- World Commerce & Contracting, [Contract Management Standard](https://www.worldcc.com/knowledge-insights/contract-management-standard.html) — a voluntary lifecycle framework describing pre-award, award and post-award phases.
- National Law Review, [Maximizing Returns Through Effective Management of Engine Performance Restoration](https://natlawreview.com/article/maximizing-returns-through-effective-management-engine-performance-restoration-five) — legal commentary on example maintenance-reserve and return-compensation arrangements, not a universal lease requirement.
- Operion public pages, [`/product`](https://www.operionos.com/product) and [`/intelligence`](https://www.operionos.com/intelligence) — fetched as public HTML to check the destination routes; the raw HTML head exposed the generic root canonical before client-side rendering. No production database was accessed.
- Phase 74 indexation information in the current coordinated task scope is treated as **future editorial input only**. No indexation article or public capability claim was added to the five initial drafts because ingestion has no live integration and migration 029 remains unapplied.

## Launch blockers and decision

**Public Blog:** Source-level behavior, mocked SSR/SEO and isolated responsive SSR browser tests pass, but there is no verified live deployment, production configuration, public crawler result, live HTTP-backed browser workflow, accessibility audit or performance measurement. Do not claim indexing, ranking or conversion improvements.

**CMS:** The editorial workflow is implemented at source level, and the focused lifecycle regression test passes. Production administrator use remains **blocked** until migration 026 and backend DB role/RLS behavior are verified on an explicitly approved disposable database, real Super Admin authentication is exercised, and browser acceptance is completed through the approved gate.

**Before production approval:** obtain the authorized non-production database and identity environment; review/apply the migration there only after confirming schema and RLS roles; configure the documented backend/frontend URL variables; run real anonymous/ordinary-user/Super-Admin and published/draft/archived/media matrices; install/use an approved browser runner and execute end-to-end publishing/accessibility/responsive checks; verify deployed sitemap/robots/headers and monitoring. No production database, migration, CMS write, deployment or approval was used in this work.

## Exact files owned by this workstream

- `controllers/blogController.js` — include published status in public projection, preserving existing local controller work.
- `test/blog-cms.test.js` — mocked lifecycle/privacy and public-status projection regression coverage, preserving earlier tests.
- `frontend/tests/blog-browser.test.mjs` — isolated SSR responsive/SEO/image/link/no-JavaScript Chromium tests.
- `operion-blog-commercial-readiness-and-seo-report.md` — this audit, results, limitations, topic backlog and publication checklist.
- `docs/blog/drafts/01-what-is-aviation-contract-intelligence.md`
- `docs/blog/drafts/02-hidden-risks-in-aircraft-leasing-agreements.md`
- `docs/blog/drafts/03-how-fuel-price-volatility-affects-aviation-contracts.md`
- `docs/blog/drafts/04-how-interest-rate-changes-affect-aircraft-leasing-agreements.md`
- `docs/blog/drafts/05-contract-management-vs-contract-intelligence.md`

Other dirty files are pre-existing or coordinating-workstream changes. No commit, push or upstream write was performed by this workstream.
