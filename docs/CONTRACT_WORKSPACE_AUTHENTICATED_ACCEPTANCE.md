# Contract Workspace Authenticated Acceptance

## Current status: acceptance execution disabled

Increment A unconditionally disables authenticated acceptance execution and cleanup.
The shared `safety.mjs` gate refuses before harness builds, application startup,
client construction, fixture operations or cleanup. No environment variable,
command-line flag, URL or opt-in can enable execution.

The retained harness is intended to exercise the production-built Contract Workspace
through local Supabase authentication and tenant-scoped backend APIs. It is not safe
to execute. Positive environment identity, durable exact ownership, safe cleanup and
explicit recovery, and deterministic AI/environment containment must be implemented,
reviewed and separately approved before the gate can be replaced.

Increment A does not verify target identity, provide network isolation, or establish
full-stack acceptance readiness. It does not apply or change canonical migrations.

## Disabled cleanup and incomplete runs

Automatic stale-prefix discovery and deletion have been removed. `cleanupFixtures()`,
state reading, global teardown and direct fixture helpers refuse unconditionally.
Missing, malformed or incomplete ownership state must never be treated as an empty
cleanup request or successful cleanup.

Preserve any existing incomplete-run resources and diagnostic evidence for explicit
future recovery. Do not delete, recreate, overwrite or infer ownership from shared
names or prefixes. No automatic recovery is available. Existing state may contain
credentials; keep it access-controlled and do not upload it or browser artifacts.

## Safety requirements

Do not run this suite against any environment, including either hosted project.
URL validation and opt-in flags do not prove target identity or authorize execution.
Loopback validation cannot identify whether a listener is a tunnel, proxy or unrelated
service. The following configuration describes retained validation rules only; it
cannot bypass the unconditional gate.

The retained environment loader does not read `.env.phase3-test.local` or application
environment files. Its required configuration names are shown below for reference,
not as execution instructions. Never paste keys or connection strings into chat.
Database/API credentials have no defaults.

```text
PHASE3_DB_TEST_ENABLED=1
PHASE3_DB_ENV=non-production-test
SUPABASE_URL=<local API URL on numeric loopback port 54321>
SUPABASE_ANON_KEY=<local anon key>
SUPABASE_TEST_SERVICE_ROLE_KEY=<local service-role key>
DATABASE_URL=<local PostgreSQL URL on numeric loopback port 54322, database postgres>
```

The retained configuration validator requires an explicit per-run opt-in, but it
does not enable execution:

```text
CONTRACT_ACCEPTANCE_ENABLED=1
```

The only supported application endpoints are:

```text
CONTRACT_ACCEPTANCE_API_URL=http://127.0.0.1:10001
CONTRACT_ACCEPTANCE_WEB_URL=http://127.0.0.1:4174
```

All endpoints must use `127.0.0.1` with the specified ports. Supabase and application endpoints must use HTTP, have no credentials, query or non-root path. PostgreSQL query overrides are rejected except `sslmode=disable`; local fixture connections use no TLS. DNS aliases, hosted targets and inherited conflicting frontend/service-role configuration are rejected before client creation. Backend dotenv loading runs in an empty temporary working directory, and frontend build/preview use an empty temporary environment directory, so application environment files cannot silently supply a hosted fallback.

The disabled setup code retains the previous random-user fixture workflow. Existing
credentials under ignored `.acceptance-temp/` are not automatically removed.
Do not upload these files, browser traces, or other credential-bearing artifacts.

## Focused safety test source

`test/acceptance-local-safety.test.js` contains pure gate/configuration assertions,
fake-client refusal checks and read-only source checks. Its previous subprocess and
temporary-file tests have been replaced. It does not start servers, browsers,
databases or application modules, create fixtures, or write files.

The Increment A test source has not been executed during this source-editing stage.
Test execution requires separate approval. No acceptance execution or installation
command is authorized here. The package's browser-install command is a separate
dependency installer, not a guarded acceptance entry point; do not invoke it.

The runner, Playwright configuration, backend/frontend launchers, global setup,
global teardown, direct spec and fixture helpers each invoke the refusal gate.
Production application startup, authentication, RLS and contract-intelligence
behavior are unchanged.

## Local infrastructure gate

### Increment B: offline identity contract, not verified infrastructure

Increment B adds `frontend/tests/acceptance/identity.mjs`,
`frontend/tests/acceptance/identity-observations.mjs` and
`test/acceptance-identity.test.js`. These are not imported by any execution entry
point. Increment A remains unchanged and unconditional, including after a successful
manifest validation or comparison. No live observer, provisioning procedure, marker
installation, application endpoint or acceptance-control SQL artifact is implemented.
Increment B is **not complete**: every infrastructure-dependent proof remains unavailable.

#### Configuration and integration map

- `environment.mjs` validates explicit process configuration; its loader assigns
  acceptance and `VITE_*` URLs. The runner passes the process environment to children.
  Launchers use those validated URLs; the backend launcher maps
  `SUPABASE_TEST_SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY`.
- `db.js` loads dotenv, constructs its pool at module scope and attempts a connection
  when `DATABASE_URL` exists. Importing it to discover identity would itself cross the
  lockout boundary. It is deliberately not imported by the new modules.
- `config/supabase.js` and `config/supabaseAuth.js` load dotenv and lazily create
  service-role and anon clients. `supabaseClient.js` and
  `services/supabaseService.js` create clients at module scope.
- Frontend `src/lib/supabaseClient.js` uses build-time `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`; `src/lib/apiClient.js` uses `VITE_API_BASE_URL`.
  `vite.config.js` does not provide identity metadata. A future approved build
  observer must bind the actual served artifact to these effective values, including
  the anon-key hash without disclosing the key.
- The root route in `index.js` and `routes/healthRoutes.js` health response do not
  attest identity. No production startup, client, route or request behavior is changed.

#### Manifest schema and canonical digest

The strict `operion-acceptance-identity/v1` schema requires:

- Distinct task, environment and database-generation UUIDs; issuance/expiry timestamps.
- Disposable Linux VM ownership, VM, boot, stack, database-volume and storage-volume
  UUIDs. Defined identities must be unique; explicit reference fields must agree.
- Six distinct service identities: PostgreSQL, REST, Auth, Storage, backend and
  frontend; each has a runtime reference, image SHA-256 and exact endpoint.
  Only the existing numeric-loopback port layout is represented by this version.
  REST/Auth/Storage share the gateway origin but have distinct service paths.
  Endpoints are credential-free identity descriptors, not connection strings.
- PostgreSQL system identifier, database OID/name, service reference, exact ordered
  inventory of all 21 canonical migration filenames/versions/content SHA-256 values,
  and a separately observed database schema SHA-256.
- Acceptance-control schema version `1`, marker UUID and matching environment and
  generation references.
- Private bucket ID, storage service/volume references and sentinel object UUID,
  exact safe key and content SHA-256.
- Source revision, deterministic adapter version, frontend build SHA-256 and effective
  frontend API/Supabase configuration, including anon-key SHA-256.

All objects reject unknown fields. UUIDs and hashes are lowercase; hashes are 64
hexadecimal characters, without a prefix. The validator requires an explicit caller
clock, rejects future issuance/expired manifests and limits validity to 24 hours.
Errors contain fixed descriptions/codes, never supplied values or credential data.
Successful parsing validates structure and consistency only.

Canonical bytes are UTF-8 `JSON.stringify` with recursively lexicographically sorted
object keys, preserved array order, no whitespace or trailing newline. This is the
version-1 contract, not a general RFC 8785 implementation. Migration hashes mean
SHA-256 of exact file bytes, including existing line endings; no normalization is
allowed. The canonical manifest SHA-256 covers those entries and all other fields.
No real migration hash or infrastructure identity has been generated or invented.
Any change invalidates the previously pinned manifest digest.

#### Provenance and independent observations

A digest is not a trust anchor. A separately approved provisioning process must
authenticate and pin the manifest digest, VM/boot/stack identities and observation
source allowlist through an out-of-band, access-controlled channel. The caller-supplied
`trustAnchor` is an interface to that future process, **not an implemented verifier**.
Its `provenance: "approved-provisioning"` label and source IDs are assertions, not
signatures or proof. Neither process environment variables nor a database marker can
establish this provenance. An attacker able to supply both context and observations
can fabricate a match; these pure modules must never be treated as an authorization gate.

`compareIdentityObservations(manifest, observations, context)` compares data only.
Context includes explicit `nowMs`, a fresh caller challenge UUID and `trustAnchor`
with the pinned digest, VM/boot/stack identities and all seven `observationSources`.
Each available observation has exactly `status`, `sourceId`, `observedAtMs`,
`validUntilMs`, `challenge`, `manifestSha256`, `taskId`, `environmentId`,
`databaseGenerationId`, `dimension`, `evidenceSha256` and `evidence`.
Missing/unavailable capabilities reject the result. Available evidence must have
exact expected fields and match all declared source/context bindings and digests.
The observation's validity interval must be positive, no longer than five minutes,
contain the explicit caller clock (expiry exclusive), and lie within manifest validity.
The future trusted caller must enforce fresh challenges and a trustworthy clock;
these modules have no replay database or authenticated transport.

The seven comparison dimensions and required independent evidence are:

| Dimension | Required evidence | Actual observation source |
| --- | --- | --- |
| Runtime/listeners | Owner/VM/boot/stack/volumes, each service's listener/image mapping, absence of forwarding | Unavailable; needs isolated-host control-plane inspection, not a claimed HTTP response |
| Database | Cluster/database identity, volume, generation/control marker, migration inventory and actual schema digest | Unavailable; needs independently bound connection plus provisioner volume identity |
| Control | Exact marker, environment/generation and control schema version | Unavailable; a matching marker alone never suffices |
| REST/Auth/Storage | Service/image/runtime/endpoint identities, each service's actual database/control/volume binding, Storage volume | Unavailable; gateway URL or healthy response is insufficient |
| Backend | Service identity, actual database binding, source revision and deterministic adapter version | Unavailable; current routes provide no attestation |
| Frontend | Served build identity/revision and effective API/Supabase/key-hash configuration | Unavailable; source code or requested Vite variables are not served-build proof |
| Private Storage | Exact bucket/private state, volume and sentinel UUID/key/content hash | Unavailable; must observe actual private bucket and read exact sentinel bytes |

`compareIdentityFromAdapter` is a synchronous injected-reader interface, not a live
adapter. It validates the manifest/context first, then calls only the explicitly
supplied function with a detached canonical manifest and challenge/clock/digest plus
task, environment and database-generation identifiers.
There is no default reader; absence yields rejection. Injection may have side effects
and is not authorized for execution in this stage. Adapter errors propagate.
Pure manifest parsing/digesting and direct comparison never invoke adapters.
Even a complete synthetic match returns `executionAllowed: false` and
`infrastructureVerified: false`; it cannot override Increment A.

#### Increment B2: explicit trust-state separation

Implemented pure checks and results are deliberately separate from trust:

| Result field | Meaning in this implementation |
| --- | --- |
| `manifestValid` | `true` only on a returned comparison result after schema, consistency and caller-clock validation. Invalid manifests throw a fixed error; parsing alone still returns a detached manifest, not approval. |
| `evidenceConsistent` | All seven supplied dimensions match the manifest, declared context, exact envelope, content digest and caller-clock validity bounds. These are untrusted-data checks, not proof. |
| `evidenceAuthenticated` | Always `false`: no approved authentication component exists. |
| `evidenceFresh` | Always `false`: interval/challenge comparisons do not establish a trusted clock or one-time attempt consumption. |
| `infrastructureVerified` | Always `false`: all required dimensions would need authenticated, fresh evidence. |
| `executionAllowed` | Always `false`; Increment A also unconditionally throws independently. |

Top-level `status` is now always `rejected`. The former data-only `status: "matched"`
is intentionally moved to `comparisonStatus: "matched"`; callers must not interpret
consistency as verification. Per-dimension results use the same separation, with
fixed authentication/freshness-unavailable codes. Missing/malformed observations,
wrong task/environment/generation/dimension/challenge, expired or excessive validity
intervals, changed content and digest mismatches fail the comparison.
`authenticated: true` is not an accepted observation field. Authentication booleans,
provenance labels or verifier callbacks supplied in caller context cannot elevate any
result; this module neither invokes nor trusts such callbacks.

The evidence content digest is lowercase SHA-256 over UTF-8 canonical JSON of
`{ schema: "operion-acceptance-evidence/v1", dimension, evidence }`, with recursively
sorted object keys, preserved array order, no whitespace and no trailing newline.
The implementation hashes only the expected normalized evidence after exact content
comparison. This detects a digest mismatch, not authenticity. A future authenticated
envelope must bind **all** task/environment/generation, manifest digest, dimension,
evidence digest, observer identity, attempt/challenge and timestamp/expiry fields.
Signing only the content digest would permit context substitution and is insufficient.

#### Future provisioning authority and authenticated-evidence contract (not implemented)

No approved authority, key distribution, signature verifier, authenticated observer,
trusted clock, challenge issuer or durable nonce registry is available in this harness.
The `trustAnchor` name denotes only a declared comparison context, not an established
root of trust. No fake authority, key, signature or authentication-success switch is
implemented. Even perfectly fabricated observations remain unverified.

A separately approved authority must independently establish and bind:

- Task, environment and new database-generation UUIDs.
- Disposable VM owner, VM/boot/stack and actual database/storage volume identity.
- Actual process/image/listener ownership and absence of forwarding.
- PostgreSQL system identifier and database OID/name on the intended runtime/volume.
- Each REST/Auth/Storage service's actual database and storage bindings.
- Canonical migration bytes/history and actual schema/control-version inventory.
- Private bucket state and exact sentinel object/content identity.
- Approved source revision, deterministic adapter version and served frontend build.

These measurements must come from provisioner/control-plane and independently bound
observers, not merely the candidate application or database's own claims. A UUID,
marker, digest, environment variable or matching source revision alone is insufficient.

Before future integration, approve an authenticated envelope format and verifier
owned by a trusted component outside caller-supplied observation data. That component
must verify signatures or mutually authenticated observer credentials against
out-of-band pinned authority roots, enforce observer authorization for each dimension
and exact task/runtime/generation scope, and enforce algorithm/version, credential
validity, rotation and revocation policy. It must recompute the canonical digest and
verify authentication over every bound envelope field before issuing a scoped result.
Raw credentials, private keys or tokens must never be included in these objects or logs.
An injected reader, source allowlist string or caller-created result cannot substitute
for that verification. No authentication-result input is consumed by the current API;
a future integration seam requires separate review rather than a boolean opt-in.

For operational freshness, the trusted component must issue an unpredictable attempt
nonce tied to the pinned manifest and identities, record it durably before observation,
enforce issuance/expiry with a trusted clock and bounded observer skew, then atomically
consume the complete seven-dimension evidence set for that attempt exactly once.
The registry must reject reused/unknown/expired attempts across concurrent callers,
restarts and VM/database-generation changes. Authenticate evidence before consuming
the nonce; define crash/retry handling without accepting a previously consumed set.
No such registry or signature/credential verification runs here. Repeating synthetic
evidence may repeat a comparison match but **never** sets `evidenceFresh` or
`infrastructureVerified`. Replay resistance is specified, not operationally implemented.

#### Deferred database and bootstrap wiring

Future database attestation must distinguish the intended cluster/database from
clones retaining markers or even the cluster system identifier. Independently observed
runtime/boot/volume ownership and a newly provisioned generation are essential; a
marker, source revision, loopback URL or fixed port alone is insufficient.
Migration file digests must be checked against provisioner-pinned bytes **and**
actual database schema state; migration names alone do not attest applied contents.
The schema-digest extraction/canonicalization algorithm and supported platform/image
versions still need approval; no actual schema observation is implemented here.

Raw consumers include `repositories/phase3/clauseRepository.js`,
`obligationRepository.js`, `deadlineRepository.js`, `riskRepository.js`,
`contractProfileRepository.js` and `services/ai/postgresIntelligenceStore.js`.
A future approved integration must cover direct `pool.query()`, every `pool.connect()`
checkout/reconnect and identity checks on the same client around transaction
boundaries, including rollback/error handling. Wrapping exported `query()` alone is
insufficient. Supabase HTTP transactions do not inherit a direct PostgreSQL session.
No speculative pool interception or production behavior change is made in this increment.

The future observer must authenticate the cluster/database tuple and new generation
against the provisioner's independent VM/boot/volume mapping, including when a clone
retains both marker and system identifier. Reusing an old generation on a new volume
must fail rather than adopting or rewriting it. Compare the separately versioned
control schema and complete applied migration history with the pinned inventory and
actual schema digest; a history/schema discrepancy must fail, not trigger repair.
Raw queries and checkouts need a verified acceptance-only connection seam: validate
each new/reconnected physical connection, bind its identity to that same client, and
revalidate at transaction start and before mutation/commit under an approved strategy
that prevents identity changes between check and use. A rejected or lost connection
must abort, never retry mutations against an unverified replacement. HTTP service
connections require their own binding proof; a direct-pool result cannot attest them.
No safe acceptance-only production pool seam has been established, so `db.js` and its
consumers remain untouched. Schema extraction, concurrency/TOCTOU handling and
connection lifecycle enforcement are future design/implementation requirements.

Future acceptance-control schema design needs a versioned environment/generation
record and durable exact ownership/operation receipts. It belongs in a separately
versioned acceptance-only provisioning bootstrap, not canonical migrations,
application startup, setup or teardown. Its SQL, installation and trust anchors
require separate approval. No bootstrap artifact is created here.

#### Offline test source and remaining approval boundary

`test/acceptance-identity.test.js` authors synthetic manifest, canonicalization,
freshness, uniqueness/reference, provenance-interface and seven-dimension comparison
cases. It covers missing observations, marker-only rejection, clone/generation/
migration mismatches, fake-adapter injection, no adapter calls from parsing, and the
still-unconditional Increment A refusal. Fakes do not demonstrate real attestation.
Increment B2 adds explicit unverified-result, caller-authentication-claim rejection,
dimension/context/digest/validity-envelope, missing authentication capability and
repeated-evidence cases. Read-only source checks remain offline; no environment
mutation, subprocess, service contact or infrastructure proof is part of these tests.
The existing Increment A source checks continue to describe entry-point ordering and
environment-variable non-bypass behavior; those files are unchanged.

All new tests, builds, lint/type checks and application execution are **NOT RUN**.
`git diff --check` is **NOT RUN**. No service, database, Auth, Storage, infrastructure,
fixture or migration operation is authorized. Identity proof, durable ownership,
recovery, containment and full-stack readiness remain blocked pending separate work
and review. Preserve incomplete resources and evidence; cleanup remains disabled.

The following is historical infrastructure evidence, not permission to execute the
harness. A future approved stage must verify service health, identity and effective
network isolation. Requested port bindings alone are insufficient.

On the inspected Docker Desktop Engine 29.9.1 installation, a disposable PostgreSQL probe on an `--internal` bridge accepted connections inside the container but had an empty effective published-port mapping. Its requested loopback port was unreachable. Explicit `gateway_mode_ipv4=nat` and `host_binding_ipv4=127.0.0.1` options on a second internal bridge did not change this. The host-side Supabase CLI consequently could not reach PostgreSQL at port 54322. This diagnoses the internal-network/host-access failure, not a canonical migration defect.

A second disposable probe tested a non-internal bridge with `enable_ip_masquerade=false` and loopback-only publishing. Docker Desktop did publish the port and the host connected, but a container on that network successfully fetched an external HTTP resource. The option therefore did not provide the required outbound isolation on this installation and is not an acceptable workaround. Both probes used uniquely named no-volume containers and networks, which were removed afterward; no existing volume was removed.

Do not remove isolation, reset Docker, prune resources, or change daemon-wide settings to bypass this gate. Full-stack acceptance remains blocked until an isolated host-access method is reviewed and verified. A unit-test pass does not clear this gate.

The current verified outcome is that neither tested Docker network option meets both host-connectivity and outbound-isolation requirements. Full-stack acceptance remains blocked. Existing backend startup also does not provide an explicit loopback listen address; its network exposure must be addressed within the isolated test environment before running it.

## Initial pilot manual review

This is a proposed manual operating procedure, not a verified software approval workflow:

1. Assign a named aviation contract reviewer and record the document version and analysis run.
2. Confirm the detected agreement type before using type-specific summaries or recommendations.
3. Check material obligations, monetary terms, risks and recommendations against their cited excerpts and source locations.
4. Record corrections, unresolved dates, assumptions and unsupported answers in an access-controlled review register linked to the analysis run.
5. Obtain reviewer approval before any customer reliance; re-review after a new document version or analysis.

The offline synthetic corpus regression now expects the MRO agreement to be classified as MRO rather than an aircraft lease. This narrow regression does not establish real-contract accuracy, completeness or authenticated infrastructure readiness. Reviewers must not treat agreement classification or measured evidence accuracy on matched synthetic findings as a guarantee of completeness or real-contract quality. Acceptance execution remains unconditionally disabled.