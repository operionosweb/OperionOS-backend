# OCI Identity and Schema Remediation Plan

## Recommendation

**Use an OCI-specific role as the single OCI authorization authority and
separate OCI migration targeting from the shared product migration chain.**

The current SQL migration `022_oci_foundation.sql` is already standalone at
schema level: it needs Supabase Auth's `auth.users`, standard Supabase/Postgres
roles, and PostgreSQL facilities, but not
`platform_user_roles`, organization memberships, customer-contract tables, or
the rest of migrations `001`–`021`.

The application is not yet standalone. `ociAccessMiddleware.js` requires both
an active OCI `super_admin` and an active platform `SUPERADMIN`; the bootstrap
script creates both. This links OCI authorization to the wider product
authority and can unnecessarily grant global platform privileges. The
existing OCI-specific `oci_user_roles` table is sufficient for the required
explicit, database-backed role check when combined with verified Supabase Auth
identity, confirmed founder email, server-side `aal2`, and audited operator
provisioning.

**No code or migration changes are made by this plan.**

## Identity contract

| Condition | Required behavior |
|---|---|
| Supabase identity | The project-specific Auth service validates the bearer session; backend verifies subject, issuer, audience, expiry, and confirmed email. |
| Founder | The only initial OCI principal is the verified Auth UUID whose confirmed email matches `meelis@operionos.com` (case-normalized comparison). Email text alone is never the database identity. |
| OCI role | An explicit active `public.oci_user_roles` row with role `super_admin`; row assignment and revocation are operator controlled and audited. |
| MFA | Every protected request requires provider-verified `aal2`; `aal1`, no factor, or an unverified factor is denied. Provider project policy must also require MFA. |
| Authorization source | Database-backed role lookup on the backend for each protected operation. No frontend claim, metadata field, request header, or user-editable profile grants access. |
| Registration | Disable public signup at the dedicated Supabase Auth project. Create/invite the approved founder through an operator-controlled flow. |
| Privilege management | No user-facing role grant endpoint or self-service role assignment. Never automatically grant a role to the first registered user. |
| Tenant authority | `organization_memberships` is not used to authorize OCI, and an OCI Super Admin does not gain access to customer contracts through OCI roles. |

## Proposed source changes for review

These are design proposals, not applied changes.

| Surface | Proposed change | Security invariant |
|---|---|---|
| `middleware/ociAccessMiddleware.js` | Replace the join to `platform_user_roles` with a query for the caller's active `oci_user_roles` row and `role = 'super_admin'`. Keep Auth token verification, confirmed email, issuer/audience/expiry checks, mandatory `aal2`, auditing, fail-closed behavior, and server-side per-request checks unchanged. | OCI grant remains explicit and database-backed; neither platform nor customer roles can substitute for OCI assignment. |
| `scripts/bootstrap-oci-superadmin.js` | Remove platform-role select/insert/reactivation. Pin the intended initial founder to `meelis@operionos.com`; require an explicit operator-only apply action and verified Auth identity. Never create an Auth user or infer authority from an empty role table. Write only the OCI role and audit entry, transactionally. Keep default verify-only and failure/revocation closure. | No first-signup auto-grant, no customer/global platform privilege, and no self-service role mutation. |
| Initial factor sequence | The existing UI reaches TOTP enrollment only after `/api/oci/access` has found a role, while current bootstrap requires `aal2` before inserting it. Replace the circular first-user path with a documented, operator-controlled initial OCI role assignment for the exact verified Auth UUID. That assignment does not authorize data access until the backend sees `aal2`; every data endpoint remains denied at `aal1`. Keep role mutation outside browser/API self-service. | Initial onboarding cannot read commercial data before verified MFA; the privileged assignment is explicit and attributable to an operator. |
| `test/oci-access.test.js` and `test/oci-workflows.test.js` | Replace assertions/mocks for the platform table with OCI-role-only authorization; test missing/revoked roles, non-founder email, unconfirmed user, invalid JWT, `aal1`, forged metadata/header, audit failure, role revocation, and bootstrap conflicts. | Tests enforce the reduced scope and preserve all current MFA/Auth/audit controls. |
| `test/identity-architecture.test.js` | Keep assertions for platform-vs-tenant separation on customer routes, and add assertions that OCI role schema/runtime do not query or mutate `platform_user_roles`. | Customer platform authorization remains unchanged; only OCI is decoupled. |
| Migration rehearsal | Add a separate OCI-only clean-room target that applies 022 alone against a minimal Supabase-compatible Auth/role baseline. Do not silently repurpose the 001–021 customer-chain rehearsal. | The test proves the exact intended OCI migration target and does not create customer schemas. |
| Supabase deployment target | Introduce an explicit OCI migration path/allowlist that selects only the OCI foundation migration. The existing shared `supabase/migrations` directory is treated as the whole-product history; do not run a default whole-directory push against an empty OCI project. Keep one canonical OCI SQL source and a test preventing drift if a separate target must reference it. | Production OCI provisioning can never accidentally apply customer/platform migrations as an implicit side effect. |
| Provider settings and runbook | Disable public signup, verify the confirmed founder identity, require MFA/TOTP, and document the operator-only role assignment and revocation path. | External provider configuration complements, but never replaces, server-side identity/role/MFA checks. |

### Compatibility control

Before deploying the middleware change to any environment with OCI role rows,
compare the set of users currently satisfying both role predicates with the
set having an active OCI role. The new single-authority model must not expand
the authorized identity set accidentally. Investigate every active OCI-role
row that lacks an active platform role; do not silently promote it. The
initial dedicated project should contain only the founder's explicitly
approved OCI assignment.

Removing the platform role requirement must not remove any of the current
security conditions: verified provider token, confirmed expected email,
active OCI role, MFA `aal2`, per-request server-side check, access audit, and
fail-closed responses.

## Proposed clean-project sequence

1. **Approve the source refactor.** Review and separately authorize the
   middleware, bootstrap, tests, migration-target separation, and operator
   onboarding changes above. No code change is included in this task.
2. **Prepare the isolated project.** Create the dedicated Supabase project
   under the approved organization and exact approved region in a separate
   provisioning action. Do not connect it to the customer project/database.
3. **Configure Auth first.** Turn off public signup; configure the dedicated
   project URL/issuer and MFA/TOTP requirements; verify no customer Auth
   project values are reused.
4. **Create and verify the founder identity.** Through an operator-controlled
   invitation/creation workflow, establish the exact
   `meelis@operionos.com` identity and verify its email. Record the Auth UUID
   as non-secret provisioning metadata. Do not grant roles to any other
   identity.
5. **Apply the OCI-only schema.** Use the dedicated OCI migration target to
   apply `022_oci_foundation.sql` once, with migration-ledger recording and a
   clean-database rehearsal completed first. Do not apply 001–021 as a shortcut
   and do not infer that the shared product migration directory is a safe
   clean-project push.
6. **Create the explicit OCI role.** A named, authorized operator uses the
   approved privileged database procedure to insert the single OCI
   `super_admin` role for the verified founder UUID and records an audit event
   with accurate operator attribution. The operation must not be callable by
   the founder's ordinary browser session. It must not insert
   `platform_user_roles` or create an Auth identity.
7. **Complete MFA onboarding.** The founder signs in to the dedicated Auth
   project, enrolls a TOTP factor through the locked-down OCI MFA flow, and
   verifies it. At `aal1`, test that the access endpoint and every data route
   deny access; after successful challenge/verification produces `aal2`, test
   that only the explicitly assigned founder succeeds.
8. **Prove role and audit behavior.** Confirm access/role/mutation audit
   events, revoke the OCI role in a controlled test, and verify subsequent
   requests fail closed immediately. No platform `SUPERADMIN` role is needed
   for OCI.
9. **Run database acceptance.** Verify schema, RLS, grants, actual backend
   database principal, TLS chain/hostname, access isolation, audit behavior,
   backups, recovery, and readiness against the dedicated project before any
   production OCI application is deployed or portfolio data is entered.

The ordering in steps 6–7 addresses the existing first-user cycle without
weakening MFA: an operator creates an explicit, narrow role row, but the
backend still denies every protected route until the founder completes TOTP
and the server verifies `aal2`. A verified role row is not an authenticated
session and does not itself permit data access.

## Migration dependency and targeting

### What may run independently

`022_oci_foundation.sql` has no SQL reference to `platform_user_roles`,
`organization_memberships`, the customer contract/document schema, or
commercial-intelligence tables. It needs the Supabase-managed `auth.users`
relation and the expected standard Supabase/PostgreSQL roles. Its own table
references are to `auth.users` and `oci_records`.

### What currently cannot run independently

The current OCI application checks `platform_user_roles` at request time and
the bootstrap script writes it. Thus the current source cannot serve a
fresh 022-only project until B is implemented and reviewed.

### Existing migration tooling

The full product migration sequence is 001–021. The source
`test/clean-room-migration-rehearsal.js` asserts exactly 21 files and validates
the whole product schema. It does not include 022 or OCI tables. No
OCI-specific migration config/runner or OCI-only clean-room test was found in
the inspected source. Therefore:

* do not run a generic full-directory migration push against a new OCI project;
* do not change the existing product-chain migration test to hide the extra
  schema requirement;
* establish an explicit OCI-only migration target and test, retaining 022 as
  the single canonical SQL source or enforcing exact source parity.

## Rollback and recovery

* **Before application:** stop without changing anything if preflight, exact
  project identity, Auth baseline, or target directory checks fail.
* **Migration failure before commit:** verify the provider migration runner
  reports rollback and no partial OCI objects remain before retry. Do not
  assume provider tooling wraps migration transactions identically.
* **Successful migration, failed app deployment:** keep the OCI schema;
  disable the OCI app/backend deployment or credentials. Do not drop schema
  just to restore application release state.
* **Role assignment error:** revoke the specific OCI role through the approved
  audited operator path, verify all requests fail closed, and preserve audit
  history. Do not restore or mutate a broader platform role as a workaround.
* **Schema rollback:** `022` is not idempotent and contains multiple
  functions/triggers/tables. On a project with data, do not drop it as an
  automated rollback. Prefer a forward corrective migration. Destructive
  removal requires a verified backup, confirmation that no OCI data or
  dependencies exist, explicit owner approval, and a reviewed object-by-object
  rollback procedure.
* **Recovery test:** rehearse both migration failure and application rollback
  on a disposable isolated database before production approval.

## Acceptance tests before any production execution

### Migration tests

* Apply only migration 022 to a clean Supabase-compatible database baseline.
* Assert no prerequisite table outside the Auth baseline is referenced.
* Assert no customer contract, membership, document, storage, platform-role, or
  commercial-product table is created.
* Inspect every OCI table, foreign key, constraint, unique/index definition,
  trigger/function, RLS flag, and privilege grant.
* Prove second application is rejected/unsafe by the migration ledger rather
  than advertised as idempotent.

### Identity and authorization tests

* Only a confirmed `meelis@operionos.com` Auth user is eligible for initial
  grant; exact Auth UUID is matched after provider verification.
* No public signup, no API or frontend role assignment, and no authorization
  from editable metadata, email text alone, or headers.
* No role, revoked role, wrong role, unconfirmed email, malformed token,
  untrusted signature, wrong issuer/audience, expired token, or MFA `aal1`
  results in denied access.
* Active OCI role + verified `aal2` permits the founder; role revocation denies
  the next request.
* MFA enrollment and challenge are verified; no temporary session or bypass
  path can access OCI data.
* Auth outage, database outage, authorization query failure, or required audit
  failure is denied/fails closed.
* Initial role assignment is an explicit operator action with accurate audit
  actor and rollback on failure; no automatic first-user behavior.

### Compatibility and isolation tests

* Compare current dual-role authorized identities and OCI-only role rows before
  the application predicate changes.
* Confirm customer-facing platform guards still use `platform_user_roles` and
  organization access still uses tenant membership; no customer migrations or
  role definitions are changed by the OCI refactor.
* Confirm OCI does not connect to customer production Auth, database, storage,
  or credentials.
* Verify the deployed frontend has only public OCI Auth values and no database,
  service-role, or bootstrap secret.
* Verify the actual backend TLS chain/hostname and run an authenticated
  read-only query with certificate validation enabled.

## Scope disposition

No provider session, cloud project, production database, or credential was
used. No migration, application code, role assignment, or account record was
changed. This plan is for owner review before a separate implementation and
provisioning authorization.
