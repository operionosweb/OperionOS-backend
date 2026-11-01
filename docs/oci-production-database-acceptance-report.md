# OCI Production Database Acceptance Report

**Assessment date:** 2026-11-01\
**Verdict:** **BLOCKED — FOUNDER ACCESS OR SECURITY REQUIREMENT UNAVAILABLE**

## Acceptance summary

There is no provider-verified OCI production project or database available in
the current authenticated environment. Supabase dashboard access redirects to
sign-in, the Supabase CLI is unavailable, and no relevant provider/OCI
environment variables are present (presence checked without reading values).
The organization and project inventory could not be inspected. Consequently
there is no actual database to accept. No customer-facing production database
was accessed.

## Project and provisioning inventory

| Item | Result |
|---|---|
| Supabase organization/project ID | **Not verified; unavailable** |
| Dedicated OCI project existence | **Unknown.** No project inventory was available. |
| Region | **Not selected or account-verified.** |
| PostgreSQL endpoint/database owner | **Not identified.** No connection string was read. |
| Provisioned schema / applied migration inventory | **None verified.** No migrations were applied. |
| Successful authenticated read-only query | **Not run.** |
| TLS certificate chain, dates, hostname, backend handshake | **Not tested.** The source enforces TLS verification; no endpoint/CA is available. |
| Backups and recovery | **Not configured or verified.** Provider plan and project settings are unavailable. |

## Migration source and checksum

The OCI-specific runner targets only
[migration 022](../supabase/migrations/022_oci_foundation.sql), whose source
defines `oci_user_roles`, `oci_audit_events`, `oci_settings`, and `oci_records`,
with OCI constraints, indexes, functions, audit triggers, RLS, and grants. The
migration depends on Supabase-managed `auth.users` and its own OCI schema; it
does not require `platform_user_roles` or customer contract/membership schema.
Migrations 001–021 are not selected by the OCI runner.

Local SHA-256 of the checked-in migration:

```text
781C5D22B6093C1148626A4652006AEBD7ED3422D23AE79FA558BB9764F88504
```

This hash describes the local source only. **It is not a remote migration
checksum, an applied migration result, or evidence of database state.**

The guarded runner applies only migration 022 after explicit `--apply`, checks
the target project reference, records an `applying`/`applied` checksum ledger,
uses an advisory lock and rejects mismatched/incomplete attempts. Its default
no-argument invocation was verified to return without applying anything. No
database connection or migration was attempted. Before using the runner, an
authorized operator must independently verify project ownership and ensure
Auth/database/migration references all identify that exact dedicated project.

## Database control acceptance matrix

| Control | Required live evidence | Result |
|---|---|---|
| OCI table and column inventory | PostgreSQL catalogs match migration 022 | **Not tested** |
| Role table and founder assignment | `oci_user_roles` contains only the approved explicit OCI role | **Not provisioned** |
| RLS | Catalog state and denied direct access for unauthorized roles | **Not tested** |
| Grants/least privilege | Actual backend principal, memberships, grants and `BYPASSRLS` review | **Not tested** |
| Foreign keys/constraints | Live catalog and positive/negative data tests | **Not tested** |
| Indexes | Live catalog matches approved migration | **Not tested** |
| Audit infrastructure | Role/access/mutation audit writes and failure handling | **Not tested** |
| Migration ledger | Remote version/checksum/status matches reviewed source | **Not present/verified** |
| Authenticated read-only query | Successful query through verified TLS from intended runtime | **Not run** |
| TLS | Provider-approved chain, valid dates, hostname match, no bypass | **Not tested** |
| Backups/recovery | Active backup schedule plus restore/recovery evidence | **Not verified** |
| Permitted and denied access | Authorized `aal2` founder allowed; missing role, `aal1`, anonymous and direct client denied | **Not tested** |
| Customer DB isolation | OCI runtime identifies only dedicated OCI project; no customer records accessed | **Not demonstrated** |

The migration's `GRANT`/`REVOKE` statements express intended controls, not
proof that they are applied or effective. The backend/service-role boundary
must be tested against the actual Supabase/PostgreSQL project. No local or
mocked result is represented as live database acceptance.

## Blockers and required operator actions

1. **Authenticate with Supabase.** Sign in to the dashboard with the authorized
   Operion owner account. Verify organization access, project inventory and
   creation permissions. Do not send credentials or tokens.
2. **Select the target.** Confirm a dedicated OCI project exists, or approve
   creation only after checking exact region and price. Record non-secret
   project reference and region.
3. **Bind environment.** Set OCI-only Auth, database, migration and bootstrap
   configuration. Verify all project references match the chosen project and
   that generic customer variables are not used as fallback.
4. **Rehearse.** Apply migration 022 only to an authorized disposable clean
   project. Inspect schema and remote ledger before any production execution.
5. **Accept database.** Verify table/column inventory, RLS, grants, role
   membership, constraints, indexes, audit, access denial, backup/restore, and
   a TLS-verified authenticated read-only query from the actual backend host.
6. **Founder step.** Founder verifies the invited Auth identity, completes
   TOTP enrollment and obtains `aal2`. Only after acceptance should an
   authorized operator run the explicit audited OCI bootstrap.

## Test results and repository preservation

Previously reported source-level results remain: OCI backend **69/69**,
OCI browser/responsive **34/34**, and public/OCI production builds passed.
They are offline tests and do not satisfy any live database acceptance item.
The previous full backend suite was **511/513**; the two failures are in
unchanged customer-facing login/heading checks. The corporate browser suite
timed out waiting for a customer-page H1. Those unchanged, unrelated failures
were recorded before this infrastructure task and were not modified.

No database, migration, role, backup, DNS, deployment, or customer data was
changed or accessed. The 20-prospect portfolio was not imported.
