# OCI Identity Remediation Implementation Report

## Verdict

**IMPLEMENTED — READY FOR ISOLATED DATABASE ACCEPTANCE.**

OCI now uses its dedicated Supabase Auth project and PostgreSQL endpoint, and
`oci_user_roles` is the sole OCI authorization authority. Offline authorization,
bootstrap, migration-target and browser acceptance checks pass. This verdict
does not mean a database has been migrated or that production infrastructure
has passed acceptance.

## Scope and implementation

The change preserves customer-facing platform role logic and the shared
001–021 migration history. It does not create cloud resources, access a live
provider or database, apply migrations, deploy, or provision an identity.

| Area | Implementation |
|---|---|
| Server authorization | [OCI access middleware](../middleware/ociAccessMiddleware.js) verifies the provider-confirmed user and checks confirmed email, signed issuer/subject/audience/expiry claims, and `aal2`. It reads only the caller's active `public.oci_user_roles` row with role `super_admin`, audits access, and fails closed. |
| Auth isolation | [OCI Supabase Auth client](../config/ociSupabaseAuth.js) uses only `OCI_SUPABASE_URL` and `OCI_SUPABASE_ANON_KEY`. The URL must be HTTPS and match `OCI_SUPABASE_PROJECT_REF`. Customer Auth variables are not fallbacks. |
| Database isolation | [OCI PostgreSQL transport](../repositories/ociDatabase.js) uses only `OCI_DATABASE_URL`, `OCI_DATABASE_TARGET=dedicated-oci`, and the same project reference. It rejects a generic `DATABASE_URL`, mismatched project hosts, and TLS overrides; certificate and hostname validation remain enabled. |
| Founder bootstrap | [Bootstrap command](../scripts/bootstrap-oci-superadmin.js) accepts only `meelis@operionos.com`, provider-confirmed email and `aal2`. Default mode verifies only. Explicit `--apply` serializes the initial grant, refuses any pre-existing OCI role row, inserts only the OCI role and audit event in one transaction, and never modifies platform roles. Auth and database project references must match. |
| MFA onboarding | [OCI Auth UI](../frontend/src/oci/Auth.jsx) checks assurance before calling the access endpoint, allowing the founder to enroll and verify TOTP while at `aal1`. The backend still denies every protected route without both an active OCI role and `aal2`; frontend state does not grant authorization. |
| Migration targeting | [OCI migration runner](../scripts/migrate-oci.js) targets only `022_oci_foundation.sql`, requires explicit target and project-reference variables plus `--apply`, and tracks a checksum under an advisory lock. It safely no-ops for an exact applied checksum and stops for a mismatch or incomplete attempt. |
| Tests and operator docs | Updated OCI authorization/workflow tests, added [migration-target tests](../test/oci-migration-target.test.js), included them in the offline runner, and updated the [deployment procedure](oci-deployment.md) and [OCI environment template](../.env.oci.example). |

## Founder bootstrap sequence

1. In the dedicated OCI Supabase project, disable public signup, invite
   `meelis@operionos.com`, and verify the identity's email.
2. The founder signs in through OCI and enrolls/verifies TOTP. At this stage the
   UI may show the MFA onboarding screen, but no OCI data endpoint is called.
3. Obtain the founder's short-lived `aal2` access token through an approved
   operator workflow. Keep it only in the temporary
   `OCI_BOOTSTRAP_ACCESS_TOKEN` environment setting; do not put it in command
   arguments, source control, logs, or chat.
4. Configure `OCI_BOOTSTRAP_TARGET`, `OCI_BOOTSTRAP_PROJECT_REF`,
   `OCI_BOOTSTRAP_DATABASE_URL`, `OCI_SUPABASE_PROJECT_REF`,
   `OCI_SUPABASE_URL`, `OCI_SUPABASE_ANON_KEY`, and `OCI_DATABASE_CA` as
   applicable. Auth and database references must be identical and verified
   against the provider console.
5. Run `npm.cmd run oci:bootstrap` to verify without mutation. After reviewing
   the dedicated target, run `npm.cmd run oci:bootstrap -- --apply`.
6. Remove the temporary token, then verify the access endpoint and protected
   routes using the actual dedicated project. No bootstrap has been run as part
   of this implementation.

The bootstrap cannot create or invite an Auth identity, assign a role through
the browser, elect an arbitrary first user, reactivate a revoked role, or repeat
after an OCI role row exists. Subsequent role changes need a separately reviewed
operator process with audit attribution.

## Validation results

| Check | Result |
|---|---|
| `npm.cmd run test:oci` | **Passed: 69 tests, 0 failures.** Includes authorization, missing-role denial, forged client metadata, verified-email/MFA checks, bootstrap conflicts/rollback, OCI-only schema references, project-target guards, migration checksum/lock/incomplete-attempt handling, and TLS configuration. |
| `node --test frontend/tests/oci.test.mjs` | **Passed: 34 tests, 0 failures.** Includes MFA enrollment/challenge gating, fail-closed authorization, and responsive layouts from 320px to 1920px. |
| `npm.cmd run build:oci` | **Passed.** OCI production bundle built to `frontend/dist-oci`. |
| `npm.cmd run build` | **Passed.** Public production frontend build completed. |
| `npm.cmd test` | **511 passed, 2 failed out of 513.** Failures are in customer-facing checks: password-recovery source expectation in `test/saas-routing-seo.test.js`, and semantic-H1 check for `CorporateHome.jsx`. Neither failure references OCI identity code. |
| `npm.cmd run test:corporate` | **Failed.** With the local Vite server available, corporate route checks timed out waiting for `#corporate-main h1`; this is outside the OCI identity paths. The OCI-specific browser suite passed with its own local server and responsive checks. |

The backend tests use injected offline transports. They do not prove a real
Supabase Auth session, PostgreSQL migration, RLS behavior, TLS handshake from a
hosting provider, or backup/recovery. The existing full-suite failures were not
modified as they are outside this task's identity scope. The unrelated corporate
browser failure was not changed; responsive OCI behavior is covered by the
passing OCI browser suite.

## Remaining acceptance requirements

- Verify project ownership, region, Auth settings, disabled signup and MFA
  policy in the dedicated Supabase console.
- Rehearse migration 022 with the guarded runner on a disposable, clean
  Supabase-compatible project. Confirm exact tables, constraints, indexes,
  triggers, RLS and grants using a real database connection.
- Verify the approved PostgreSQL CA chain, endpoint hostname and authenticated
  read-only query from the actual backend host. TLS was not tested against a
  live endpoint.
- Verify confirmed founder identity, `aal1` denial, `aal2` without-role denial,
  active OCI-role access, role revocation, audit records, and absence of access
  to customer project data.
- Review the two non-OCI full-suite failures separately before release.

No unresolved identity design decision remains. External provider setup and
isolated-database acceptance are still required before any production
provisioning or deployment.
