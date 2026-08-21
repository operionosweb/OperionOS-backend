# Phase 3A Database Verification Contract

The live harness is intentionally opt-in and is not part of `npm.cmd test`.

Run it explicitly with:

```powershell
node test/phase3a-live-verification.js
```

Required environment variables:

```text
PHASE3_DB_TEST_ENABLED=1
PHASE3_DB_ENV=non-production-test
PHASE3_SUPABASE_PROJECT_REF=<non-production-project-ref>
DATABASE_URL=<dedicated-test-postgres-url>
SUPABASE_URL=https://<same-project-ref>.supabase.co
SUPABASE_ANON_KEY=<test-project-anon-key>
SUPABASE_TEST_SERVICE_ROLE_KEY=<test-project-service-role-key>
```

To let the harness apply the canonical migrations to an explicitly empty test database, also set:

```text
PHASE3_APPLY_MIGRATIONS=1
PHASE3_EMPTY_DATABASE=1
```

The harness refuses to run when:

- `PHASE3_DB_TEST_ENABLED` is not `1`;
- the environment label is not `non-production-test`;
- the Supabase URL project ref does not equal `PHASE3_SUPABASE_PROJECT_REF`;
- the project ref or environment label contains `prod` or `production`;
- required credentials are missing;
- migration application is requested without `PHASE3_EMPTY_DATABASE=1`.

The service-role key must be created specifically for the dedicated non-production project. The harness never prints credentials or tokens. It generates temporary users and synthetic organizations with a unique run prefix, and cleanup targets only those generated IDs.

The harness verifies:

- migration application and schema objects;
- Phase 2 compatibility;
- composite organization foreign keys;
- uniqueness constraints;
- AnalysisRun status constraints and transitions;
- immutable evidence and intelligence results;
- organization-scoped authenticated reads;
- cross-tenant relationship rejection;
- RLS policies and triggers;
- optional validation of the `NOT VALID` compatibility foreign keys.

`PHASE3_VALIDATE_EXISTING_FKS=1` additionally runs `VALIDATE CONSTRAINT` for the four compatibility foreign keys. This should be enabled only after reviewing existing test-database data.

Live verification remains separate from local unit tests. Do not point this harness at production or shared customer data.
