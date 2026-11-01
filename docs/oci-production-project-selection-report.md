# OCI Production Supabase Project Selection Report

**Inspection:** 2026-11-01, approximately 11:44 CET (Europe/Madrid)\
**Organization:** `operionosweb@gmail.com's Org`\
**Decision:** **READY FOR FOUNDER APPROVAL**, subject to confirming the current dashboard quote and region capacity before any billable action.

## Verified organization inventory

The authenticated organization project list displayed exactly two projects.
Both existing project cards showed `eu-west-1` (West EU / Ireland) and Nano
compute.

| Project | Reference | Visible state | OCI suitability |
|---|---|---|---|
| `Operion OS's Project` | `cvwalskmgniwtmqqbdvj` | Overview showed `Checking...`; no migrations/backups were shown | **Not established** |
| `operion-phase3b-test` | `amlpybvkzoegnxwuodyn` | Overview showed Healthy; no migrations/backups were shown | **Not established; do not reuse** |

No project is explicitly named or verifiably dedicated to OCI. The project
names and dashboard visibility do not prove whether either is customer-facing
production, staging, or a suitable isolated target. Neither project was
modified, connected to, or selected for OCI.

### `operion-phase3b-test` safe metadata

The read-only project overview showed Healthy, Nano compute, West EU
(`eu-west-1`), no connected GitHub repository, no recent branches, no
migrations, and no backups. At the inspection time its dashboard displayed
37 requests in the preceding 60 minutes (100% success), including API
Gateway, Storage, and Realtime activity; Postgres showed no activity in that
window. These observations indicate a live, non-empty service footprint, not
its business purpose. The dashboard metadata does not identify application
callers, credentials in use, or upstream/downstream integrations. No
connection details, database contents, or secrets were inspected.

Preserve this project and the other existing project. Do not repurpose,
pause, delete, or change either to make room for OCI.

## Recommended dedicated target

| Setting | Recommendation | Evidence / qualification |
|---|---|---|
| Organization | `operionosweb@gmail.com's Org` | Authenticated account is listed as its sole Owner. Founder must confirm this is the intended management account. |
| Project name | `operion-oci-production` | Exact requested name; not created. |
| Region | **Central EU (Frankfurt), `eu-central-1`** | Exact specific region is in Supabase's published available-region list and is within Germany/EU. The current creation flow was blocked before showing region selection, so live account capacity is not verified. |
| Plan | **Pro**, organization-level | Current Free plan limit is two active free projects; the dashboard disables creation. Pro is the least-cost paid plan needed to proceed without changing existing projects. |
| Compute | **Small, shared CPU, 2 GB RAM, approximately $15/month** | Recommended starting tier with a documented 50 GB recommended DB size. Isolated Postgres is provided per project; dedicated vCPU is not needed absent workload evidence. |
| Backups | Daily backups (7 days) included on Pro; add **7-day PITR, approximately $100/month** | Recommended for a lower-than-daily recovery point objective. PITR is optional, hourly billed, per project, and not covered by spend cap. |
| Isolation | Separate Supabase project, PostgreSQL, Auth, credentials, backups and OCI-only environment | Required by the OCI architecture; no shared customer project credentials or database. |

## Spend and usage estimate

The Billing page showed the organization on the **Free** plan with spend cap
enabled. The new-project page stated that the account had reached its limit of
**2 active free projects** and disabled **Create new project**. It offered
**Upgrade to Pro**. No upgrade, payment, project creation, or checkout quote
was initiated.

Current [Supabase pricing](https://supabase.com/pricing) and
[compute/disk pricing](https://supabase.com/docs/guides/platform/compute-and-disk)
were checked on 2026-11-01. The dashboard shows that both existing projects
are Nano. Supabase documents that Nano instances in paid organizations are
billed at the Micro rate (approximately **$10/month each**), and Pro includes
one **$10/month compute credit** per organization. The estimate therefore
includes $20/month for the two existing projects, less the $10 compute
credit, plus the $25 Pro subscription and new OCI-project compute.

| Scenario | OCI compute and backup | Monthly total for Pro org + all 3 projects | Annualized |
|---|---|---:|---:|
| A. Minimum viable | Micro, shared CPU, 1 GB RAM ($10); Pro daily backups only, 7-day retention | **$45** | **$540** |
| B. Recommended | Small, shared CPU, 2 GB RAM ($15); Pro daily backups plus 7-day PITR ($100) | **$150** | **$1,800** |
| C. Higher capacity | Large, dedicated 2 vCPU/8 GB RAM ($110); Pro daily backups plus 7-day PITR ($100) | **$245** | **$2,940** |

Calculation: $25 Pro + $10 each for the two existing Nano projects + OCI
compute − $10 organization compute credit + optional PITR. Annualized cost is
the monthly list-price estimate multiplied by 12; it is not an annual
commitment. Compute and PITR are billed hourly. These scenarios assume no
tax, no overages, and use of standard general-purpose database disk.

Pro includes 8 GB database disk per project; additional database disk is
$0.125/GB-month. The compute table gives recommended database sizes of 10 GB
for Micro, 50 GB for Small and 200 GB for Large. If each were filled to its
recommended size, the database disk component above the included 8 GB would
be approximately $0.25/month, $5.25/month, and $24/month, respectively.
These are capacity examples, not initial database-size assumptions.
General-purpose disk includes 3,000 IOPS and 125 MB/s throughput; additional
provisioned IOPS are $0.024/IOPS and throughput $0.095/MB/s.

Pro includes 250 GB egress (then $0.09/GB), 250 GB cached egress (then
$0.03/GB), 100 GB Supabase file storage (then $0.0213/GB), and 100,000 Auth
MAUs (then $0.00325/MAU). Total Auth users are unlimited. Basic MFA, including
the TOTP factor planned for OCI, is included. Phone-based advanced MFA is
$75/month for the first project and $10/month for each additional project;
it is not assumed. SAML SSO is 50 MAUs included, then $0.015/MAU, and is not
assumed. Standard Auth and unused Supabase products have no separate base
charge under the plan.

Pro automatically provides daily database backups with 7-day retention.
PITR adds approximately $100/month for 7-day retention, $200/month for 14
days, or $400/month for 28 days, per enabled project; it is billed hourly and
is not covered by spend cap. Database backups do not include objects stored
through Supabase Storage. Any such objects need their own backup/export plan.

**These are current published list-price estimates, not the organization's
checkout quote.** Existing project usage, regional capacity, tax, proration,
disk sizing, add-ons and billing-cycle details must be confirmed in the
dashboard before approval is executed. Do not treat spend cap as protecting
against PITR charges.

## European region comparison

Supabase's [specific-region documentation](https://supabase.com/docs/guides/platform/regions)
lists these European AWS regions:

| Region | Code | Jurisdiction note |
|---|---|---|
| West EU (Ireland) | `eu-west-1` | Ireland is an EU member state; both current projects are hosted here. |
| West Europe (London) | `eu-west-2` | United Kingdom; outside the EU. |
| West EU (Paris) | `eu-west-3` | France, EU member state. |
| Central EU (Frankfurt) | `eu-central-1` | Germany, EU member state; recommended specific region for central European reach. |
| Central Europe (Zurich) | `eu-central-2` | Switzerland; outside the EU, with a separate legal/data-transfer analysis. |
| North EU (Stockholm) | `eu-north-1` | Sweden, EU member state. |

Choose the **specific Frankfurt region**, not the generic “Europe” grouping,
to keep the selected primary-region database, Auth and Storage within an
identified EU member state while offering a central location for pan-European
users. Region selection alone does not establish GDPR compliance; backups,
logs, external integrations, subprocessors, exports and Edge Function
execution also require review. The public docs list Frankfurt as a supported
specific region. The dashboard creation flow did not reach its region picker
because the free-project limit blocked it, so account-specific capacity must
be confirmed at provisioning.

## Approval required

The founder should approve all of the following together:

1. The management account and organization are the intended Operion owner.
2. Upgrade the organization to **Pro ($25/month)**, understanding existing
   Nano projects re-rate to Micro ($10/month each), the included $10 compute
   credit, and the expected **$150/month** recommended scenario including
   7-day PITR (annualized **$1,800**), before taxes and usage charges.
3. Create `operion-oci-production` in **Frankfurt, `eu-central-1`**, with
   **Small shared compute (2 GB RAM, approximately $15/month)**.
4. Enable Pro's daily backups (7-day retention) and approve **7-day PITR
   (~$100/month)** as a separately billed production recovery control.
5. Use only the new project reference for OCI Auth, PostgreSQL, migration,
   backend and backup configuration. Keep privileged database credentials
   and service-role keys out of frontend variables.

The current free-project quota cannot be cleared by deleting or pausing an
existing project without separate explicit authorization. Do not use the
customer-facing or test project as an OCI substitute. The `operion-phase3b-test`
dashboard currently shows recent request activity and its purpose/dependencies
are not fully disclosed by available metadata. Both existing projects must
remain untouched. The new project was not created, and no billing controls
were changed.

## Next provisioning action

After the founder approves the plan, region, compute, backup add-on and exact
displayed spend, an authorized operator can perform a separate controlled
provisioning step. Confirm the region in the live creation flow before
charging; if unavailable, stop and request a new explicit region approval.
Record the new non-secret project reference and independently verify project
ownership/isolation before configuring credentials or applying migration
022. The founder identity `meelis@operionos.com` must be separately verified
and enrolled in required MFA in the new project's Auth; the dashboard Owner
account is not evidence of that application identity.
