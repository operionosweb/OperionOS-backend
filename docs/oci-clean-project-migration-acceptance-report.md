# OCI Clean-Project Migration Acceptance Report

## Verdict

**IMPLEMENTED — READY FOR ISOLATED DATABASE ACCEPTANCE.**

The source and offline guards support an OCI-only clean-project path. No
database was contacted and no migration was executed. A real isolated
PostgreSQL/Supabase rehearsal remains mandatory before production use.

## Migration dependency contract

The OCI migration target is only
[`022_oci_foundation.sql`](../supabase/migrations/022_oci_foundation.sql).
Migrations 001–021 belong to the broader product/customer schema and are not
selected or required by the OCI runner.

```text
Dedicated Supabase project
├── Supabase-managed auth.users
├── standard Supabase/PostgreSQL roles and facilities
└── 022_oci_foundation.sql
    ├── public.oci_user_roles ── FK to auth.users
    ├── public.oci_audit_events ── actor FK to auth.users
    ├── public.oci_settings
    └── public.oci_records ── self-referential record links
        ├── OCI indexes, constraints and validation functions
        ├── OCI audit functions and triggers
        ├── RLS enabled on all four OCI tables
        └── client-role access revoked; bounded service_role grants
```

The migration has a single transaction and is intentionally not an idempotent
SQL script. It does not reference `platform_user_roles`, organization
memberships, customer contracts/documents, or customer profile schema.
`oci_user_roles` is the independent role authority; the backend performs a
fresh server-side lookup for each protected operation.

## Project isolation and target variables

[OCI database configuration](../repositories/ociDatabase.js) does not fall
back to the generic product `DATABASE_URL`. When a connection is requested it
requires
`OCI_DATABASE_TARGET=dedicated-oci`, `OCI_SUPABASE_PROJECT_REF`, and
`OCI_DATABASE_URL`; the PostgreSQL host/user must match the project reference.
[OCI Auth configuration](../config/ociSupabaseAuth.js) independently requires
`OCI_SUPABASE_URL` and `OCI_SUPABASE_ANON_KEY`; the HTTPS Auth hostname must
match that same reference. The Auth key is the public anon key, never a service
role key. These checks ensure that the configured OCI Auth and database
destinations identify the same project. They cannot establish provider
ownership, region, or that the project itself is dedicated; an operator must
verify those facts in the authorized provider console.

The migration command reads only:

- `OCI_MIGRATION_TARGET=dedicated-oci`
- `OCI_MIGRATION_PROJECT_REF`
- `OCI_MIGRATION_DATABASE_URL`
- `OCI_SUPABASE_PROJECT_REF` (must equal the migration project reference)
- `OCI_DATABASE_CA` when an approved CA is required

After isolated rehearsal, review and separate authorization, the command is:

```powershell
npm.cmd run oci:migrate -- --apply
```

Without `--apply`, it exits without a migration. The explicit project URL is
validated before the runner connects. The deployment operator must confirm the
reference belongs to the intended OCI project; a syntactically matching URL is
not proof of project ownership or region.

## Runner safety and recovery

[The runner](../scripts/migrate-oci.js):

1. Reads only the canonical migration 022 file.
2. Acquires a PostgreSQL session advisory lock.
3. Creates a revoked `oci_internal` schema and checksum ledger.
4. Records an `applying` marker before the migration transaction.
5. Applies migration 022 once, then requires exactly one matching ledger row
   update to `applied`.
6. Returns a no-op only when the recorded checksum matches and status is
   `applied`.
7. Refuses checksum drift or an `applying` record; it does not guess whether a
   partial attempt is safe to retry.

If SQL execution fails, the runner requests rollback and leaves the
out-of-transaction marker for operator inspection. If rollback cannot be
confirmed, it reports a recovery blocker. If migration SQL committed but the
ledger finalization failed, the marker remains incomplete and automatic retry
is denied. Because SQL 022 is non-idempotent, do not delete the marker or rerun
the file as an improvised recovery. Inspect schema and transaction outcome,
then use a separately reviewed recovery procedure.

## Tests and verification evidence

The source-level tests in
[`oci-migration-target.test.js`](../test/oci-migration-target.test.js) verify:

- Migration 022's dependency boundary and expected OCI tables, RLS, grants,
  triggers, indexes and Auth foreign keys.
- Dedicated Auth and PostgreSQL endpoints match the same explicit project
  reference.
- A generic database URL, invalid target, wrong project host and malformed
  destination fail closed.
- The runner applies a matching checksum once, no-ops on an exact repeat,
  rejects checksum changes and incomplete attempts, and records rollback on a
  simulated SQL error.

`npm.cmd run test:oci` passed **69 tests**. The OCI browser suite passed
**34 tests**, including `aal1` enrollment before server authorization,
`aal2` challenge before data access, and responsive layouts. Public and OCI
production frontend builds passed. All these checks ran offline; test fixtures
do not emulate PostgreSQL semantics or provider project controls.

## Migration inventory and actual status

| Component | Status |
|---|---|
| Migration 022 source and dependency review | Implemented and statically tested |
| OCI-only guarded runner | Implemented and tested with offline client fixtures |
| Migrations 001–021 | Excluded from the OCI-only runner; unchanged |
| OCI migration applied to a database | **Not run** |
| Clean Supabase project / Auth user / role assignment | **Not provisioned** |
| Live RLS/grant and constraint checks | **Not run** |
| Provider backup/recovery verification | **Not run** |
| Live TLS chain/hostname and hosting handshake | **Not run** |
| Customer database or production access | **Not performed** |

## Required isolated acceptance procedure

1. Create or select an approved dedicated Supabase project in the approved
   region; record its project reference and verify ownership in the provider
   console.
2. Disable public registration, configure required TOTP/MFA and approved
   redirect URLs, and invite the founder. Do not modify customer-project
   settings.
3. Configure the isolated OCI runtime variables from
   [`.env.oci.example`](../.env.oci.example). Confirm Auth URL, database URL,
   migration URL and project reference all resolve to this same dedicated
   project. Keep privileged database credentials out of all frontend build
   variables.
4. Back up the dedicated project and rehearse migration 022 on a disposable
   clean target. Run the exact runner in a controlled rehearsal; verify the
   ledger, schema, constraints, indexes, triggers, RLS and grants directly.
5. Verify the provider-issued database CA chain and hostname, and perform an
   authenticated read-only query from the actual backend hosting environment.
   Never disable certificate validation.
6. Test API denial for anonymous sessions, unverified email, `aal1`, missing or
   revoked OCI role, forged frontend claims, wrong project Auth tokens and
   audit/database failures. Test success only for the confirmed founder with
   active OCI `super_admin` and `aal2`.
7. Verify OCI reads and writes remain in the dedicated project, inspect audit
   records, and prove customer contract data and customer Auth are inaccessible.
8. Record evidence and obtain a separate authorization before production
   migration, role provisioning or deployment.

No founder decision is needed for the source design. Project creation,
provider-side authentication configuration, migration execution, and production
deployment remain explicitly unperformed and require authorized operator
action.
