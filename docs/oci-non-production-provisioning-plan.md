# OCI non-production environment — provisioning blueprint

**Prepared:** 2026-11-01

**Status:** Blueprint only; no provisioning authorization or execution

**Related assessment:** [OCI non-production environment assessment](./oci-non-production-environment-assessment.md)

## Purpose and target

Establish a founder-only OCI environment where accounts and commercial workflows can be exercised with synthetic/non-production data, without access to production customer data or production credentials.

```text
Founder browser
    |
    | HTTPS — approved private OCI origin
    v
Dedicated Vercel OCI static deployment
    |-- only sandbox VITE_API_BASE_URL
    |-- only sandbox Supabase URL + public anon key
    |
    +-- HTTPS bearer API --> Dedicated non-production backend service
                                |-- sandbox-only CORS origin
                                |-- sandbox Supabase Auth verification
                                +-- verified TLS --> dedicated sandbox PostgreSQL
                                                   |-- OCI schema + RLS/grants
                                                   |-- synthetic data only
```

Public marketing (`www.operionos.com`) and future customer SaaS (`app.operionos.com`) remain separate. The sandbox must not share a production Vercel project/environment group, Render service, Supabase Auth project, database URL, service credentials, or founder browser session.

## Provisioning gates — do not skip

Before creating resources, the founder/operator must approve:

1. **Hostname and ownership.** Confirm the exact approved non-production origin and whether `oci.operionos.com` is unused by production. The current client hard-codes that hostname (plus loopback). A separate sandbox hostname is not accepted without an application change. If a distinct sandbox domain is required, stop and obtain separate approval for that code change; do not bypass the guard.
2. **Provider accounts, region, plan and spend ceiling.** Name the owning Vercel, Render and Supabase organizations; select a region appropriate to the data policy; approve monthly spend/overage alerts.
3. **Isolation evidence.** Record production and sandbox project/service identifiers separately in the owner's secured operations inventory. Do not copy production credentials or data.
4. **Migration scope.** Review the OCI-only schema dependency and deployment target. Migration 022 is standalone at SQL level with respect to the product schema, but current OCI middleware/bootstrap code depends on `platform_user_roles` from migration 017. Do not apply the whole customer/product chain to solve that runtime dependency. See the [clean-project dependency audit](oci-clean-project-migration-dependency-audit.md) and [identity/schema remediation plan](oci-identity-schema-remediation-plan.md).
5. **Founder identity.** Confirm the exact founder identity, invitation method and MFA procedure. Role provisioning requires a short-lived verified MFA session and explicit approval for the mutating `--apply` step.

Do not proceed if an environment identifier, database host, Supabase project reference, deployment origin, or permission to incur charges is ambiguous.

## Ordered provisioning sequence

Planning estimates below are hands-on effort only, assume ordinary provider setup access and do not include provider review/verification delays. Migration rehearsal, domain ownership, billing approval or cleanup of pre-existing migrations may take longer. These estimates are not vendor commitments.

### 0. Environment ownership and separation record — 0.5–1.5 hours

- Name one owner for each provider account and keep project/service identifiers in an approved secret-management inventory.
- Record production identifiers for comparison only in the authorized provider consoles; do not copy credentials. Record the new sandbox identifiers after creation.
- Select the approved origin. If `oci.operionos.com` is already serving production, do not repoint it. A different origin requires an approved solution for the current client hostname restriction before deployment.
- Agree an explicit spend limit, project region, retention/backup target and environment shutdown/cleanup owner.
- Keep provisioning work isolated to the sandbox. Do not change the existing production Render or public Vercel services.

### 1. Supabase project, schema and identity — 2–5+ hours

**Project and isolation**

1. Create a dedicated Supabase project in the approved region using owner credentials. Choose a unique project name and project reference. Do not restore or clone a production database.
2. Independently confirm the project reference, database host/name, Auth project URL and region in the provider console. Compare them with production identifiers without opening or connecting to the production database.
3. Store the generated database password and keys directly in the approved provider secret manager; do not place them in Git, chat, shell history, Vite variables or this document.
4. Use synthetic data only. Do not import European prospect records until the separate duplicate review and import authorization are complete.

**Migrations, roles and RLS**

1. Treat the full product migrations `001`–`021` and OCI schema migration `022` as different deployment scopes. The SQL in 022 references Supabase Auth, not the platform role table. The current OCI runtime/bootstrap still requires `platform_user_roles`, created by 017 after it alters customer membership schema from 001; resolve that code dependency rather than importing unrelated schema.
2. Rehearse an explicit OCI-only migration target against a disposable clean-room Supabase-compatible database. The existing clean-room rehearsal expects 21 migrations and excludes 022. Capture migration results and inspect table owners, indexes, trigger behavior, foreign keys, grants, RLS and rollback/recovery assumptions.
3. Only after owner approval and review of the [identity/schema remediation plan](oci-identity-schema-remediation-plan.md), apply the OCI-only migration target to the dedicated sandbox project. Never run the full product chain against production or an OCI-only project as an implicit provisioning step.
4. Verify the four OCI tables (`oci_records`, `oci_settings`, `oci_user_roles`, `oci_audit_events`) have RLS enabled, and that `public`, `anon` and `authenticated` have no table privileges. Verify only the intended backend principal can use the permitted OCI table operations.
5. Test role revocation, duplicate identity constraints, mutation audit triggers, audit-failure rollback and denied direct anonymous/authenticated data access using disposable synthetic records.
6. Confirm how the Node backend's direct PostgreSQL connection maps to a database role. Do not assume Supabase RLS constrains a privileged database owner or service-role connection. Restrict database credentials/permissions to the minimum practical for this backend and isolate the project itself as the primary boundary.

**Auth settings**

- Use the project's own Auth URL and public anon key for this environment only.
- Disable public signup, or ensure signup cannot grant access. Invite only the approved founder; require email verification.
- Configure TOTP MFA and require a verified `aal2` session for OCI access. Configure provider login/rate protections and an approved email delivery route.
- Add only the exact approved HTTPS redirect URLs for the sandbox; do not use wildcard redirects.
- Do not enable an OAuth provider or recovery route unless separately needed and owner-approved.
- Test that ordinary authenticated users, unconfirmed identities and `aal1` sessions fail closed.

**Audit and recovery**

- Confirm the `oci_audit_events` table and mutation/role audit triggers work; record no tokens, personal contact data or secrets in audit metadata.
- Set up a sandbox-only backup/recovery process. Verify backup age, retention and restore procedure before the environment is used for sustained work. Do not use a production backup as seed data.
- Record who can access the provider console and database; keep access to the founder and designated infrastructure operator.

### 2. Dedicated backend deployment — 1–3 hours

1. Create a **new** backend service named and labeled as non-production in the approved Render organization (or another owner-approved host). Do not alter or reuse the existing `operionos-backend` service in [render.yaml](../render.yaml); it is a single `plan: free`, `autoDeploy: true` service and is not an isolated sandbox definition.
2. Select the reviewed repository/branch and Node runtime compatible with `package.json` (`>=24`). Use the lockfile-based install (`npm ci`) for reproducibility. Disable unreviewed deployment triggers; require a reviewed sandbox branch/deployment action so normal production source changes cannot silently change the sandbox, and vice versa.
3. Set only sandbox values in the new service's environment:
   - `SUPABASE_URL` — the dedicated sandbox Auth project.
   - `SUPABASE_ANON_KEY` — that project's public anon key (or the supported existing fallback variable).
   - `DATABASE_URL` — the dedicated sandbox PostgreSQL connection only.
   - `OCI_DATABASE_CA` — only the approved CA chain if required by the provider; keep it a secret and preserve hostname/certificate verification.
   - `OCI_ALLOWED_ORIGINS` — exactly the approved sandbox frontend origin(s), no wildcard.
   - Platform `PORT` and other runtime-required, non-sensitive settings as required by the host.
4. Inspect startup dependencies before deciding any optional variables. Do not copy the production environment group. Omit production service-role, payment, AI, email, storage, analytics and customer database credentials. If a feature absolutely requires an external integration, use a dedicated sandbox/test credential with the feature disabled by default.
5. Ensure backend HTTPS, correct trusted-proxy configuration, restricted outbound permissions where available, private logs, no credential logging and access to provider audit logs.
6. Use a host health check only for process liveness. The existing `/api/health` endpoint is generic and does not prove OCI readiness. A protected `/api/oci/access` call requires founder MFA and writes an access audit event; do not configure it as an unauthenticated liveness probe.
7. Keep API CORS to the exact sandbox web origin. The application defaults to `https://oci.operionos.com`; explicitly set the sandbox allowlist and verify the actual response. Keep the existing per-process rate protection; if using multiple backend replicas, provision shared/edge rate limiting before scaling.

### 3. Independent Vercel OCI deployment — 1–2 hours

1. Create a dedicated Vercel project in the approved organization, connected to the authorized repository. Configure `oci` as the project root and allow the build to read files outside that root, as described in [OCI deployment documentation](./oci-deployment.md).
2. Use the existing [OCI Vercel config](../oci/vercel.json): install command `npm --prefix ../frontend ci`, build command `node ../scripts/build-oci.js`, OCI output directory `dist-oci`, and OCI entry rewrite. Verify the Vercel project selected for every deployment; never use the public website project.
3. Configure only these client-visible variables with **sandbox** values:
   - `VITE_API_BASE_URL` — dedicated sandbox API origin (base only; client appends `/api/oci`).
   - `VITE_SUPABASE_URL` — dedicated sandbox Auth project.
   - `VITE_SUPABASE_ANON_KEY` — that project's public anon key.
4. Never provide `DATABASE_URL`, DB passwords, service-role/admin keys, SMTP secrets, bootstrap token or other privileged credentials to Vercel build variables with a `VITE_` prefix.
5. Restrict production/preview deployment access using the selected plan's approved deployment protection. Treat `noindex`, cache headers and a hard-to-guess URL as supplementary, not authentication.
6. Set the deployed CSP `connect-src` to the exact sandbox API and Supabase origins. The committed OCI policy currently permits broad `https:` connections; confirm how to narrow it for this deployment. Do not accept a policy that permits the production API or unrelated origins.
7. Enable only the approved custom domain after the hostname gate is resolved. Configure HTTPS and verify the certificate. Do not alter DNS during this blueprint phase.
8. Confirm the compiled JavaScript contains only the public sandbox Auth URL/anon key and API origin. The client hostname guard accepts only `oci.operionos.com` (or loopback); if a separate host is selected, stop for the separately approved code change rather than bypassing the guard.

### 4. Founder-only access — 1–2 hours plus owner interaction

1. Through the sandbox project's provider invitation flow, invite the approved founder; do not create a public signup or reuse a production password/session.
2. Founder verifies email, sets their own credential, enrolls TOTP and completes a test MFA challenge. Verify provider session assurance is `aal2`.
3. Use the approved operator terminal/environment configured only for sandbox `SUPABASE_URL`, `DATABASE_URL` and temporary bootstrap variables. Never put the short-lived access token in shell command arguments, chat, source control or logs.
4. Run the bootstrap command in verification-only mode first. Review the verified email/project identity. Only after a separate explicit authorization should the operator invoke the mutating `--apply` flow on the confirmed sandbox project; this assigns the founder's platform and OCI roles and writes an audit event.
5. Remove the bootstrap token from the operator environment immediately after use. Confirm the founder has active assignments in both role systems, a verified email and an `aal2` session.
6. Verify anonymous, non-founder, unconfirmed and non-MFA access is denied. Verify only the founder can access the sandbox. Check that sign-out and session expiry require reauthentication.

### 5. Acceptance and controlled use — 1–3 hours

Use synthetic accounts and no customer/production data:

- Confirm Vercel project ID, Render service ID, Supabase project reference, Auth issuer, database hostname/name and region match the approved sandbox inventory.
- Confirm each backend/frontend setting resolves exclusively to sandbox resources. Compare identities in provider consoles; do not use a production connection to test this.
- Confirm the frontend origin, CSP and backend CORS allowlist agree exactly.
- Confirm TLS verification succeeds for frontend/API/database. Do not set `rejectUnauthorized: false`, `sslmode=disable`, wildcard CORS or wildcard Auth redirects.
- Confirm platform and OCI roles, MFA, access audit, business audit and failure-closed behavior.
- Run controlled account create/read/update/archive and duplicate-conflict checks, inspecting only synthetic records.
- Confirm no production data, production secrets, customer files, or live prospect import is present.
- Test sandbox backup and restore, then record owner, restore instructions, retention window and cleanup date.
- Record results and environment identifiers in an approved internal secret-free inventory, not in application environment files.

Do not import the 20-account European Aviation portfolio until its separate duplicate-review gate is resolved in this verified sandbox and a later import is explicitly authorized.

## Security acceptance checklist

### Isolation

- [ ] Dedicated sandbox Vercel project, deployment protection and origin verified.
- [ ] Dedicated backend service, service identity, branch/deploy policy and logs verified.
- [ ] Dedicated Supabase project, Auth issuer and database host/name verified distinct from production.
- [ ] No production database URL, provider key, storage bucket, customer data or copied production backup exists in sandbox configuration/data.
- [ ] No sandbox API or frontend variable points to production; CSP and CORS are exact-origin.
- [ ] Sandbox and production browser sessions/identities are independent.

### Supabase/database

- [ ] Owner-approved region and billing plan recorded.
- [ ] Migration prerequisites rehearsed in clean room; approved ordered chain applied only to sandbox.
- [ ] OCI RLS enabled and grants reviewed; direct access tests deny `anon`/`authenticated`.
- [ ] Effective PostgreSQL runtime principal and its privileges reviewed.
- [ ] OCI unique index, triggers, audit behavior, role revocation and failure rollback tested.
- [ ] Database TLS certificate and hostname verified; approved CA installed only if needed.
- [ ] Synthetic-only data policy, backup, restore and retention verified.

### Vercel/backend

- [ ] Vercel project/root/build/output confirmed as OCI-only; public site untouched.
- [ ] Build contains only the sandbox Auth URL, public anon key and sandbox API origin.
- [ ] Backend uses only sandbox Auth/database values; secrets are stored server-side.
- [ ] No privileged credential uses a `VITE_` variable or reaches browser bundles/logs.
- [ ] Sandbox hostname accepted by the current client. If a different hostname is necessary, approved code change completed separately.
- [ ] HTTPS certificates, exact CORS, exact CSP, no-store/noindex and deployment access controls verified.
- [ ] Health monitoring distinguished from readiness; no unauthenticated health route exposes protected diagnostics.
- [ ] Rate limiting and trusted-proxy behavior match the hosting topology.

### Founder

- [ ] Public signup disabled or unable to grant access; only intended founder invited.
- [ ] Founder email verified and TOTP MFA enrolled; `aal2` observed.
- [ ] Both active role assignments exist only in the sandbox.
- [ ] Bootstrap was verified before apply; apply has separate owner approval and audit entry.
- [ ] Anonymous, ordinary-user, unverified-email and non-MFA requests fail closed.
- [ ] Session expiry/signout/revocation tested; founder-only access confirmed.

## Cost and time planning

Public price references checked on 2026-11-01:

- [Supabase pricing](https://supabase.com/pricing) lists Free at $0, limited to two active projects and pausing after one week of inactivity; Pro starts at $25/month at the organization level, with project compute and usage to account for. Do not assume a second project costs only the plan sticker price; check compute credits, region, backups, logs, egress and current quotas.
- [Vercel pricing](https://vercel.com/pricing) lists Hobby at $0/month and Pro at $20/month, with usage/plan terms. Verify the owning organization, private deployment controls and permitted use before choosing a plan.
- The existing [Render blueprint](../render.yaml) declares the current backend service as Free; this is not a quote or a suitable isolation decision for a new non-production backend. Select the dedicated service plan in the Render console and review its current billing/availability.

No aggregate budget can be verified without account plan, region, compute, deployment protection, usage, retention and add-on choices. Provisioning owner must approve a spend ceiling and usage alerts before creating resources. Price pages and account eligibility can change; recheck them at approval time.

Estimated hands-on time is approximately **7–17 hours**, plus provider approval, domain work and any migration dependency remediation. Steps 1–3 may overlap only where the isolation identifiers and owner approvals are already fixed. Do not parallelize deployment against an unapproved database target.

## Explicit approvals required

No work beyond this blueprint may begin until the founder/operator explicitly approves:

1. The dedicated provider organizations, sandbox project/service names and region.
2. The exact sandbox hostname and whether `oci.operionos.com` is available for this role.
3. The monthly spend ceiling and acceptable Supabase/Vercel/Render plans.
4. The sandbox migration rehearsal and subsequent migration execution.
5. Founder invitation and TOTP verification.
6. The bootstrap `--apply` role mutation.
7. Post-setup sandbox-only acceptance tests.
8. A later, separate authorization before importing any prospect records.

**Current phase outcome:** read-only architecture review and provisioning plan only. No account, project, secret, domain, database, migration, deployment or application code was changed.
