# OCI Production Supabase Provisioning Report

**Assessment date:** 2026-11-01\
**Verdict:** **BLOCKED — FOUNDER ACCESS OR SECURITY REQUIREMENT UNAVAILABLE**

## Executive decision

No Supabase project was provisioned or changed. Provisioning stopped at the
required access check because no authenticated Supabase dashboard session or
CLI/API access was available. No organization or project inventory could be
read, so there is no verified project identifier, project-creation permission,
or account-specific region availability. The current Supabase browser page
redirects to the sign-in page. The Supabase CLI is not installed, and the
checked process environment did not contain `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `OCI_SUPABASE_URL`, `OCI_SUPABASE_PROJECT_REF`,
`OCI_DATABASE_URL`, `OCI_MIGRATION_PROJECT_REF`, or
`OCI_BOOTSTRAP_ACCESS_TOKEN` (presence checks only; no values were read).

No cloud API, database endpoint, or customer production project was contacted.
No migration, founder bootstrap, paid-plan selection, deployment, DNS change,
or prospect import was attempted.

## Access verification

| Check | Result |
|---|---|
| Authenticated Supabase dashboard | **Unavailable.** `https://supabase.com/dashboard/projects` redirected to `https://supabase.com/dashboard/sign-in?returnTo=%2Forganizations`. No login was attempted. |
| Supabase CLI | **Unavailable.** `supabase` is not present on PATH. It was not installed. |
| Supabase API credentials | **Unavailable in process environment.** Presence checks for provider access and OCI setup variables returned false; values were not displayed. |
| Operion organization access and project-creation permissions | **Not verifiable without an authenticated account.** |
| Existing project inventory / suitable OCI project | **Not verifiable.** No project list was accessed; existence or absence must not be inferred. |
| Account-specific EU-region availability | **Not verifiable.** Public region offerings are listed below; the account's enabled regions and live capacity require the dashboard. |
| Billing plan, credits, and organization usage | **Not verifiable.** No paid option was selected and no billing page was accessed. |

### Exact founder action needed to resume

1. Sign in to the Supabase dashboard using the authorized Operion owner account
   in the approved browser session.
2. Confirm access to the authorized Operion organization and permission to list
   projects. Confirm project creation permission only if no suitable OCI project
   exists.
3. Review the project inventory read-only and report which project, if any, is
   explicitly dedicated to OCI. Do not send passwords, MFA codes, tokens,
   connection strings, or screenshots containing secrets.
4. Confirm the approved exact European region and approve the applicable plan
   and costs before any billable project creation.
5. Once access is available, authorize continuation in the same workspace.
   The founder must separately complete identity/email verification and TOTP
   MFA interaction before any role bootstrap can occur.

Do not share a provider token or database password through chat. If the owner
cannot provide an authenticated dashboard session or approved provider
credential mechanism, this task remains blocked.

## Target architecture and configuration status

The implementation now requires OCI-specific Auth and database values bound to
one explicit Supabase project reference. `OCI_SUPABASE_URL` must be the HTTPS
URL for that project; `OCI_DATABASE_URL` must be a PostgreSQL endpoint matching
the same project reference; the target must be `dedicated-oci`. OCI runtime
does not fall back to the customer-facing `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
or `DATABASE_URL`. This is a source-level safeguard, not live project-binding
evidence. Both existing organization project references
(`cvwalskmgniwtmqqbdvj` and `amlpybvkzoegnxwuodyn`) are explicitly rejected as
OCI Auth or database targets; the dedicated project must use a new reference.

| Component | State |
|---|---|
| Dedicated production Supabase project | **Not verified or provisioned** |
| Project reference / non-secret project ID | **Unavailable** |
| European hosting region | **Not selected** |
| PostgreSQL / dedicated database credentials | **Not configured or tested** |
| Supabase Auth project and settings | **Not configured or tested** |
| OCI production backend environment | **Not configured or verified** |
| OCI Vercel project/domain | **Not verified** |
| RLS, grants, audit, backup and recovery | **Not tested on an actual project** |
| Migration 022 | **Not applied** |
| Founder identity and OCI Super Admin | **Not provisioned or verified** |

## Region and cost information

Public Supabase documentation lists specific European regions: Ireland
(`eu-west-1`), London (`eu-west-2`), Paris (`eu-west-3`), Frankfurt
(`eu-central-1`), Zurich (`eu-central-2`), and Stockholm (`eu-north-1`).
Supabase's general “Europe” region is Central EU/Frankfurt according to its
current region documentation. A broad region selection is not a substitute for
an exact jurisdiction requirement; choose and approve a specific region.
Account-specific availability remains unverified.

Public pricing inspected on 2026-11-01 at [Supabase
pricing](https://supabase.com/pricing) states:

- Pro starts at **$25/month per organization** and includes **$10/month in
  compute credits**, which cover one Micro project.
- A single database-only Micro project on an existing Pro organization is
  listed as **$25/month before usage beyond included quotas**. If the
  organization is not already on Pro, this is not the complete cost of moving
  the organization to that plan. Additional projects, larger compute, storage,
  egress, IOPS, add-ons and usage may increase charges.
- Pro advertises daily backups stored for 7 days; actual project backup/PITR
  configuration and restore capability still need verification.

These are public list prices, not an account quote. Existing plan, credits,
taxes, usage, selected compute size, backup add-ons and regional/account
conditions are unknown. No plan, compute size or paid service was selected.
Reconfirm totals in the authorized billing console before approval.

## OCI-only migration candidate (not executed)

The runner at [scripts/migrate-oci.js](../scripts/migrate-oci.js) is configured
to apply only `022_oci_foundation.sql`; it requires the explicit OCI target,
project references, `--apply`, a checksum ledger and an advisory lock. It
refuses mismatched targets, checksum drift and incomplete attempts. Its
no-argument invocation was checked and printed that no migration was applied.
No remote connection was made.

Local SHA-256 of the current
[migration source](../supabase/migrations/022_oci_foundation.sql):

```text
781C5D22B6093C1148626A4652006AEBD7ED3422D23AE79FA558BB9764F88504
```

This is **only the local file checksum**. It is not a remote migration ledger
entry and does not indicate that migration 022 has been applied. No project
reference exists to bind it to. The runner's destination guard checks URL and
project-reference consistency but cannot independently prove provider account
ownership or intended project purpose; the operator must confirm those facts
in the dashboard before connection.

## Test findings from the preceding implementation

The prior implementation report recorded OCI backend **69/69**, OCI
browser/responsive **34/34**, and both OCI/public production builds passing.
The full backend suite was **511/513**, with failures in
`test/saas-routing-seo.test.js` (password recovery assertion and semantic H1).
The corporate browser suite timed out waiting for `#corporate-main h1`.

These failures are unrelated to the provisioning task and pre-existing to this
infrastructure request: the failing customer test/source files are unchanged
in the worktree and the earlier implementation report recorded the same
failures before this task. The errors concern a customer login source-string
expectation and a corporate page heading, not OCI auth, migration, or project
provisioning. No unrelated customer-facing code was changed. Do not describe
the full backend/corporate suites as passing.

## Next actions

1. Founder supplies an authenticated, authorized Supabase dashboard session as
   described above; do not transmit secrets.
2. Verify organization identity, project inventory, creation permissions,
   exact region availability, plan, billing status and approval.
3. If and only if inventory confirms no suitable dedicated OCI project, obtain
   approval for its actual cost and create the dedicated project.
4. Bind and independently verify OCI Auth and database project references;
   verify no customer project values are reused.
5. Rehearse migration 022 on an isolated disposable project, then separately
   authorize any production application. Verify schema, RLS/grants, TLS,
   backups, recovery, and negative access tests.
6. Have the founder complete verified email and TOTP MFA, then run the
   operator-only OCI bootstrap only after database acceptance.

**No project, migration, identity, role, deployment, or billable resource was
created or changed in this task.**
