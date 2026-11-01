# OCI non-production environment — infrastructure assessment

**Assessment date:** 2026-11-01

**Scope:** Read-only inspection of the OCI Europe worktree at the expected branch and HEAD, including OCI frontend/backend code, Vercel and Render configuration, environment templates, auth/database implementation, migrations and deployment guidance. No provider console, deployed application, DNS, database or production service was accessed.

## Executive assessment

### Verdict

**READY WITH SPECIFIC INFRASTRUCTURE FIXES.**

The repository contains most of the application-side foundations needed for a founder-only OCI sandbox: a separately built OCI frontend, a protected OCI API route group, server-side identity/role/MFA enforcement, verified-TLS PostgreSQL transport, an OCI schema migration with RLS and audit triggers, and a guarded Super Admin bootstrap flow.

There is **no evidence in this worktree that a dedicated non-production OCI environment has been provisioned**. No staging Supabase project/database, dedicated OCI backend deployment, Vercel project identity, approved staging API origin, DNS ownership, founder role or MFA session was verified. The current Render blueprint declares one `operionos-backend` free-plan service with auto-deploy; it does not define an isolated OCI service. A separate static Vercel build is configured in source, but project existence and deployment isolation are not established.

Two conditions must be resolved before controlled provisioning:

1. Positively identify or approve a non-production hostname. The OCI frontend currently accepts `oci.operionos.com` or loopback only. A distinct sandbox hostname is rejected by the current client. Use the existing hostname only if the owner verifies that it is not serving a production OCI deployment and approves it for the isolated sandbox; otherwise a separately reviewed application change is required before using a staging hostname.
2. Create and independently verify **separate** Vercel, backend, Supabase Auth and PostgreSQL destinations, each with sandbox-only credentials. A different Vercel project or a separate PostgreSQL pool in code does not provide database, identity or API isolation by itself.

This assessment does not authorize or perform provisioning. No cloud resource, project, account, migration, DNS record or deployment was created or changed.

## Current architecture and implementation evidence

| Component | Implemented in repository | Environment state established? |
|---|---|---|
| OCI web client | Separate Vite entry at `frontend/oci.html`, configured to build to `frontend/dist-oci`; OCI client uses `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. It uses PKCE, tab-scoped `sessionStorage`, a separate auth storage key and bearer API requests. | No. OCI frontend values in the checked-in example are empty. No Vercel project or deployed build was verified. |
| OCI static deployment | `oci/vercel.json` uses the OCI build helper, `dist-oci`, OCI entry rewrite, no-index/no-store headers and a CSP. | Source config exists. No linked `.vercel` project or deployment identity was found. |
| OCI hostname | `frontend/src/oci/client.js` permits `oci.operionos.com` and loopback; other browser hostnames fail closed. | The deployment guide calls `oci.operionos.com` the intended host, not a confirmed staging host. DNS/deployment status was not checked. |
| OCI API boundary | `index.js` mounts `/api/oci` before generic public CORS and tenant middleware. The OCI boundary has a separate origin allowlist, rate limiter, 64 KB JSON limit, private/no-store response headers, access routes and account routes. | Code exists. `render.yaml` does not declare a separate sandbox backend service or `OCI_ALLOWED_ORIGINS`. |
| OCI business API | Authenticated `GET /records/:kind`, `POST /records/:kind`, `PATCH`, archive and audit/settings routes use schema validation and OCI repository functions. | No live API or account creation was tested. |
| Identity and MFA | Backend verifies provider identity, email confirmation, issuer/audience/expiry and requires `aal2`; it separately checks active OCI `super_admin` and platform `SUPERADMIN` roles. Frontend requires the protected access response. | Code policy exists. Provider project, user, roles, signup configuration and MFA enrollment were not verified. |
| Database access | OCI has a lazy PostgreSQL pool using `DATABASE_URL`; connection config forces `rejectUnauthorized: true`, removes connection-string SSL overrides, and supports a validated optional CA in `OCI_DATABASE_CA`. | No actual target database or TLS chain was inspected. The OCI pool is separate in code, but it uses the process `DATABASE_URL`; this alone does not isolate it from production. |
| OCI schema and persistence | Migration `022_oci_foundation.sql` creates OCI roles, settings, records and audit tables; it adds active identity uniqueness, mutation/audit triggers, RLS and grants. Its SQL depends on Supabase Auth (`auth.users`) and PostgreSQL/Supabase baseline roles, not on `platform_user_roles` or customer schema. The current OCI middleware/bootstrap separately depend on `platform_user_roles`. | No migration was run or inspected in a live project. See the [clean-project migration dependency audit](oci-clean-project-migration-dependency-audit.md). |
| Founder provisioning | `scripts/bootstrap-oci-superadmin.js` verifies the founder's short-lived provider token, matching email and MFA. Without `--apply` it verifies only; `--apply` writes platform/OCI role assignments and an audit row transactionally. | No founder account or authorization is provisioned. |
| Health | `/api/health` returns generic process health. The root endpoint returns `alive`; neither is an OCI dependency/readiness check. `/api/oci/access` tests protected dependencies but requires authenticated MFA and writes an access-audit event. | No live health check. No OCI-specific readiness endpoint is present. |

### Deployment configuration found

- [Render blueprint](../render.yaml) declares one web service named `operionos-backend`, `plan: free`, Node runtime, `npm install`, `node index.js`, `autoDeploy: true`, Node 24.21.0, and legacy email-related environment keys. It does not declare a dedicated OCI sandbox service, staging database, OCI CORS origin, health-check path or staging secret group. Do not repurpose this existing service or overwrite its settings as part of sandbox setup.
- [OCI Vercel config](../oci/vercel.json) provides an independent static build configuration. The [deployment guide](./oci-deployment.md) says an independent Vercel project must be created with `oci` as root and files outside the root enabled. No deployment project identity was present locally.
- [Backend OCI environment template](../.env.oci.example) lists `OCI_ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, optional `OCI_DATABASE_CA`, and temporary operator-only bootstrap variables. Values are blank.
- [Frontend OCI environment template](../frontend/.env.oci.example) lists the API base, Supabase URL and public anon key. Values are blank.
- The repository `.env` is tracked despite `.gitignore` containing an `.env` pattern. The variable names inspected there are legacy/client-prefixed `VITE_*` keys only; values were not opened or reproduced. A Vite-prefixed key is client-visible by design and must never be treated as a secret. Do not put staging service-role, database or bootstrap credentials into tracked files or frontend variables.
- There is no local `.vercel` project-link directory at the repository root or under `oci/`.

The existing Render free-plan declaration is repository configuration, not proof of the current hosted service plan or billing status. Likewise, Vercel and Supabase templates do not verify deployed provider projects.

## Isolation model and residual risks

| Isolation objective | Required control | Current assessment |
|---|---|---|
| Sandbox frontend cannot call production API | Build with a dedicated sandbox `VITE_API_BASE_URL`; set sandbox-only API origin in CSP `connect-src`; allow exactly the sandbox frontend origin in backend `OCI_ALLOWED_ORIGINS`; verify deployment variables from the provider console. | Not established. `oci/vercel.json` currently permits `connect-src https:` broadly. Frontend build-time configuration and deployment identity are unknown. |
| Sandbox backend cannot connect to production database | Dedicated backend service with a separately provisioned sandbox database URL and credentials; verify database project/host/name in the provider console; never copy production `DATABASE_URL`; test with isolated synthetic data. | Not established. OCI code consumes the process `DATABASE_URL`, and the repository blueprint defines no isolated service. |
| Sandbox authentication cannot use production identities | Separate Supabase project and Auth tenant; separate URL/anon key; exact sandbox redirect allowlist; invite founder only; verify JWT issuer corresponds to the sandbox Supabase URL. | Not established. Runtime provider configuration is absent. |
| Independent credentials and sessions | Generate unique DB/password/API secrets per sandbox service; keep backend-only values in hosting secret stores; distinct frontend origin and Supabase project; no shared production session cookies. | Architecture supports bearer PKCE and tab-scoped storage, but distinct environment values and origin are unverified. |
| No production data | Start with empty schema and synthetic fixtures only. Do not restore production backups, export records, or copy customer documents/contracts. | No environment data inspected; isolation is not demonstrated. |
| No privileged frontend secrets | Frontend may contain only public Supabase URL/anon key and public API origin. Never expose DB URL/password, service-role key, provider admin key or bootstrap token through `VITE_*` or built assets. | Templates state this boundary; no built staging artifact was inspected. |
| Sandbox account/audit writes stay isolated | API and `DATABASE_URL` must refer to the sandbox backend/database; confirm account creation, access auditing and mutation auditing only in sandbox. | Migration/code supports account and audit writes; no live destination exists to verify. |
| Parent and customer services remain untouched | Create a separate deployment and environment group; do not change `render.yaml` service or public Vercel configuration; never route customer hostnames to the sandbox. | Architecture guidance distinguishes OCI from public/customer sites; no live routing was inspected. |

### Specific code/configuration gates

1. **Hostname:** The client hard-codes the allowed host to `oci.operionos.com` (plus local loopback). A dedicated hostname such as an owner-approved sandbox subdomain is not supported by the current client without an application change. If an owner confirms `oci.operionos.com` is unused by production and designates it for the sandbox, keep that origin and verify DNS/domain assignment before deployment. Otherwise stop and raise a separately scoped code change; do not weaken host validation or route the sandbox through a production host.
2. **Content Security Policy:** `oci/vercel.json` currently uses a broad HTTPS `connect-src`. Before release, set the deployed sandbox policy to only the verified sandbox API and Supabase Auth origins. `https:` wildcard transport is not an environment-isolation boundary.
3. **Backend service:** Do not use the single existing Render `operionos-backend` service as the sandbox. Provision a distinct service with sandbox-only environment values and an explicitly controlled deploy branch/trigger. Keep production auto-deploy behavior untouched.
4. **Database:** A separate pool object is not a separate database. Use a new Supabase project and sandbox database URL; independently compare provider project references and database host/name to the production identifiers in the authorized consoles. No production connection string should be present in the sandbox service.
5. **Readiness:** The generic `/api/health` endpoint proves only that Express responds. It does not validate OCI database, auth or roles. `/api/oci/access` is protected and writes an access audit event, so do not use it as an unauthenticated or supposedly read-only health probe. Use explicit owner-authorized smoke tests after setup; do not call production.
6. **Access boundary:** CORS and hostname controls reduce accidental cross-environment requests but are not authentication. Continue to require server-verified identity, confirmed email, both role assignments and `aal2` MFA on each OCI request.

## Founder authentication requirements

The existing code supports a founder-only flow, subject to project setup and owner action:

1. Create a separate Supabase project for non-production. Do not invite the founder to production as part of this task.
2. Disable public signup or ensure it cannot grant OCI access. Invite only the approved founder identity; require verified email.
3. Configure exact HTTPS redirect URLs for the approved sandbox origin; configure provider rate limits and an approved email/SMTP path.
4. Enroll and verify a TOTP factor for the founder. Confirm that the resulting provider session has `aal2`.
5. Rehearse the OCI-only schema target in a disposable isolated database. Source review confirms `022_oci_foundation.sql` references `auth.users`, not `platform_user_roles`; however the current application authorization/bootstrap code still requires the platform table from migration 017, which itself alters customer membership schema from 001. Do not apply the full product chain to OCI as a shortcut. Review the [identity/schema remediation plan](oci-identity-schema-remediation-plan.md) before provisioning.
6. Use the documented bootstrap verification without `--apply` first. The founder must provide their own short-lived verified MFA session through the approved operator workflow. Apply the bootstrap only after explicit authorization and confirmation of the sandbox project; it creates both role assignments and an audit event.
7. Verify access denial for anonymous, ordinary authenticated, unconfirmed-email and non-MFA identities, and verify access for the founder only. Revoke/remove any accidental non-founder OCI role before acceptance.
8. Use the separate origin and the OCI app's session-scoped auth storage; do not reuse production credentials or copy a production browser session.

The bootstrap email/token are operator-only and temporary. Never include a token, provider admin key, service-role key or DB connection value in this plan or a frontend environment.

## Operations, audit and data controls

- The OCI boundary places its authentication/authorization before generic CORS/tenant handling. It checks confirmed identity and claims, `aal2`, both role tables, and records access outcomes; audit failure fails closed.
- The migration enables RLS on `oci_records`, `oci_settings`, `oci_user_roles` and `oci_audit_events`, revokes table access from `public`, `anon` and `authenticated`, and grants selected access to `service_role`. The API's direct PostgreSQL principal and effective privileges must be reviewed on the new project; do not assume RLS alone protects an owner/superuser connection.
- Record/settings mutations emit audit events; audit failure participates in the transaction. Role mutations also emit audit events. Retention and access to audit records must be restricted and reviewed.
- Use only synthetic or manually entered sandbox test data. Create a sandbox backup/restore procedure and test it before using the environment for sustained founder work. Do not restore production data.
- Restrict Vercel deployment access using the selected account's supported deployment-protection controls. `noindex`, CSP and private cache headers are not access control. Keep the API protected even when the static page is accessible.
- The in-process OCI rate limiter is per process; if the sandbox backend scales to multiple replicas, use approved shared/edge protection as described in the deployment guide.

## Health and acceptance evidence

Presently, `/api/health` returns a generic `healthy` response and the root route returns `alive`. Neither checks provider Auth, OCI role configuration, DB availability, schema/migrations or audit capability. There is no OCI-specific readiness check in the inspected code. After a dedicated sandbox exists, the founder/operator acceptance run must verify:

- the deployment/project IDs and environment labels in Vercel, Render and Supabase consoles;
- app, API and provider project references and the database host/name are sandbox-specific and distinct from production;
- the actual API URL, Supabase issuer and TLS certificate match the approved sandbox values;
- anonymous and non-founder requests fail; founder access requires verified email, both active role rows and `aal2`;
- OCI account creation, read, update, archive, duplicate conflict and audit behavior operate only in the sandbox;
- database tables, RLS, grants, audit triggers and role revocation behave as expected, using synthetic data;
- the static bundle contains no backend/database/provider-admin credentials and CSP/CORS are limited to the exact approved origins;
- no production customer records, files, contracts or account data are present.

Repository tests and builds are offline/mocked evidence only. The deployment guide reports prior offline tests and build checks; those do not prove the real provider, database, TLS, domain, user access, or current deployment. No tests requiring provider or database access were run for this assessment.

## Cost considerations (public pricing snapshot, 2026-11-01)

- The current [Supabase pricing page](https://supabase.com/pricing) lists Free at $0/month, limited to two active projects and pausing free projects after one week of inactivity. Pro starts at $25/month at the organization level; project compute and usage matter, and included credits affect the marginal cost. A continuously available isolated project may require a paid plan. Confirm the current calculator, region, compute, backup/log retention and overage costs in the owner account.
- The current [Vercel pricing page](https://vercel.com/pricing) lists Hobby at $0/month and Pro at $20/month; usage and plan terms apply. Verify that the selected plan supports the required private deployment protections and the organization's use before choosing it.
- The repository's [Render blueprint](../render.yaml) declares its existing service on `plan: free`; that is not a quote or evidence of a separate sandbox service's availability, suitability, or current billed cost. Select and verify a dedicated sandbox service plan in the Render account.
- No billing account, usage pattern, retention target, region, add-on or provider quote was inspected. A reliable total monthly estimate cannot be produced from repository files. Estimate one dedicated backend service plus one isolated Supabase project, the Vercel organization/project plan, domain/edge controls if required, backups/log retention and usage after selecting those options. No resources were created and no charge incurred by this assessment.

## Preservation

- Worktree: `OperionOS-oci-europe`; branch `dev/oci-europe-increment-a`; HEAD `8720815dcea6811326051166e41ba44d61395011`.
- Existing Increments A–E work, OCI portfolio deliverables, staging-readiness documents and all prior uncommitted changes were preserved.
- No code, configuration, DNS, auth, database, cloud resource, migration, deployment or Git history was changed.
- The companion [provisioning plan](./oci-non-production-provisioning-plan.md) is a blueprint only; it is not authorization to provision.
