# Production diagnostics

`GET /api/platform-admin/production-diagnostics` requires a verified
Supabase bearer session, an active platform `SUPERADMIN` role and an AAL2
claim. Its response is private and not cacheable. It returns application
version, Render commit when available, a bounded environment label, and
sanitized database identity and TLS metadata. It never returns connection
strings, credentials, user records or certificate contents.

The database project reference is returned only when the actual client host
and, for a pooler, username match recognized Supabase formats. The hostname
is represented by a truncated SHA-256 fingerprint. A successful current
request proves only that its token was authenticated; it is not a general
Auth health check. Blog and OCI table-presence statuses are not service,
permission, tenant-isolation or persistence acceptance. Schema checks are
not run over an unverified connection. A missing or unreadable migration
ledger is not evidence that migrations were never applied.
Authorization itself looks up the active role in the main database. If that
lookup fails, the request returns 503 before the diagnostic runs; use an
authorized operator-side check to diagnose that failure.

The main PostgreSQL pool requires chain and hostname verification. Its
`DATABASE_URL` may omit SSL options or contain `sslmode=verify-full`;
other SSL URL options and connection identity overrides are rejected rather
than allowed to replace verification. Set `DATABASE_CA` securely to an
approved PEM CA bundle if the provider requires a trust anchor outside the
Node system trust store. Never commit CA private keys or database credentials.
This intentionally rejects previously accepted insecure configuration.
Verify the actual deployed host, trust chain and rollback plan before
deploying: a rejected URL or untrusted certificate can prevent the service
from starting or serving database requests.
