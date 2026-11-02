# Matt browser/server tenant integration remediation

Date: 2 November 2026. Offline fictional-data integration; not deployed RLS or
provider certification.

## Independent review and timing limitation

The independent read-only security reviewer inspected auth, membership,
permission, context, sessions and Demo boundaries and ran 37 focused backend
tests successfully. It reported no confirmed cross-tenant vulnerability.

A separate reviewer HTTP probe showed that revoking membership while an answer
was being generated still allowed the already-authorized request to return
HTTP 200. This was an explicit revocation-timing limitation, not demonstrated
cross-tenant disclosure. This remediation adopts the stricter policy:
**new credentials, SDP and generated answers must not be returned after
authorization has changed during the operation.**

## Correction

[The shared router](../routes/mattLiveRoutes.js) now rechecks authentication,
active membership and required permission after session creation, answer
generation and speech negotiation, before returning their payloads. A changed
user/organization/role is rejected. On failed reauthorization it terminates the
original owner-bound session, not a client-selected replacement. Cleanup
failures are logged with codes; uncertain remote cleanup is not represented as
success.

Demo supplies a non-consuming capability-expiry recheck. Reusing the original
Demo authorization middleware would incorrectly consume its one-use start or
double-count turns. Existing origin/peer/session/strict-body checks still occur
at entry; expiry is checked again after the operation.

[The browser hook](../frontend/src/components/matt/useMattLive.js) additionally
disposes the local connection on 401/403 turn failures. If its authenticated
DELETE is also rejected, cleanup remains explicitly unconfirmed, rather than
silently allowing a new room.

This is request-bound revalidation, **not continuous revocation notification**.
There is no claim of immediate remote RTC termination while an entirely idle
client makes no request. Nor can it undo context already sent under valid
authorization before revocation. Provider-account teardown and continuous
revocation behavior still require approved external evaluation.

## Actual browser-to-server integration test

Added to [the live browser suite](../frontend/tests/matt-live-browser.test.mjs):

- Actual Chromium `fetch` calls cross a loopback Express server with the real
  live/Demo routers and session/answer services.
- Actual user-auth middleware has a fictional injected token verifier;
  actual organization middleware has an injected membership query.
- Two fictional tenants have distinct run IDs and private canaries. For the
  switch attack each user intentionally has both fictional memberships, so a
  foreign-session denial tests ownership rather than merely missing membership.
- The gateway/model and avatar are injected; source reads are fictional
  tenant-filtered fixtures. No production database, Supabase verification, real
  model or avatar endpoint is used.
- The browser's route-forwarding mechanism transports requests to loopback;
  it does not fabricate the tested HTTP status/body.

| Attack/check | Observed result |
|---|---|
| Foreign organization in request body | Ignored as authority; only owning context returned |
| Repeat account question | Own canary only; changing source revision appears on next request |
| Valid organization-header switch with old session | 404 before model invocation |
| Other tenant's session ID | 404 before model invocation |
| Raw own/foreign provider conversation ID as application session ID | 404 before model invocation |
| Guessed foreign analysis-run ID | 404 before model invocation |
| Demo capability with SaaS route | 401 without SaaS authentication |
| SaaS application session/provider ID with Demo route | 404 |
| Demo session ID with SaaS route | 404 |
| SaaS credentials on Demo capability route | 403 |
| Demo selected flight turn | Prepared flight context only; no tenant canaries in model input |
| Expired fictional SaaS token | 401 before model invocation |
| Revoke membership while generation is blocked | 403; canary absent from response; original provider room ended |
| Reconnect after reauthorization | Fresh application session ID; old ID remains 404 |
| Captured error logs | No private canary |

All assertions passed. The existing actual Demo UI-to-server test also passes,
including conversation follow-up and disconnect. Other UI tests cover scope
changes, microphone lifecycle and reconnect transport.

The new switch attack changes native browser request headers, **not an
in-application organization-picker UI**. The app has an organization gate, not
a persistent picker in the inspected Matt surface. No new picker was added.
Do not describe this as a full UI-driven organization-switch acceptance.

## Isolation and persistence limitations

- Repeated queries/source refresh are tested, but not every durable-cache hit,
  distributed job or provider-side retention path.
- The earlier two-tenant fixture suite tests canonical SQL/query predicates;
  this integration uses injected source data, not deployed PostgreSQL/RLS.
- No vector retrieval exists in the inspected Matt path. Vector-database
  isolation remains untested, not passed.
- Public Demo capabilities remain private to a browser/session and fixed
  prepared namespace. No global user conversation is substituted.
- In-process allowances/locks do not establish distributed currency caps.
- Physical/live provider teardown, real Supabase token expiry, production
  observability and idle-session revocation notification remain unverified.

Additional focused HTTP regressions verify revocation during room creation
and speech negotiation withholds private credentials/SDP and closes the
original room. A separate UI assertion verifies a 403 turn destroys the
browser transport without any answer being sent to Echo.

Final focused unit/protocol group: **82/82**. Complete serial browser group:
**41/41**, including the new native-browser integration and revoked-output UI
assertion.

No confirmed cross-tenant disclosure was found:

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| — | — | — | — | None confirmed in the tested offline scope | — |
