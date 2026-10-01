export const ORGANIZATION_ROLES = Object.freeze({
  ORG_ADMIN: "ORG_ADMIN",
  CONTRACT_MANAGER: "CONTRACT_MANAGER",
  ANALYST: "ANALYST",
  VIEWER: "VIEWER",
});

export const ORGANIZATION_PERMISSIONS = Object.freeze({
  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_ADMIN: "organization:write",
  CONTRACT_READ: "contract:read",
  CONTRACT_WRITE: "contract:write",
  CONTRACT_ANALYZE: "contract:analyze",
});

const LEGACY_ROLE_ALIASES = Object.freeze({
  owner: "LEGACY_OWNER",
  admin: ORGANIZATION_ROLES.ORG_ADMIN,
  manager: ORGANIZATION_ROLES.CONTRACT_MANAGER,
  member: ORGANIZATION_ROLES.VIEWER,
});

const ROLE_PERMISSIONS = Object.freeze({
  [ORGANIZATION_ROLES.VIEWER]: new Set([
    ORGANIZATION_PERMISSIONS.ORGANIZATION_READ,
    ORGANIZATION_PERMISSIONS.CONTRACT_READ,
    "audit:read",
  ]),
  [ORGANIZATION_ROLES.ANALYST]: new Set([
    ORGANIZATION_PERMISSIONS.ORGANIZATION_READ,
    ORGANIZATION_PERMISSIONS.CONTRACT_READ,
    ORGANIZATION_PERMISSIONS.CONTRACT_ANALYZE,
    "audit:read",
  ]),
  [ORGANIZATION_ROLES.CONTRACT_MANAGER]: new Set([
    "organization:read",
    "contract:read",
    "contract:write",
    "contract:analyze",
    "audit:read",
  ]),
  [ORGANIZATION_ROLES.ORG_ADMIN]: new Set([
    "organization:read",
    "organization:write",
    "contract:read",
    "contract:write",
    "contract:analyze",
    "audit:read",
  ]),
  LEGACY_OWNER: new Set([
    "organization:read",
    "organization:write",
    "contract:read",
    "contract:write",
    "contract:analyze",
    "audit:read",
    "audit:export",
  ]),
});

export function normalizeOrganizationRole(role) {
  if (typeof role !== "string") return null;
  const normalized = role.trim();
  return LEGACY_ROLE_ALIASES[normalized.toLowerCase()]
    || ORGANIZATION_ROLES[normalized.toUpperCase()]
    || null;
}

export function hasOrganizationPermission(role, permission) {
  return ROLE_PERMISSIONS[normalizeOrganizationRole(role)]?.has(permission) || false;
}

export function getOrganizationPermissions(role) {
  return [...(ROLE_PERMISSIONS[normalizeOrganizationRole(role)] || [])];
}

export function requireOrganizationPermission(permission) {
  return (req, res, next) => {
    if (!req.organization || !req.auth?.organizationRole) {
      return res.status(403).json({
        success: false,
        error: "Organization membership required",
      });
    }

    if (!hasOrganizationPermission(req.auth.organizationRole, permission)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient organization permissions",
      });
    }

    return next();
  };
}
