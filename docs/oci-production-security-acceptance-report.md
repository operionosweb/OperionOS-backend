# OCI Production Security Acceptance Report

**Assessment date:** 2026-11-01\
**Verdict:** **BLOCKED — FOUNDER ACCESS OR SECURITY REQUIREMENT UNAVAILABLE**

## Security decision

Production security acceptance cannot be performed without authorized
Supabase organization/project access. The dashboard redirects to sign-in; the
CLI and provider credentials are unavailable. No project, identity, database,
or security settings were changed or tested live. No customer production
resource or record was accessed.

## Provisioned / configured / tested / unverified

| Control | State |
|---|---|
| Dedicated OCI Supabase project | **Unverified; none provisioned in this task** |
| OCI-specific Auth and database target guards | **Implemented in source; not bound to a real project** |
| Auth and PostgreSQL same-project reference | **Locally guarded; live values absent/unverified** |
| `oci_user_roles` role authority | **Implemented in backend source; live role absent/unverified** |
| Verified founder Auth identity/email | **Not checked** |
| TOTP MFA and `aal2` | **Code requires `aal2`; founder factor/session not verified** |
| No public signup | **Not configured or verified in provider** |
| Bootstrap event | **Not run; no role or audit record created** |
| OCI migration 022 / RLS / grants | **Source-reviewed; not applied or tested in PostgreSQL** |
| TLS certificate and hostname | **Verification enforced in code; actual endpoint handshake not run** |
| Customer database/Auth isolation | **Source guards reject generic product URL fallbacks; live project separation not proven** |
| Frontend secret boundary | **Source uses public OCI Auth key; no production deployment/bundle environment inspected** |
| Backup/recovery | **Not configured or verified** |
| DNS, hosting, API CORS/private access | **Not configured or tested** |

## Source-level controls (not external proof)

- OCI middleware verifies the Supabase Auth user, confirmed email, issuer,
  subject, audience and expiry, then requires `aal2` and a database-backed
  active `oci_user_roles` `super_admin` assignment on every protected request.
  It does not depend on `platform_user_roles` or frontend role claims.
- OCI Auth uses only the explicit OCI project URL and public anon key. PostgreSQL
  uses only OCI-specific database configuration and TLS verification. The
  configured Auth, runtime database, migration and bootstrap references must
  match; these checks do not prove who owns the cloud project.
- The founder bootstrap accepts only the confirmed
  `meelis@operionos.com` identity with `aal2`, requires explicit operator
  `--apply`, assigns only the OCI role and writes an audit event transactionally.
  It refuses repeat/previously occupied role tables. It has not been run.
- Migration 022 defines OCI-only schema, RLS and grants. The guarded migration
  runner only selects 022 and stores a checksum. The local SHA-256 is
  `781C5D22B6093C1148626A4652006AEBD7ED3422D23AE79FA558BB9764F88504`;
  this is not a remote applied checksum.

## Required founder action

1. Sign into `https://supabase.com/dashboard` using the authorized Operion
   owner account and provide an authenticated dashboard session through the
   approved browser workflow.
2. Verify the Operion organization, project inventory, project-creation
   permission, exact European region and billing approval. Do not provide
   credentials, MFA codes, API tokens, database passwords or connection
   strings in chat.
3. If no suitable dedicated OCI project exists, approve exact project settings
   and costs before creation. Do not modify the customer Supabase project.
4. After the dedicated project is prepared, the founder must personally
   complete invited identity/email verification and TOTP enrollment. An
   authorized operator then supplies the short-lived `aal2` token only via
   the approved local environment and runs the explicit bootstrap after
   database acceptance.

Until access is available, stop; do not attempt an API workaround, account
creation, migration, bootstrap or database connection.

## Security acceptance blockers

1. **Project ownership/isolation unknown:** no provider inventory or project
   reference. Require provider-console evidence of the approved organization,
   dedicated project, exact region and independent credentials.
2. **Database controls unknown:** require live RLS, effective grants, backend
   principal, constraints, indexes, audit, allowed/denied access and customer
   data isolation tests on the dedicated database.
3. **TLS unknown:** obtain the approved provider CA chain; verify dates and
   hostname; perform an authenticated read-only query from the actual backend
   hosting environment with TLS validation enabled. Never use
   `rejectUnauthorized: false`.
4. **Founder controls unknown:** verify exact Auth identity, confirmed email,
   TOTP and `aal2`, explicit OCI role, audited bootstrap, protected API
   success, and denial for `aal1`, missing/revoked role, anonymous and forged
   frontend claims.
5. **Backup/recovery unknown:** inspect actual plan/settings and perform an
   approved restore/recovery verification.
6. **Cost approval unknown:** organization plan, compute, usage and billing
   credits unavailable. Public Supabase pricing lists Pro from $25/month with
   $10/month compute credits and daily backups retained 7 days; confirm the
   actual account quote and chosen compute before authorizing spend.
7. **Hosting/privacy unknown:** verify independent OCI backend and Vercel
   project, server-only database credentials, public anon-key-only frontend,
   CORS/HTTPS/private access and bundle contents. No DNS or deployment change
   is authorized by this report.

## Existing test findings

Prior checks recorded OCI backend **69/69**, OCI browser/responsive **34/34**,
and OCI/public builds passing. The full backend suite was **511/513** because
two assertions fail in unchanged customer-facing source/tests; the corporate
browser test timed out waiting for an unchanged customer page's H1. These
results predate this provisioning task, concern no OCI security behavior, and
remain failures—not passing results. No unrelated customer code was changed.

**Security acceptance is not granted. No cloud resource, migration, identity,
role, DNS record, deployment, or prospect data was provisioned or modified.**
