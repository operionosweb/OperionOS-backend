const ROLE_PERMISSIONS = Object.freeze({
  member: new Set(["organization:read", "contract:read", "audit:read"]),
  manager: new Set([
    "organization:read",
    "contract:read",
    "contract:write",
    "audit:read",
  ]),
  admin: new Set([
    "organization:read",
    "organization:write",
    "contract:read",
    "contract:write",
    "audit:read",
  ]),
  owner: new Set([
    "organization:read",
    "organization:write",
    "contract:read",
    "contract:write",
    "audit:read",
    "audit:export",
  ]),
});

export function hasOrganizationPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) || false;
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
