import { query } from "../db.js";

export const PLATFORM_ROLES = Object.freeze({
    SUPERADMIN: "SUPERADMIN",
    OPERION_ADMIN: "OPERION_ADMIN",
    OPERION_ANALYST: "OPERION_ANALYST",
});

export const PLATFORM_PERMISSIONS = Object.freeze({
    PLATFORM_ADMIN: "platform:admin",
    COMMERCIAL_INTELLIGENCE_READ: "commercial_intelligence:read",
    COMMERCIAL_INTELLIGENCE_WRITE: "commercial_intelligence:write",
});

const ROLE_PERMISSIONS = Object.freeze({
    [PLATFORM_ROLES.SUPERADMIN]: new Set(Object.values(PLATFORM_PERMISSIONS)),
});

export function hasPlatformPermission(roles, permission) {
    return roles.some((role) => ROLE_PERMISSIONS[role]?.has(permission));
}

export async function resolvePlatformAuthorization(userId, queryFn = query) {
    const result = await queryFn(
        `
            SELECT role
            FROM platform_user_roles
            WHERE user_id = $1
                AND status = 'active'
        `,
        [userId]
    );
    const roles = result.rows.map(({ role }) => role);
    const permissions = [...new Set(roles.flatMap((role) => [
        ...(ROLE_PERMISSIONS[role] || []),
    ]))];
    return { roles, permissions };
}

export function createPlatformPermissionMiddleware(permission, queryFn = query) {
    return async function requirePlatformPermission(req, res, next) {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                error: "Authenticated user required",
            });
        }

        try {
            const authorization = await resolvePlatformAuthorization(req.user.id, queryFn);
            if (!hasPlatformPermission(authorization.roles, permission)) {
                return res.status(403).json({
                    success: false,
                    error: "Insufficient platform permissions",
                });
            }
            req.auth = { ...(req.auth || {}), ...authorization };
            return next();
        } catch {
            return res.status(503).json({
                success: false,
                error: "Platform authorization unavailable",
            });
        }
    };
}

export const requirePlatformPermission = (permission) =>
    createPlatformPermissionMiddleware(permission);

export const requireSuperAdmin = requirePlatformPermission(
    PLATFORM_PERMISSIONS.PLATFORM_ADMIN
);
