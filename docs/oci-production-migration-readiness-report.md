# OCI Production Migration Readiness Report

**Inspection:** 2026-11-01, approximately 11:37 CET (Europe/Madrid)\
**Worktree:** `C:\Users\meeli\Operion OS GitHub\OperionOS-oci-europe`\
**Branch / HEAD:** `dev/oci-europe-increment-a` /
`8720815dcea6811326051166e41ba44d61395011`\
**Verdict:** **SOURCE READY FOR ISOLATED ACCEPTANCE; LIVE MIGRATION BLOCKED UNTIL A DEDICATED PROJECT IS APPROVED AND PROVISIONED.**

## Scope and live status

This inspection reviewed the guarded OCI migration source and the current
Supabase management evidence. It did **not** connect to PostgreSQL, execute a
migration, create or change a Supabase project, create a founder role, or
inspect a production database.

The visible organization inventory has two projects but no project identified
as dedicated to OCI. The organization is Free and at its two-active-free-
project limit. A third free project is blocked by the dashboard; no paid
project can be created until the founder approves the plan and exact spend.
The dashboard Owner account is `operionosweb@gmail.com`; this is not evidence
that the separate founder Auth identity `meelis@operionos.com` exists or has
MFA configured in a dedicated OCI project.

## Source readiness findings

| Control | Source evidence | Result |
|---|---|---|
| Migration scope | [`scripts/migrate-oci.js`](../scripts/migrate-oci.js) reads only `022_oci_foundation.sql` | **Verified** |
| Local migration checksum | SHA-256 `781C5D22B6093C1148626A4652006AEBD7ED3422D23AE79FA558BB9764F88504` | **Verified against current file** |
| Explicit target guard | Runner requires `OCI_MIGRATION_TARGET=dedicated-oci`, valid project reference and PostgreSQL URL; `--apply` is required | **Verified in source** |
| Auth/database project consistency | Runner validates OCI Auth URL and database destination against the same project reference and compares `OCI_MIGRATION_PROJECT_REF` with `OCI_SUPABASE_PROJECT_REF` | **Verified in source** |
| TLS | OCI database config enforces certificate verification (`rejectUnauthorized: true`) and validates optional PEM CA input | **Verified in source; no live TLS handshake** |
| Tracking and ordering | `oci_internal.schema_migrations` records version, checksum and `applying`/`applied` state; an advisory lock prevents concurrent runs; incomplete or drifted attempts fail closed | **Verified in source** |
| Customer migration dependency | Runner selects migration 022 only; migrations 001–021 are not selected | **Verified in source** |
| Customer role dependency | Migration 022 does not reference `platform_user_roles`; OCI role table is `public.oci_user_roles` | **Verified in source** |
| RLS and audit | Migration 022 enables RLS on OCI tables, revokes client-role table access, grants bounded service-role access, and defines OCI audit functions/triggers | **Verified in source** |
| Founder bootstrap | Separate explicit bootstrap requires the designated founder identity and MFA assurance; it is not automatic and was not run | **Source design only; no identity/role provisioned** |
| Live schema, ledger and backup state | No dedicated OCI database was inspected | **Not verified** |

The local checksum identifies only the checked-in migration source. It is not
a remote checksum or evidence that migration 022 has been applied. Migration
022 is OCI-only and contains `oci_user_roles` as its sole OCI role authority;
it does not import customer-platform roles or customer contract data.

## Required OCI environment binding

The source expects project-specific settings from
[`.env.oci.example`](../.env.oci.example), including:

- `OCI_DATABASE_TARGET=dedicated-oci`
- `OCI_SUPABASE_PROJECT_REF` and `OCI_SUPABASE_URL`
- `OCI_SUPABASE_ANON_KEY` for the public Auth client only
- `OCI_DATABASE_URL` and, when required, verified `OCI_DATABASE_CA`
- `OCI_MIGRATION_TARGET=dedicated-oci`
- `OCI_MIGRATION_PROJECT_REF` and `OCI_MIGRATION_DATABASE_URL`

These are configuration names, not provisioned values. No privileged
database credential or service-role key belongs in frontend variables.
Runtime Auth, database, migration and bootstrap references must resolve to
the same newly approved OCI project. The migration must not use customer
project credentials or a generic database fallback.

## Outstanding live acceptance

Before migration execution, the authorized operator must:

1. Obtain founder approval for the organization plan, Ireland region, compute,
   and exact dashboard spend; provision the dedicated OCI project in a
   separate approved task.
2. Verify its organization, project name/reference, European region, separate
   PostgreSQL/Auth, and billing/backup settings in the provider dashboard.
3. Configure OCI-only variables locally and verify Auth/database/migration
   reference equality and the provider-issued TLS CA. Do not put credentials
   in this report or frontend configuration.
4. Rehearse migration 022 on an approved clean isolated target; inspect the
   remote checksum ledger, schema, RLS, grants, audit triggers and denied
   access before any production application.
5. Verify the founder's confirmed `meelis@operionos.com` Auth identity and
   required MFA (`aal2`). Only after database acceptance should an authorized
   operator perform the explicit, audited OCI-only Super Admin bootstrap.
6. Separately test backup/restore, live TLS hostname validation, and isolation
   from customer Auth/database data.

Until these steps are completed, the production migration is **not authorized
or ready to execute**. Do not use the existing `operion-phase3b-test` or
`Operion OS's Project` as a substitute, and do not remove or pause either
project to bypass the free quota.

## Worktree preservation and validation

The requested branch and HEAD were observed before report creation. The
worktree already contained unrelated tracked modifications and untracked OCI
implementation/portfolio deliverables; they were not reverted or altered by
this access review. Only this report and the two companion access/selection
reports were created for the current request. No application source,
migration, cloud resource, database, DNS, billing setting, or Git reference
was changed.

After the report additions, the branch remained
`dev/oci-europe-increment-a` at
`8720815dcea6811326051166e41ba44d61395011`; all three requested report paths
exist, the new files have no trailing whitespace, and `git diff --check`
passed.
