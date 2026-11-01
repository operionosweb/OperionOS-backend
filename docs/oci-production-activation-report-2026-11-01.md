# OCI activation and Demo navigation release - 2026-11-01

## Publication status

This checked-in report records the validated candidate before publication.
Publication is not claimed until the independent remote checks complete.
The isolated operator copy will record the final SHA and deployment result
after the normal push; that post-publication evidence is not part of the
self-referencing release commit.

- Repository: `operionosweb/OperionOS-backend`.
- Starting and refreshed remote `main`:
  `046929222451f91f68012c5b1c31fc8bc761846c`.
- Release reference: `dd8864653ce8c3a1e634e4a5a3a3d15e21e853df`.
- Candidate worktree: `OperionOS-oci-activation-2026-11-01`, detached from
  verified remote `main`; no dirty worktree was reused.
- Final remote SHA: pending post-publication verification.
- Final verdict: pending publication; OCI infrastructure remains blocked.

## 1. Approved changes

Only these files enter this release:

1. [DemoShell.jsx](../frontend/src/components/layout/DemoShell.jsx): distinct
   folded and expanded workspace headings; no navigation-state changes.
2. [demo-aero.css](../frontend/src/styles/demo-aero.css): folded-only typography
   and heading alignment; no sidebar-width or icon-size changes.
3. [globe-responsive.test.mjs](../frontend/tests/globe-responsive.test.mjs):
   measured five-width regression checks and unchanged mobile drawer coverage.
4. [oci-deployment.md](oci-deployment.md): actual independent project settings,
   provisioning pause, and explicit activation prerequisites.
5. This report.

The existing OCI build configuration, backend, bootstrap, role authority,
geography, increments A-E and prospect portfolio need no speculative code
changes. They remain unchanged. The actual independent Vercel configuration
was created as authorized; this is not a public-project configuration change.

## 2. Demo navigation acceptance

The original collapsed heading was overridden by later readability rules:
the intended zero-size heading became 12px with wrapping. The fix displays
exactly `Workspace` only in folded desktop navigation. Expanded desktop and
mobile retain the original `Contract workspace` text and uppercase styling.

| Viewport | Folded rail | Font | Text lines | Icons | Overflow/collision |
| --- | --- | --- | --- | --- | --- |
| 1024px | 72px | 9px | 1 | 17px | None |
| 1280px | 72px | 9px | 1 | 17px | None |
| 1366px | 72px | 9px | 1 | 17px | None |
| 1440px | 72px | 9px | 1 | 17px | None |
| 1920px | 72px | 9px | 1 | 17px | None |

Browser tests wait for actual fonts and measure the full text range, label
bounds, rail bounds, all navigation icons and page overflow. Full text fits
both axes, no truncation or ellipsis is used, and the heading does not collide
with any icon. A direct browser measurement found text width 54.578125px and
height 13px within its 18px line box. The heading uses existing rail gutters;
the rail itself is not widened.

Expanded width remains 258px. Hover, keyboard focus, pin/unpin and frame margin
checks pass. The 390px touch-emulated mobile drawer keeps the original label
and 17px navigation icons. These are Chromium viewport/touch-emulation tests,
not physical-device testing. A folded-sidebar screenshot was captured in the
browser session.

## 3. Independent Vercel project

Verified through authenticated Vercel management APIs, not inferred from Git:

| Setting | Verified value |
| --- | --- |
| Team | `operion-os`, authenticated member role Owner, Hobby plan |
| Independent OCI project | `operion-oci-production` |
| Project ID | `prj_Dua6l29D0bGHPTJ1Zy0unEJ86b2a` |
| Repository | `operionosweb/OperionOS-backend` |
| Production branch | `main` |
| Project root | `oci` |
| Install | `npm --prefix ../frontend ci` |
| Build | `node ../scripts/build-oci.js` |
| Output | `dist-oci` |
| Node | 24.x |
| Environment variables | None configured |
| Ignored Build Step | `exit 0` - deliberate provisioning pause |
| Preview deployments | Disabled |
| Production/Preview deployment inventory | Empty before publication |
| Automatic project domain | `operion-oci-production.vercel.app` |
| OCI production hostname | Not assigned |

The create API rejected unsupported `nodeVersion` before creating anything.
Creation then succeeded, and a separate supported project-settings update
selected Node 24.x instead of the provider's 26.x default. Settings were
independently reread afterward. No subscription upgrade was performed.

The root selects [oci/vercel.json](../oci/vercel.json). Its build produces OCI
HTML only, rewrites to that entrypoint, and retains private/no-store/noindex
headers. The alternate filename `frontend/vercel.oci.json` is not selected.

Inventory now contains exactly two projects. Public `operion-os` remains:
root `frontend`, branch `main`, install `npm ci`, build `npm run build`,
output `dist`, Node 24.x. No public project setting or domain was changed.

Project reference:
<https://vercel.com/operion-os/operion-oci-production/settings>

## 4. Domain and public production

- `oci.operionos.com`: DNS name does not exist; no Vercel domain assignment.
  OCI HTTPS and authenticated access cannot be verified.
- `https://operionos.com`: HTTP 308, TLS verification successful.
- `https://www.operionos.com`: HTTP 200, TLS verification successful.
- Existing public Vercel release `0469292` was Ready/Production/Current:
  deployment `dpl_BThYXxudEV2rfQKGUBAr3LQA1gmr`.
- A normal `main` push is connected to public Vercel production builds.
  A Ready Preview is never treated as production acceptance.
- No manual deployment or DNS operation was initiated. OCI builds remain
  deliberately paused until infrastructure and identity gates pass.

## 5. Supabase and outstanding approval

Authenticated dashboard inventory shows only the existing two projects:
`Operion OS's Project` and `operion-phase3b-test`, both eu-west-1/Nano.
No `operion-oci-production` project exists in the accessible organization.
Neither existing project was modified, paused, deleted or used as an OCI target.

The new-project page explicitly blocks creation: the owner has reached the
limit of two active Free-plan projects. The Create button is disabled.
Billing still shows Free with spend cap enabled. The subscription panel
displays Pro **from $25.00/month**, with additional compute/usage charges.
This is not a final quotation for the proposed three-project organization,
Frankfurt deployment and Small compute. The earlier approximately $150/month
scenario is not a verified current checkout total and is not authorization.
No upgrade/checkout confirmation or paid project creation was submitted.

The owner must approve the exact itemized final subscription/compute quote,
taxes and usage implications before any paid action. Existing projects must
remain unchanged. Then create the dedicated Frankfurt `eu-central-1` project
and independently verify its reference, region and connection destination.

Evidence pages:

- <https://supabase.com/dashboard/org/wxszllpettzuekdqwjar>
- <https://supabase.com/dashboard/new/wxszllpettzuekdqwjar>
- <https://supabase.com/dashboard/org/wxszllpettzuekdqwjar/billing?panel=subscriptionPlan>

## 6. Backend, database and migration readiness

Render management remains at Sign In. Actual repository, branch, deployed
SHA, automatic-deployment state, environment configuration and runtime logs
are **unverified**. Repository declarations are not substituted for provider
settings.

The existing public backend `/api/health` returned HTTP 200 with verified TLS.
This handler does not query a database. It proves neither release SHA nor
OCI route authorization, persistence or database certificate acceptance.
Protected production API probes were not run; denials can write audit events.

The existing OCI backend has a separate lazy PostgreSQL pool, explicit
dedicated-target enforcement, no customer-database fallback and verified TLS.
Every commercial route requires provider-verified identity, MFA and active
`oci_user_roles` authority. An authenticated operator must inspect Render
before choosing a safe dedicated OCI backend deployment/configuration.
No customer backend setting was changed.

Required backend names: `OCI_ALLOWED_ORIGINS`, `OCI_DATABASE_TARGET`,
`OCI_SUPABASE_PROJECT_REF`, `OCI_SUPABASE_URL`, `OCI_SUPABASE_ANON_KEY`,
`OCI_DATABASE_URL`, and optional approved `OCI_DATABASE_CA`.
Required independent frontend names: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (publishable/anon only), `VITE_API_BASE_URL`.
All must identify the dedicated OCI service/project, never the customer target.
Service-role credentials must never enter browser variables.

The unchanged foundation migration is
[022_oci_foundation.sql](../supabase/migrations/022_oci_foundation.sql).
Its runner-equivalent SHA-256, calculated from decoded UTF-8 SQL, is
`781c5d22b6093c1148626a4652006aebd7ed3422d23ae79fa558bb9764f88504`.
Offline tests verify checksums, advisory locks, rollback, ledger handling,
isolated schema/RLS and denial of protected existing targets. No migration
was executed. Real PostgreSQL rehearsal, persisted RLS enforcement and
production certificate/authenticated query acceptance remain open gates.

## 7. Founder and MFA acceptance

**Not operational or verified.** No dedicated Auth project or founder account
has been established. No user ID, password, MFA session or role was fabricated.

The unchanged guarded bootstrap can provision `meelis@operionos.com` only
after provider-verified confirmed email and MFA. The operator must:

1. Verify dedicated infrastructure; disable signup and restrict redirects.
2. Invite the founder through dedicated Supabase Auth.
3. Have the founder verify email, choose credentials and enroll/verify TOTP.
4. Supply the real short-lived verified MFA session only in a secure operator
   environment; match all bootstrap/Auth/database project references.
5. Run the bootstrap dry-run, then separately approved `--apply`.
6. Verify the atomic `oci_user_roles` grant and audit event. Any existing
   role row closes initial bootstrap; no customer-platform grant occurs.
7. Verify real login/MFA at the OCI hostname, protected modules/API results,
   logout, revocation and unauthorized access denial.

Europe remains the default context, Spain the initial focus, and all existing
commercial areas/Founder Action Centre remain intact. Offline module tests
are not founder production acceptance.

## 8. Test and security results

| Gate | Result |
| --- | --- |
| Five-width folded, mobile and desktop navigation | 7/7 pass |
| OCI backend, authorization, MFA, identity, founder, geography, workflows, migration runner | 69/69 pass |
| OCI/browser responsive and customer recovery privacy suite | 35/35 pass |
| Complete offline backend/customer regression suite | 512/513; one pre-existing failure |
| Public production artifact | Build passes |
| Independent OCI production artifact and output helper | Build passes |
| Migration execution | Not performed |
| Real founder/MFA/API acceptance | Blocked, not claimed |

The initial new heading checks expected untransformed `innerText` for expanded
and mobile headings. They correctly exposed the preserved uppercase styling;
the assertions now inspect original `textContent`. All geometry assertions
already passed, and the complete focused suite passes on rerun.

The sole backend failure is `public route components retain semantic primary
headings`: it searches for a literal H1 in `HomeSections.jsx`, whose H1 is
rendered by `AeroHero`. The failing test and home source exactly match starting
production Git blobs (`e41b7239...` and `c0edc1e5...` respectively).
A focused reproduction still fails on those untouched inputs. This unrelated
assertion was not modified or concealed.

Local builds and browser suites use synthetic configuration/intercepted
transports, not production credentials. The inherited tracked root `.env`
contains browser configuration and a JWT declaring the publishable `anon`
role, not `service_role`; its values were not printed or changed. Declared
JWT role classification is not cryptographic verification. All five release
files and 232 built frontend text assets were scanned before push for private
keys, provider/server credentials, service-role JWTs and credential-bearing
database URLs: zero findings. `git diff --check` passes.

The blocked TLS commit
`e0dfc838d6490b7dfd36abf97487761c3f8f58e2` is not an ancestor of the
candidate (Git ancestry exit 1). Recovery commit
`8720815dcea6811326051166e41ba44d61395011` remains an ancestor.
No TLS, authentication, authorization or recovery code was weakened.
OCI TLS tests pass, including rejection of URL overrides.

## 9. Release procedure and rollback

Review exactly the five listed files, scan changed blobs, run
`git diff --check`, create one commit with the required co-author trailer,
and normally push detached `HEAD` to `refs/heads/main`. Refuse a non-fast-forward
result; never force. Verify GitHub independently, refresh `origin/main`, compare
local HEAD and remote SHA, check TLS exclusion and compare all remote branches.
All other worktree HEADs, tracked diff fingerprints and untracked file hashes
must remain unchanged. Append the actual publication/deployment evidence to
the isolated operator report after those checks.

If rollback is needed, use a reviewed normal revert of this release commit
in another isolated worktree and revalidate; never reset or force-push main.
For hosting preparation, keep OCI builds paused and the hostname unassigned.
Do not remove resources, alter public aliases, roll back databases or change
billing without explicit authorization.

## 10. Exact remaining blockers

1. Approval of the final paid Supabase quote, then dedicated project creation
   and independent Frankfurt/reference verification.
2. Authenticated Render management access and verified backend revision,
   dedicated environment configuration and TLS/database acceptance.
3. Authorized isolated migration rehearsal/application and actual RLS checks.
4. Real dedicated founder invitation, email confirmation, MFA and audited OCI
   role bootstrap.
5. Frontend dedicated configuration, removal of the intentional build pause,
   OCI-only domain/DNS/HTTPS setup and actual authenticated production acceptance.

No billing upgrade, Supabase change, production data mutation, migration,
DNS modification, manual deployment or unrelated feature work was performed.
