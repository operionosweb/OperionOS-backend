# OCI implementation and operator release procedure

## Architecture and boundaries

OCI is a separate Vite application entry in the authoritative `OperionOS-backend`
repository. Its independent Vercel project must build the OCI entry, not the public
application. The public website continues to use its existing entry and deployment.
The intended OCI host is `oci.operionos.com`; the future customer host
`app.operionos.com` is not configured or redirected by this increment.

The existing Express deployment exposes `/api/oci` before its generic middleware.
This boundary has its own origin allowlist, request-size limit, rate protection,
authentication, authorization, MFA and private cache headers. Commercial records
are stored separately from customer documents and contracts. No customer-data
endpoints are called by the OCI frontend. Existing commercial-research tables and
legacy internal screens are not migrated, deleted or silently presented as OCI
records.

Supabase remains the identity provider. Every OCI request verifies the bearer
session with the provider, checks confirmed email ownership, verifies signed
session claims and requires MFA assurance `aal2`. The database must contain both
an active dedicated `oci_user_roles` assignment with role `super_admin` and the
existing active platform `SUPERADMIN` assignment for the provider user UUID.
Frontend metadata, email text, customer membership and editable role headers
cannot establish authorization.

OCI uses tab-scoped browser session storage, a separate authentication storage key,
and bearer requests instead of cross-subdomain cookies. Session tokens are never
included in URLs. No signup, role-grant API or autonomous outreach is exposed.

## Current release status

Implementation, offline checks and a build are not evidence that production data,
DNS or founder access works. Production setup requires an authenticated operator.
The initial inspection found neither `oci.operionos.com` nor `app.operionos.com`
resolving, and no authenticated management session was available to the agent.
The user selected an operator-run deployment/provisioning checklist.

Do not label OCI operational until all release checks below have passed.

## Implementation inventory

| Surface | Files |
| --- | --- |
| Identity, MFA and HTTP boundary | [access middleware](../middleware/ociAccessMiddleware.js), [access route](../routes/ociAccessRoutes.js), [backend mounting](../index.js) |
| Business API and persistence | [business routes](../routes/ociRoutes.js), [service validation](../services/ociService.js), [repository](../repositories/ociRepository.js), [verified-TLS transport](../repositories/ociDatabase.js), [shared contracts](../shared/ociContracts.js) |
| Database | [022 OCI foundation migration](../supabase/migrations/022_oci_foundation.sql) |
| Operator tooling | [verified identity bootstrap](../scripts/bootstrap-oci-superadmin.js), [offline runner](../scripts/run-oci-tests.js), [independent build helper](../scripts/build-oci.js) |
| Frontend | [entry](../frontend/oci.html), [mount](../frontend/src/oci/main.jsx), [workspace](../frontend/src/oci/App.jsx), [authentication](../frontend/src/oci/Auth.jsx), [client](../frontend/src/oci/client.js), [styles](../frontend/src/oci/oci.css) |
| Deployment | [OCI Vite configuration](../frontend/vite.oci.config.js), [Git deployment root](../oci/vercel.json), [explicit CLI alternative](../frontend/vercel.oci.json), [backend environment template](../.env.oci.example), [frontend environment template](../frontend/.env.oci.example) |
| Tests | [identity/bootstrap](../test/oci-access.test.js), [business workflows](../test/oci-workflows.test.js), [deployment isolation](../test/oci-deployment.test.js), [browser workflows](../frontend/tests/oci.test.mjs) |

Root/frontend package manifests add OCI commands only. Ignore rules exclude OCI
build output and local Vercel linkage. Existing public/Demo components, globe,
deployment configuration, customer tables and acceptance execution are unchanged.

Implemented workflows use the actual API client, server service and PostgreSQL
repository. Offline tests replace provider/database/browser API transports with
fixtures; they do not prove real persistence, authentication or production access.
The first-release pipeline is paginated and explicitly labels its current filtered
page. AI enrichment, scraping and outbound communications are not implemented.
Financial snapshots are grouped by currency, actual/forecast basis and period.
Recurring values from different periods are not added together. Optional metrics
show recorded values only, and unknown costs do not imply a 100% margin.

Contact retention must be reviewed by an authorized administrator. The confirmed
contact-erasure action replaces personal fields with a fixed non-personal marker,
archives the row and records a privacy-safe receipt. It also works on archived
contacts without enabling ordinary archived-record edits. Review identity/version
before confirming, then verify the contact and audit result. This does not erase
related free-text notes, exports, provider logs or backups; apply the approved
retention/legal procedure to those systems separately. Archive alone is not erasure.

## Local verification evidence

- OCI backend/security/workflow/deployment tests: 38 passed, offline.
- OCI Chromium browser tests: 14 passed, with intercepted identity/API transports.
- Existing customer identity/membership regression tests: 9 passed, offline.
- Required widths: 320, 360, 390, 430, 768, 1024, 1440 and 1920 pixels.
  Checks include overflow, full-width mobile primary/metric cards with 2px gutters,
  dialogs, keyboard focus, mobile targets and desktop/reduced-motion card behavior.
- Public production build and standalone OCI production build passed. The dedicated
  OCI deployment build also prepared its own output without replacing public output.
- Built-output Chromium checks at 390/1440 pixels passed with the deployment CSP
  (only local HTTP transport allowances changed), mocked authorization, and no
  browser/CSP errors or horizontal overflow.

These results are not physical iOS/Android testing, real PostgreSQL/RLS execution,
provider sign-in verification, founder provisioning or live OCI acceptance.

## 1. Prepare and validate the database

Run the offline backend checks with `npm.cmd run test:oci`. The dedicated runner
removes database/provider connectivity from its test subprocess. These mocks
exercise API workflows and authorization, not actual PostgreSQL persistence.
The available Docker CLI could not reach a running engine during implementation;
real migration/RLS verification remains an operator release gate.

1. Identify the actual Supabase project used by the backend. Verify its project
   identity using the provider console, not an unreviewed connection string.
2. Back up the database using the approved production procedure.
3. Rehearse the OCI migration on an isolated database with the existing prerequisite
   migrations already applied. Review foreign keys, triggers, audit atomicity,
   role assignments and service privileges.
4. Apply `supabase/migrations/022_oci_foundation.sql` through the approved migration
   process. Do not rerun all historical migrations against production blindly.
5. Verify OCI tables exist, RLS is enabled, and `anon` and `authenticated` database
   roles have no table access. Verify service/backend access separately.
6. Verify an unauthorized direct database client cannot read or modify OCI rows.

No production migration or data mutation is performed automatically by installing,
building or starting the application.

## 2. Configure Supabase authentication

1. Disable public user signup for OCI. Because the identity provider is shared,
   review customer signup requirements before changing project-wide settings.
   If customer signup must remain public, it still must not grant OCI assignments;
   use provider invitations for internal OCI identities.
2. Invite the intended founder account through the authenticated provider admin
   console. Do not create a hardcoded password or assume a profile proves ownership.
3. The owner must complete email verification, choose their own credentials and
   enroll/verify a TOTP second factor. Configure provider authentication rate limits
   and appropriate abuse protections in the console.
4. Allow only approved HTTPS OCI redirect URLs. Remove wildcard production
   redirect allowances. OCI password/TOTP flows do not require URL session tokens.
5. Verify the MFA factor is enrolled and the current session is `aal2`.

For the first administrator, complete provider-backed MFA enrollment/challenge
using an approved local Supabase SDK authentication workflow before bootstrap.
The OCI interface cannot enroll an identity that has not yet received its internal
role. Do not grant a temporary role or weaken the MFA check to work around this
ordering requirement.

MFA-required users receive a specific denial before commercial data is returned.
MFA verification in a client alone is insufficient; the backend checks each request.

## 3. Initial Super Admin provisioning

Use an operator-controlled terminal with the approved backend database
configuration. Configure `OCI_BOOTSTRAP_EMAIL` for the exact intended founder
email and `OCI_BOOTSTRAP_ACCESS_TOKEN` with that user's short-lived, verified
MFA session. Obtain the token through an approved local provider session, not chat,
source control, CLI argument history, a public URL or an arbitrary generated token.

```powershell
npm.cmd run oci:bootstrap
```

The default command verifies identity and MFA but changes nothing. Only after
reviewing the correct environment:

```powershell
npm.cmd run oci:bootstrap -- --apply
```

The apply operation serializes initial provisioning, links the provider UUID,
grants both dedicated and existing platform roles, and records an audit event
inside one database transaction. It refuses bootstrap once another administrator
has existed or the target OCI assignment has been revoked. Later administrator
grants/revocations require a reviewed database operation and audit record; no
self-service grant endpoint exists.

The bootstrap also refuses to restore removed or revoked platform access.
Repeating it for an already active assignment is a no-op. Record and settings
actor UUIDs remain stable after provider identity deletion; they are provenance,
not live identity grants.

Remove the bootstrap token from the operator environment immediately afterward.
Sign in as the owner and verify access using the real frontend and direct API.
Do not report the owner provisioned until these checks pass.

## 4. Configure backend hosting

Configure the existing backend's approved database and public Supabase authentication
values. Set `OCI_ALLOWED_ORIGINS` to `https://oci.operionos.com`; do not add wildcard
origins. See `.env.oci.example` for names only. Ensure HTTPS at the API endpoint.

OCI rate protection is bounded, per-process and IP-based. Configure provider
login limits and edge protection. Multi-replica hosting requires a shared limiter
or equivalent edge enforcement; do not treat the in-process limiter as a
distributed brute-force defense. Keep the existing trusted-proxy setting correct
for the actual hosting topology.

Requests fail closed when authorization or mandatory access audit storage is
unavailable. Such failures are availability failures, not successful authentication.

OCI has an isolated lazy PostgreSQL pool using the same approved database URL.
It always verifies the TLS certificate/hostname and removes URL options that could
override that requirement. Supply the approved provider CA through
`OCI_DATABASE_CA` only when system trust is insufficient; use PEM with actual
newlines. Test the certificate chain and connection on real infrastructure before
release. OCI authorization, records and bootstrap all use this verified transport.

The legacy/customer database client is intentionally unchanged and currently
disables certificate verification. Because its database credentials are shared,
this remains a wider infrastructure risk and a private-data production release
gate. The operator must validate and correct legacy database TLS in a separately
reviewed release without unexpectedly breaking the public/customer service.
The OCI-only transport does not prove the shared infrastructure secure. Account
for both pool connection budgets when sizing database/hosting replicas.

### Isolated password-recovery candidate (not deployed)

The recovery-only candidate is based on commit
`8f3599a5c035b11dee7e7c0b1242368469f09ced`, without the pending shared
PostgreSQL TLS changes. It adds a shared recovery interface to public login and
OCI without changing database connections, migrations, roles or dependencies.
OCI remains non-operational; recovery never provisions or grants administrator
access. No provider configuration or real account was changed.

The callback module initializes with the authentication client before React renders.
It captures explicit recovery callbacks in memory and immediately removes query/
fragment credentials from browser history. The recovery component verifies the
provider session and matching user ID, challenges an existing verified TOTP factor,
validates password confirmation and submits the update directly to Supabase Auth.
It explicitly handles expired/reused links, identity mismatch, MFA errors, password
policy rejection and signout failure. Completion requires local session cleanup,
then fresh login. It does not promise global session revocation.

Only a non-sensitive pending marker is stored in sessionStorage. Interrupted
recovery/reload requires a fresh link and cleanup rather than silently entering
the customer workspace with a recovery session. Callback credentials are cleared
from the in-memory capture after verification. Public authorization and organization
requests are suppressed during recovery; ordinary login/session behavior is retained.

Public hash navigation uses element IDs rather than arbitrary CSS selectors.
Consented analytics retains ordinary page tracking but sanitizes callback parameters
and excludes hashes/referrers from its page metadata. Analytics does not initialize
while sensitive non-recovery callback parameters remain in the URL. These protections
do not depend on the lazy recovery component loading. The public HTML now declares
`no-referrer` before assets/scripts (OCI already does), because cleanup after
JavaScript loading cannot protect initial subresource referrers. This deliberately
removes browser referrers site-wide; ordinary non-sensitive analytics query tracking
remains enabled. Initial incoming callback URLs still necessarily reach the serving
HTTP endpoint; this client change cannot control provider/mail/server access logs.

Provider acceptance gates, requiring separate owner approval:

1. Verify SMTP/email delivery and exact approved public
   `https://www.operionos.com/login?recovery=1` and OCI
   `https://oci.operionos.com/?recovery=1` redirects. Verify apex entry behavior
   separately; do not change redirect allowlists during candidate preparation.
2. Rehearse the provider's actual implicit, PKCE or token-hash recovery template.
   OCI PKCE requires the originating browser/tab verifier. For cross-device
   recovery, the officially supported token-hash method must be configured and
   tested by the owner. An example for these redirects (which already contain
   `?recovery=1`) is:

   ```html
   <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
   ```

   This example is not evidence of the currently configured template. Review its
   effect on all shared customer flows before any provider change.
3. Test real controlled accounts: eligible/nonexistent email handling, expiry,
   one-use links, existing-session/account switching, enrolled TOTP, provider
   password policy, password update and local session cleanup. Lost MFA uses the
   provider's audited recovery procedure, never this UI as a bypass.
4. Inspect actual production analytics/referrer behavior, serving deployment
   identity, preview isolation and frontend rollback permissions before release.
   A Git push can rebuild the backend even if its source is unchanged.

Candidate tests intercept all provider/API/analytics transports; no real emails or
password updates occur. Browser emulation is not physical iOS/Android verification.
Production readiness remains blocked on real provider acceptance and owner approval.
Do not deploy OCI or change its database/DNS/provisioning gates as part of recovery.

Local candidate validation: 26 browser tests passed against offline production
artifacts, with an additional real development React StrictMode case in that suite;
nine unchanged customer authorization tests and 38 unchanged offline OCI backend
tests passed. Standard public and OCI production builds passed. The public build
retains its existing large-chunk warning. Responsive public recovery and OCI
layouts passed at 320, 360, 390, 430, 768, 1024, 1440 and 1920px.
Production callback tests cover cold lazy loading, pre-granted analytics consent,
implicit fragments, PKCE, token-hash links, sensitive event/referrer rejection,
ordinary analytics/anchors, existing sessions, invalid credentials, expired
sessions, identity mismatch, interrupted recovery, retries, MFA and password
policy failures. All service transports were mocked; no physical-device or real
provider acceptance testing is claimed.

The Vite development server injects its tooling client ahead of document metadata;
synthetic testing exposed a query-bearing referrer on that local development-only
request. Referrer acceptance was therefore tested on the actual production HTML
and bundles, without excluding tooling requests from a production assertion.
Do not open real emailed callback credentials on a Vite development server;
use an owner-approved, production-built test target for provider acceptance.
The development StrictMode test uses synthetic credentials only.

Release isolation checks confirm that the TLS commit is not an ancestor and that
shared TLS files/scripts are absent. Backend sources, migrations, root/frontend
manifests and lockfiles, and deployment configuration match the baseline under Git
normalization (Windows checkout line endings do not indicate a source change).
The candidate is maintained on local branch `release/password-recovery-isolated`.
Its recovery changes are **PREPARED — READY FOR OWNER REVIEW**, not approved for
publication, deployment or OCI activation.

## 5. Create the independent Vercel project and DNS

1. Create an independent OCI Vercel project connected to this repository's `main`.
   Use `oci` as the project root and enable source files outside the root directory.
   Keep the existing public project untouched.
2. This project uses `oci/vercel.json`. Its build helper reuses the existing frontend
   dependencies and `build:oci`, then copies only OCI output into `oci/dist-oci`.
   Rewrites target `oci.html`. This prevents Git deployments accidentally using the
   public frontend's `vercel.json`.
   The alternate `frontend/vercel.oci.json` is suitable only for an explicitly
   configured CLI deployment (`vercel --local-config vercel.oci.json`) from the
   frontend directory with the **OCI** project linked. Verify the selected project
   before deployment. Do not replace public `vercel.json`.
3. Configure only `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and the public
   `VITE_SUPABASE_ANON_KEY`. Never provide database/service-role/bootstrap secrets
   to a frontend build.
4. Add `oci.operionos.com` to the OCI project, not the public/customer project.
   Create the exact DNS record instructed by Vercel. Verify ownership and HTTPS.
5. Verify OCI response headers prohibit indexing, caching and embedding.
6. Ensure the application stays on OCI routes after login, logout, reload and
   direct deep links. Do not point `app.operionos.com` at OCI.
7. Tighten the production CSP `connect-src` to the exact approved API and Supabase
   origins. The portable template allows HTTPS connections because operator-owned
   backend/provider hostnames are not fixed by this increment.

Retain and review the provider's authentication audit events for sign-in failures,
MFA events and logout. OCI access/role/mutation audit records supplement these
provider logs; they do not replace them.

## 6. Acceptance verification on real infrastructure

- DNS resolves to the intended OCI deployment and TLS is valid.
- Anonymous API reads/writes are rejected; ordinary authenticated customer users
  and forged frontend roles cannot access data.
- A legitimate internal role without MFA is denied; MFA succeeds only for a
  database-authorized identity.
- The intended founder has verified access; logout/session expiry denies access.
- Accounts and contacts create, edit, search, filter and archive correctly.
- Opportunities link to their accounts, progress through configured stages,
  enforce version conflicts, and show the activity history.
- Discovery, pilot/proposal and revenue records persist after reload and from
  another authorized session.
- Currency-grouped financial results distinguish actuals, forecasts and
  assumptions. Do not mix currencies or imply forecasts are earned revenue.
- Audit writes accompany important changes and an audit failure cannot create an
  unaudited commercial mutation.
- Archive/reference protections and database RLS have been tested directly.
- Required widths pass on mobile and desktop, including keyboard access,
  loading/empty/error states and reduced-motion behavior.
- Public website, Demo and customer-contract routes remain unchanged.
- Physical iOS Safari and Android Chrome checks are performed by an operator.

Record the exact commit, deployment, verified identity result (without credentials),
database migration result and evidence for these checks before declaring production
acceptance. AI research/enrichment and automated outreach are not part of this
foundation release; no external email or purchasing action is performed.
