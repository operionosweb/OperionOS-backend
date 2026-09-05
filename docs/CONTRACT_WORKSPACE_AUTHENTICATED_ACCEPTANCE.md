# Contract Workspace Authenticated Acceptance

The Playwright harness validates the production-built Contract Workspace through real Supabase authentication and real tenant-scoped backend APIs. It creates disposable users, organizations, contracts, analysis runs, and aircraft records in an explicitly enabled non-production target, then removes them in global teardown.

## Safety requirements

Copy `.env.phase3-test.example` to `.env.phase3-test.local` and supply a dedicated non-production Supabase target. Keep that local file uncommitted. The existing Phase 3 safety values remain mandatory:

```text
PHASE3_DB_TEST_ENABLED=1
PHASE3_DB_ENV=non-production-test
SUPABASE_URL=<non-production URL>
SUPABASE_ANON_KEY=<non-production anon key>
SUPABASE_TEST_SERVICE_ROLE_KEY=<non-production service-role key>
DATABASE_URL=<non-production PostgreSQL URL>
```

The acceptance suite also requires an explicit per-run opt-in:

```text
CONTRACT_ACCEPTANCE_ENABLED=1
```

Optional local overrides:

```text
CONTRACT_ACCEPTANCE_API_URL=http://127.0.0.1:10001
CONTRACT_ACCEPTANCE_WEB_URL=http://127.0.0.1:4174
```

No user credentials are configured. The harness creates random, confirmed test users through the Supabase admin API and stores their short-lived credentials only under ignored `.acceptance-temp/` until teardown.

## Run

```powershell
cd frontend
npm.cmd run test:acceptance:install
$env:CONTRACT_ACCEPTANCE_ENABLED="1"
npm.cmd run test:acceptance
```

The runner builds the frontend with the test Supabase and API URLs, starts the backend and Vite preview, executes Chromium tests at desktop and 390px mobile widths, and stops both servers. Traces, screenshots, video, and request diagnostics are retained only for failures under ignored test output directories.

The suite fails closed when required configuration is absent or the target appears production-like. It does not alter production authentication, RLS, middleware, or application behavior.