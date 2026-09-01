# Step 7.5 Supabase Validation

## Status

Step 7.5D outcome: **environment blocked**. The corrected read-only preflight stopped at `API_DNS_FAILED`; no migrations or fixtures were written during the attempted validation.

The git-ignored `.env.phase3-test.local` currently supplies:

- PostgreSQL host `aws-1-eu-west-1.pooler.supabase.com`, which resolves and accepts TCP connections on port `5432`;
- Supabase project API host `amlpybvkzoegnxwuodyn.supabase.co`, which returns DNS `ENOTFOUND` for both Auth health and REST probes;
- project reference `amlpybvkzoegnxwuodyn`;
- a syntactically valid project-scoped pooler username.

The PostgreSQL preflight reaches the shared pooler, but the pooler returns `(ENOTFOUND) tenant/user postgres.amlpybvkzoegnxwuodyn not found`. This means the shared network endpoint is available but cannot locate the configured project tenant. Combined with the absent project API DNS record, the configured project is inactive, deleted, incorrect, or paired with the wrong pooler region. This is an external Supabase project/configuration blocker, not a local DNS, TCP, or application-code failure.

To unblock live validation, provision or restore a dedicated non-production Supabase project and replace the local test values with one matching set copied from that project's dashboard: project ref, API URL, anon key, service-role key, and direct or session-pooler PostgreSQL URL. Confirm `<project-ref>.supabase.co` resolves before rerunning the preflight. No production configuration should be modified.

Do not point this harness at production. It creates and deletes synthetic users, organisations, contracts, intelligence records, and private storage objects.

## Configuration

Copy `.env.phase3-test.example` to the git-ignored `.env.phase3-test.local` and provide:

- `PHASE3_DB_TEST_ENABLED=1`
- `PHASE3_DB_ENV=non-production-test`
- `PHASE3_SUPABASE_PROJECT_REF=<dedicated-project-ref>`
- `SUPABASE_URL=<dedicated-project-url>`
- `SUPABASE_ANON_KEY=<dedicated-project-anon-key>`
- `SUPABASE_TEST_SERVICE_ROLE_KEY=<dedicated-project-service-role-key>`
- `DATABASE_URL=<direct or session-pooler PostgreSQL URL for that same project>`
- `PHASE3_APPLY_MIGRATIONS=1`
- `PHASE3_EMPTY_DATABASE=1`
- `PHASE3_RUN_INTEGRATION=1`

The harness rejects production-like project markers, mismatched Supabase URLs, and database usernames that do not contain the configured project reference. Secrets must remain only in `.env.phase3-test.local` or an equivalent secure environment.

### Configuration ownership

- Preflight consumes `PHASE3_DB_TEST_ENABLED`, `PHASE3_DB_ENV`, `PHASE3_EMPTY_DATABASE`, `PHASE3_SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `PHASE3_APPLY_MIGRATIONS`.
- Full live validation consumes the same variables and additionally requires `PHASE3_RUN_INTEGRATION=1` before fixture writes.
- Application runtime uses `DATABASE_URL` for PostgreSQL, `SUPABASE_URL` plus `SUPABASE_ANON_KEY` for user authentication, and `SUPABASE_SERVICE_ROLE_KEY` for server-side Supabase operations. It does not consume `SUPABASE_TEST_SERVICE_ROLE_KEY`.
- A direct PostgreSQL URL uses the project database host and normally the `postgres` username. A session pooler uses a `*.pooler.supabase.com` host, port `5432`, and a project-scoped username such as `postgres.<project-ref>`. A transaction pooler normally uses the same project-scoped username and port `6543`. Always copy the exact URL from the active non-production project's dashboard rather than constructing it.

## Commands

Read-only fixture-free preflight:

```powershell
node test/supabase-validation.js --preflight-only
```

Preflight performs no migrations or fixture writes. In order, it verifies the project API hostname and Auth health endpoint, PostgreSQL hostname and TCP port, PostgreSQL authentication/current identity, non-production guards, canonical migration ordering, and whether the database is current or has a safe contiguous migration suffix ready to apply.

Full migration, security, integrity, storage, and performance validation:

```powershell
npm.cmd run test:supabase
```

Normal unit tests remain independent of Supabase:

```powershell
npm.cmd test
```

## Migration Behaviour

Migrations `006` through `014` are checked in filename order. The harness identifies each migration through a schema sentinel and applies only a missing contiguous suffix when `PHASE3_APPLY_MIGRATIONS=1`. A gap followed by a later applied migration is treated as an unsafe partial state and blocks execution.

Migrations `011` through `014` are forward migrations. They are not intended to be reapplied blindly because PostgreSQL constraint and index creation is one-time. Clean database application through the older Phase 3 migration executor now includes migrations `001` through `014` in order.

## Validation Matrix

The full harness creates two synthetic aviation tenants and verifies:

- authenticated own-tenant and cross-tenant RLS for contracts, documents, versions, runs, structure, clauses, obligations, deadlines, risks, evidence, AI budgets, jobs, usage, and cache;
- contract, document, version, clause, and risk ID tampering;
- private PDF and DOCX upload/download, cross-tenant denial, anonymous denial, and path enumeration denial;
- two-version isolation and organisation-scoped cache identities;
- invalid and cross-tenant evidence relationship rejection;
- business-day deadline preservation and conservative financial exposure persistence;
- clause/deadline duplicate rejection and risk concurrency conflict handling;
- transaction rollback after a failed risk-evidence write;
- analysis-run state transitions and terminal-state immutability;
- contract cascade behaviour inside a rolled-back transaction;
- AI budget, usage, job, and cache table persistence and tenant isolation;
- representative contract, version, structure, clause, obligation, deadline, risk, and evidence query timings;
- cleanup of all generated database, Auth, and Storage fixtures.

Successful output uses `LIVE_VALIDATION_PASS` and includes individual checks plus query timings. Guard, connection, migration, schema, or integration failures use `BLOCKED` with a bounded error code and message.

## Known Foundation Gap

Migration `006` defines durable AI Intelligence Budget, job, usage, and cache tables. The production `aiGateway` uses PostgreSQL as its source of truth, atomically reserves budget before provider execution, and transactionally reconciles budget, job, usage, and cache state. Injected in-memory stores remain available only for deterministic unit tests. Live restart durability still requires a reachable non-production database and must not be reported as validated until the live harness succeeds.

## Canonical Migration Path

`supabase/migrations` is the canonical migration directory. `routes/supabase/migrations` is a legacy, unrelated schema history and must not be used for Contract Intelligence deployment.