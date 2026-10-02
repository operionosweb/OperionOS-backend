export const PLATFORM_PERMISSIONS = Object.freeze({
  PLATFORM_ADMIN: "platform:admin",
  COMMERCIAL_INTELLIGENCE_READ: "commercial_intelligence:read",
});

export const ORGANIZATION_PERMISSIONS = Object.freeze({
  ORGANIZATION_ADMIN: "organization:write",
  CONTRACT_READ: "contract:read",
  CONTRACT_WRITE: "contract:write",
  CONTRACT_ANALYZE: "contract:analyze",
});

const ORGANIZATION_ROLE_PERMISSIONS = Object.freeze({
  CUSTOMER_USER: new Set(["organization:read", "contract:read", "audit:read"]),
  CUSTOMER_ADMIN: new Set(["organization:read", "organization:write", "contract:read", "contract:write", "contract:analyze", "audit:read"]),
  VIEWER: new Set(["organization:read", "contract:read", "audit:read"]),
  ANALYST: new Set(["organization:read", "contract:read", "contract:analyze", "audit:read"]),
  CONTRACT_MANAGER: new Set(["organization:read", "contract:read", "contract:write", "contract:analyze", "audit:read"]),
  ORG_ADMIN: new Set(["organization:read", "organization:write", "contract:read", "contract:write", "contract:analyze", "audit:read"]),
});

const LEGACY_ORGANIZATION_ROLES = Object.freeze({
  member: "CUSTOMER_USER",
  manager: "CONTRACT_MANAGER",
  admin: "CUSTOMER_ADMIN",
  owner: "ORG_ADMIN",
});

export function normalizeOrganizationRole(role) {
  if (typeof role !== "string") return null;
  return LEGACY_ORGANIZATION_ROLES[role.toLowerCase()] || role.toUpperCase();
}

export function hasOrganizationPermission(role, permission) {
  return ORGANIZATION_ROLE_PERMISSIONS[normalizeOrganizationRole(role)]?.has(permission) || false;
}