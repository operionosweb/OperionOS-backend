# OCI Supabase Management Access Report

**Inspection:** 2026-11-01, approximately 11:37 CET (Europe/Madrid)\
**Shared browser page:** `f2e77d01-132f-4ef5-94de-dbd4478ed961`\
**Verdict:** **SUPABASE MANAGEMENT ACCESS VERIFIED — READY FOR PROJECT CREATION APPROVAL.**

## Executive result

The existing Supabase dashboard session is authenticated. The account menu
identifies `operionosweb@gmail.com`; the organization Team page lists that
account as the sole member and **Owner** of `operionosweb@gmail.com's Org`.
The organization's project inventory and Billing page are accessible.

This verifies management access, but not permission to create a free project
under the current plan. The organization is on **Free**, already has two
projects, and Supabase explicitly reports that the account has reached its
two-active-free-project limit. The project creation form is visible, but
**Create new project is disabled** until an existing free project is removed,
paused, or the organization is upgraded. No existing project should be
removed or paused for this task. No upgrade or project creation is authorized
by this report.

## Evidence captured

The initial state was captured from the required shared page before further
navigation:

| Item | Observation |
|---|---|
| Initial URL/title | `https://supabase.com/dashboard/project/amlpybvkzoegnxwuodyn`; `operion-phase3b-test \| operionosweb@gmail.com's Org \| Supabase` |
| Initial page state | Dashboard content rendered; project reference `amlpybvkzoegnxwuodyn` and organization label visible |
| Signed-in identity | Later confirmed from the account menu as `operionosweb@gmail.com` |
| Organization role | Team page showed that account as **Owner**, **You**, and the sole member (1 member) |
| Organization inventory | Two projects visible: `Operion OS's Project` (`cvwalskmgniwtmqqbdvj`) and `operion-phase3b-test` (`amlpybvkzoegnxwuodyn`) |
| Billing page | Accessible; plan shown as **Free**, spend cap enabled |
| Project creation | New-project form opened read-only; free-project limit warning names the account and limit 2; Create button disabled; Upgrade to Pro link shown |

Both listed projects display the West EU (Ireland) region, `eu-west-1`, and
Nano compute in the organization inventory. The `operion-phase3b-test` project
overview showed Healthy, no migrations, and no backups. The `Operion OS's
Project` overview showed `Checking...`, no migrations, and no backups when
inspected. These observations do not establish which project, if either, is
the customer-facing production project. Neither project was modified or
selected as an OCI target.

The founder identity specified for the OCI application,
`meelis@operionos.com`, is distinct from the currently authenticated dashboard
account. The dashboard evidence does not establish that the founder's address
exists as a Supabase Auth user or has MFA configured in a future OCI project.
The Team page included an MFA column, but no readable MFA state was shown for
the owner.

## Request-level diagnostics

Safe request inspection was limited to method, path, status, and failure
summary; no headers, cookies, tokens, or request bodies were read.

- Reloads of the organization project list and new-project form captured no
  `api.supabase.com` management API responses and no HTTP 401 or 403 responses.
- Dashboard event logs recorded aborted telemetry POSTs to
  `/platform/telemetry/event` and `/platform/telemetry/identify`
  (`net::ERR_ABORTED`). These are telemetry requests, not evidence of failed
  organization-management authorization.
- The browser console also showed generic 400 and 404 resource errors without
  a safe endpoint path or response body. Their requests could not be
  attributed to Supabase management APIs.
- Historical 401/aborted observations were not reproduced in this inspection.
  Their original cause therefore remains unverified; they do not explain the
  current project-creation block, which the UI attributes to the Free-plan
  project limit.

The dashboard pages successfully rendered the organization inventory, Team,
Billing, and project-creation form. No undocumented API was called and no
authentication workaround was attempted.

## VS Code and tool-registry evidence

| Component | Read-only finding |
|---|---|
| VS Code | `1.144.0`, Windows x64 (`10.0.26300`) |
| Installed extensions | 18 listed by `code --list-extensions --show-versions` |
| Supabase extension/MCP | No Supabase-specific extension appeared in the installed list. No Supabase MCP server declaration was found in the inspected user/workspace MCP files or settings. |
| Database extensions | No PostgreSQL/SQL/database management extension appeared in the installed list. Docker and Containers extensions are present; they do not establish Supabase authentication. |
| Kilo | `kilocode.kilo-code@7.8.18` is installed, and `code --status` showed its `kilo.exe serve` process under the VS Code extension host. This proves a process was present, not that Kilo is authenticated to Supabase. |
| Supabase CLI | Not found on `PATH`; not installed or invoked. |
| Tool registry | Searches for VS Code extension inventory, authentication, MCP inventory/status, and Supabase integration capabilities returned no direct inspection or Supabase-management tool. The current tool registry does not expose a Supabase MCP connection. |
| Active workspace | `code --status` reported the open folder as `Operion OS GitHub` (the parent folder), not the authoritative `OperionOS-oci-europe` worktree. No workspace was changed. |

The dashboard browser session and a VS Code extension session are separate
authentication contexts. No Supabase VS Code integration was found to
authenticate or test. Kilo's process is not proof of a Supabase connection.

## Permission matrix

| Capability | Finding |
|---|---|
| Dashboard authentication | **Verified** by account menu and rendered authenticated dashboard pages |
| Organization membership | **Verified** |
| Organization owner | **Verified** on the Team page |
| Project inventory | **Verified**, two projects visible |
| Project-level administration | **Not separately enumerated**; organization Owner role is visible |
| Project creation | **Owner-level form is accessible**, but free-project creation is **blocked by quota**; no paid-plan creation was attempted |
| Billing visibility | **Verified**; Free plan and spend-cap state visible |
| Billing/payment authority | **Owner role verified; no billing change or payment action tested** |
| Supabase Auth founder identity/MFA | **Not verified** for `meelis@operionos.com` |
| Database access or migration rights | **Not tested**; no database connection was made |

## Diagnosis and precise next action

The evidence supports an authenticated organization Owner, not an expired
dashboard session, missing organization membership, or demonstrated
insufficient organization role. The observed provisioning blocker is the
organization's Free-plan quota: two free projects are already active and the
third-project Create button is disabled. Browser telemetry aborts are
unrelated evidence and do not establish a management API authentication
failure.

**Founder action:** confirm that `operionosweb@gmail.com` is the intended
authorized Supabase management account. If it is, approve the proposed OCI
project configuration and the organization-plan spend described in
[`oci-production-project-selection-report.md`](./oci-production-project-selection-report.md).
The Owner can then perform the Pro-plan upgrade through the official
dashboard in a separate, explicitly approved step; do not delete or pause
either existing project. If this account is not the intended manager, the
organization Owner must grant the intended Operion account the required
organization access instead. Do not share credentials or tokens in chat.

Project creation, billing changes, migrations, role bootstrap, and deployment
remain unperformed. The project configuration and spend must be approved
before any billable action.
