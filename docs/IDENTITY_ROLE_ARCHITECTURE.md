# Identity and Role Architecture

## Authority boundaries

Platform roles and organization memberships are separate authorities.

- `platform_user_roles` contains Operion-internal roles. It is not readable by
  authenticated customer sessions. Backend platform guards query it on every
  protected request so grants and revocations take effect immediately.
- `organization_memberships` contains tenant roles. Every customer contract and
  intelligence request remains bound to an active membership and `x-org-id`.

`SUPERADMIN` is the only active platform role in this phase. `OPERION_ADMIN` and
`OPERION_ANALYST` are reserved for future permission mapping and currently grant
no platform permissions.

## Organization roles

- `ORG_ADMIN`: organization administration, contract management, and analysis
- `CONTRACT_MANAGER`: contract management and analysis
- `ANALYST`: contract read and analysis
- `VIEWER`: contract read only

Legacy `owner`, `admin`, `manager`, and `member` memberships remain valid and
map conservatively to the new permission model. Legacy `audit:export` remains
owner-only.

## Internal boundary

`/api/intelligence/*`, `/api/admin/*`, `/api/system/*`, `/api/verification/*`,
and `/api/metrics/*` require current database-backed platform permission.
`/api/intelligence/companies` intentionally returns `501` after authorization;
Commercial Intelligence has not been implemented.

The frontend route `/app/internal/commercial-intelligence` and its navigation
entry require `commercial_intelligence:read`. Backend authorization remains the
security boundary.

## Rollout

Apply `017_platform_identity_foundation.sql` before deploying the backend. Grant
the first `SUPERADMIN` through a controlled service-role or database operation:

```sql
insert into public.platform_user_roles (user_id, role)
values ('<auth-user-uuid>', 'SUPERADMIN')
on conflict (user_id, role) do update set status = 'active', updated_at = now();
```

Revoke access by setting `status = 'revoked'`. Do not add `SUPERADMIN` to
`organization_memberships`.