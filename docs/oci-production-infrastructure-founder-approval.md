# Operion OCI Production Supabase Infrastructure — Founder Approval

**Decision document prepared:** 2026-11-01\
**Approval status:** **READY FOR FOUNDER APPROVAL**\
**No approval action has been executed.** No plan change, project, billing
setting, database, credential, migration, deployment, or DNS record was
created or changed.

## Decision requested

Approve a Supabase organization upgrade from Free to Pro and a new, isolated
OCI production project with the configuration and estimated recurring spend
below. This approval is for a future, controlled provisioning task only; it
does not authorize an operator to execute the upgrade, create the project,
apply migrations, or deploy as part of this decision-preparation task.

## Exact recommended configuration

| Item | Proposed choice |
|---|---|
| Supabase organization | `operionosweb@gmail.com's Org` |
| Management owner | `operionosweb@gmail.com` (verified as the sole organization Owner) |
| Organization plan | **Pro**, **$25/month** subscription |
| New project name | **`operion-oci-production`** |
| Region | **Central EU (Frankfurt), `eu-central-1`**, specific AWS region |
| PostgreSQL compute | **Small**, shared CPU, 2 GB RAM, approximately **$15/month** |
| Database disk | Standard general-purpose disk; 8 GB included, assume initial database remains within included 8 GB |
| Supabase Auth | Independent Auth instance in this project; basic/TOTP MFA |
| Backups | Pro daily database backups, 7-day retention, plus **7-day PITR** at approximately **$100/month** |
| Security configuration | Independent project credentials; OCI-only schema, RLS and audit from migration 022; TLS certificate/hostname verification required |
| Public registration | Disable when configuring Auth; verify before inviting the founder |

Each Supabase project has its own Postgres instance. The dedicated project also
provides separate Auth and Storage services in its selected primary region.
No customer-project Auth, database, credential, or role is to be reused.
Keep database passwords, migration credentials, and service-role keys
server-side only; frontend configuration may contain only the intended public
OCI Auth key.

## Region decision

The official [Supabase specific-region list](https://supabase.com/docs/guides/platform/regions)
currently includes these European AWS regions:

| City/region | Code | EU membership / residency consideration |
|---|---|---|
| Ireland | `eu-west-1` | EU member state |
| London | `eu-west-2` | United Kingdom; outside the EU |
| Paris | `eu-west-3` | EU member state |
| Frankfurt | `eu-central-1` | Germany; EU member state |
| Zurich | `eu-central-2` | Switzerland; outside the EU, with separate legal/data-transfer analysis |
| Stockholm | `eu-north-1` | Sweden; EU member state |

**Recommendation: specific Frankfurt (`eu-central-1`).** It is an officially
listed exact region, lies in an EU member state, and is geographically central
for a pan-European service. Choose the specific region, not Supabase's
general “Europe” grouping, because the general grouping may place a project
outside the EU. Supabase states that the selected primary region hosts the
project's primary Postgres database, Auth and Storage. Region selection alone
does not establish GDPR compliance; logs, backups, exports, Edge Functions,
subprocessors and external services need separate review.

The dashboard's new-project form was blocked by the current Free-plan quota
before the region selector appeared. Frankfurt is confirmed as a currently
documented supported region, but account-specific capacity at the moment of
creation is not established. Confirm the exact region remains selectable
before committing spend; if it is unavailable, stop and obtain approval for
another specific EU region. Do not silently substitute one.

## Existing-project protection and metadata

The account has two existing projects and has reached the Free plan's
two-active-project limit. The dashboard displayed:

- `operion-phase3b-test`, project reference `amlpybvkzoegnxwuodyn`: Healthy,
  Nano compute, `eu-west-1`; no connected GitHub repository, no recent
  branches, no migrations, and no backups. At the read-only inspection it
  showed 37 requests over the previous 60 minutes with 100% success, including
  API Gateway, Storage and Realtime activity. Postgres showed no activity in
  that interval.
- `Operion OS's Project`, project reference `cvwalskmgniwtmqqbdvj`: listed in
  the same organization at Nano compute and `eu-west-1`.

The available dashboard metadata does not establish the business purpose,
application callers, credentials in use, or full dependencies of
`operion-phase3b-test`; the name alone is not proof that it is disposable.
No project contents, secrets, database, settings, or integrations were
modified or inspected beyond visible dashboard metadata.

**Preservation requirement:** do not modify, delete, pause, or repurpose either
existing project. In particular, do not use `operion-phase3b-test` as the OCI
production project. Upgrade to Pro rather than freeing the project slot by
changing existing infrastructure.

## Current official pricing and monthly scenarios

Pricing was checked on 2026-11-01 against the official
[Supabase pricing page](https://supabase.com/pricing),
[compute and disk documentation](https://supabase.com/docs/guides/platform/compute-and-disk),
[backup documentation](https://supabase.com/docs/guides/platform/backups), and
[PITR usage pricing](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery).
Prices below are USD list-price estimates, before tax, currency conversion,
proration and usage overages.

Pro is an **organization subscription at $25/month**, not a price that buys
unlimited compute. It provides **$10/month in compute credits**, which cover
one Micro instance. Supabase documents that Nano instances remaining in a
paid organization are billed at the Micro rate (approximately $10/month
each). The two visible existing projects are Nano, so the estimate includes
$20/month for them after upgrade, less one $10 organization compute credit.
The estimated organization bill immediately after upgrade, before adding OCI,
is therefore **$35/month** (`$25 + $10 + $10 - $10`), subject to dashboard
billing/proration confirmation.

| Scenario | OCI project compute | OCI PITR | Pro + 2 existing Nano projects + OCI | Annualized |
|---|---:|---:|---:|---:|
| **A. Minimum viable production** | Micro, shared CPU, 1 GB RAM: $10/month | Not enabled; Pro daily backups only | **$45/month** | **$540/year** |
| **B. Recommended production** | Small, shared CPU, 2 GB RAM: $15/month | 7-day PITR: about $100/month | **$150/month** | **$1,800/year** |
| **C. Higher capacity** | Large, dedicated 2 vCPU, 8 GB RAM: $110/month | 7-day PITR: about $100/month | **$245/month** | **$2,940/year** |

Calculation for each: `$25 Pro + $10 existing project 1 + $10 existing project
2 + OCI compute - $10 compute credits + OCI PITR (if enabled)`. Annualized
cost is the monthly estimate multiplied by 12, not an annual commitment.
Compute and PITR are billed hourly; actual first-cycle charges can vary.
PITR is not covered by Supabase's spend cap.

### Included allowances and variable charges

The scenario totals assume usage stays inside the following published Pro
allowances:

| Resource | Included on Pro | Published overage price |
|---|---:|---:|
| PostgreSQL disk | 8 GB per project | $0.125 per GB |
| General-purpose disk IOPS | 3,000 | $0.024 per additional IOPS |
| General-purpose disk throughput | 125 MB/s | $0.095 per additional MB/s |
| Egress | 250 GB | $0.09/GB |
| Cached egress | 250 GB | $0.03/GB |
| Supabase file storage | 100 GB | $0.0213/GB |
| Auth monthly active users | 100,000 | $0.00325 per MAU |
| Basic MFA (including TOTP) | Included | No separate TOTP add-on assumed |
| Auth SAML SSO | 50 MAUs | $0.015 per additional MAU |
| Phone-based advanced MFA | Not included | $75/month first project; $10/month each additional project |

The compute documentation gives recommended database sizes of 10 GB for
Micro, 50 GB for Small and 200 GB for Large. The 8 GB Pro disk allowance still
applies: if those recommended sizes were fully used, the disk overage would
be approximately **$0.25/month** (Micro), **$5.25/month** (Small), or
**$24/month** (Large). These are capacity examples, not predicted initial
usage. The application has not been load-tested against this new project.
Unused Supabase products do not add a separate product charge; use of
Storage, Realtime, Functions and other services may still affect usage or
compute.

Pro automatically backs up databases daily and retains the last 7 days.
PITR is optional and costs approximately **$100/month per project for 7-day
retention**, **$200/month for 14 days**, or **$400/month for 28 days**. Daily
database backups do not include objects stored through the Storage API.
Scenario B includes 7-day PITR as the recommended recovery control; Scenario
A does not. If the founder declines PITR, Scenario B falls to approximately
**$50/month ($600/year)** before usage, tax and other variable charges.

Basic MFA/TOTP is included; the OCI design does not require phone MFA. Phone
MFA and SAML costs above are not included in the scenarios. Normal
authentication MAU overage, extra disk, egress, storage, IOPS/throughput and
other optional products are variable and not included in the scenario totals.

## Recommended scenario and scaling triggers

**Recommend Scenario B: Small shared compute, 2 GB RAM, plus 7-day PITR**,
with an initial monthly organization total estimated at **$150** and
annualized at **$1,800**, before taxes and usage charges. Small provides more
headroom than the minimum Micro instance without pre-buying dedicated CPU.
Dedicated Postgres isolation is per project and does not require a dedicated
CPU tier. No workload measurement exists, so this is a cost-conscious starting
recommendation rather than a capacity guarantee.

Review usage monthly and consider scaling only after query/index review and
load testing. Suggested review triggers (operational guardrails, not Supabase
pricing thresholds):

- Sustained peak CPU above 70%, memory above 75%, frequent OOM/restarts, or
  connection-pool saturation.
- Database disk reaching 80% of its selected capacity or approaching the
  compute tier's recommended database size.
- p95 query/API latency missing the approved application SLO after query and
  index tuning.
- Egress, MAUs, or file storage reaching 80% of their included allowance.
- A business-approved RPO shorter than daily backups or recovery window
  longer than 7 days; assess PITR retention and test restoration.

Move to Large or larger only with workload evidence supporting dedicated
vCPUs. Any compute change can cause brief downtime. Confirm the revised
monthly total and secure founder approval before enabling higher tiers,
additional PITR retention or paid add-ons.

## Remaining risks and pre-provision checks

1. **Account-specific invoice:** list prices do not include taxes, exchange
   rates, billing-cycle proration, actual usage, credits, or the full post-
   upgrade treatment shown on the account invoice. Review the dashboard's
   projected recurring total before upgrading.
2. **Region capacity:** Frankfurt is on Supabase's public specific-region
   list, but the live creation flow never reached its region picker. Confirm
   selectable availability before any charge; do not substitute another
   region without approval.
3. **Project purpose/dependencies:** dashboard metadata cannot identify all
   `operion-phase3b-test` consumers. Preserve both current projects and their
   settings.
4. **Backups and recovery:** daily backups are included on Pro, but restoration
   must be rehearsed. PITR is a separate, non-spend-cap-protected charge and
   does not back up Storage API file objects.
5. **Data residency/compliance:** specific Frankfurt places primary Postgres,
   Auth and Storage in Germany. Review backup/log/export/processor locations,
   DPA, retention, lawful basis and application controls separately; region
   alone is not compliance certification.
6. **Security:** apply the reviewed OCI-only migration 022 only after a new
   project reference is verified. Enforce database TLS validation, independent
   OCI credentials, disabled public registration, server-side authorization,
   RLS, audit and the explicit founder MFA/bootstrap controls.
7. **Founder identity:** the Supabase dashboard Owner is
   `operionosweb@gmail.com`. The OCI founder application identity
   `meelis@operionos.com` must be separately verified and enrolled in the new
   project's Auth; do not assume these identities are interchangeable.

## Explicit founder approval

Complete/confirm all items before the separate provisioning task:

- [ ] I confirm `operionosweb@gmail.com` and `operionosweb@gmail.com's Org`
      are the intended Supabase management account and organization.
- [ ] I approve upgrading the organization from Free to **Pro at $25/month**,
      understanding the two existing Nano projects are billed at the Micro
      rate after upgrade and the included $10 compute credit.
- [ ] I approve creating a separate project named **`operion-oci-production`**
      in **Frankfurt, `eu-central-1`**, conditional on the dashboard confirming
      current availability.
- [ ] I approve **Small shared compute (2 GB RAM, approximately $15/month)**.
- [ ] I approve **7-day PITR at approximately $100/month**, in addition to
      Pro daily backups retained 7 days.
- [ ] I understand the estimated organization total is **$150/month
      ($1,800/year annualized)** before taxes, proration, and usage-based
      charges; I will review the actual dashboard quote before payment.
- [ ] I direct that neither existing project be changed, paused, deleted, or
      repurposed, and that no migration/deployment occur under this approval.

**Founder:** ____________________________________\
**Date:** _______________________________________\
**Approval / comments:** _________________________

### Execution boundary

This document records a decision request, not the founder's approval. No
Supabase plan upgrade, project creation, payment, migration, role bootstrap,
deployment, DNS update, or existing-project change is authorized or performed
until the founder explicitly approves and a separate controlled execution
step is requested.

## Sources

- [Supabase pricing](https://supabase.com/pricing) — plan, compute credits,
  storage/egress/Auth allowances and usage rates.
- [Compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)
  — instance resources, hourly prices, recommended DB sizes and paid-org Nano
  billing.
- [Available regions](https://supabase.com/docs/guides/platform/regions) —
  supported specific regions and general-region distinction.
- [GDPR and data residency](https://supabase.com/docs/guides/security/gdpr-compliance)
  — region data location and shared-responsibility caveats.
- [Database backups](https://supabase.com/docs/guides/platform/backups) —
  daily backup retention and backup scope.
- [PITR pricing and billing](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery)
  — retention pricing, hourly billing, and spend-cap exclusion.
