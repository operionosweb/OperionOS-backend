import { query } from "../db.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createOrganizationMiddleware(queryFn = query) {
  return async function requireOrganizationMembership(req, res, next) {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: "Authenticated user required",
      });
    }

    const organizationId = req.get("x-org-id");

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "x-org-id header required",
      });
    }

    if (!UUID_PATTERN.test(organizationId)) {
      return res.status(400).json({
        success: false,
        error: "x-org-id must be a valid organization UUID",
      });
    }

    try {
      const result = await queryFn(
        `
        SELECT o.id, o.name, o.slug, om.role
        FROM organizations o
        JOIN organization_memberships om ON om.organization_id = o.id
        WHERE o.id = $1
          AND om.user_id = $2
          AND o.status = 'active'
          AND om.status = 'active'
        LIMIT 1
        `,
        [organizationId, req.user.id]
      );

      if (!result.rows.length) {
        return res.status(403).json({
          success: false,
          error: "Active organization membership required",
        });
      }

      req.organization = result.rows[0];
      req.tenant = {
        org_id: result.rows[0].id,
        request_id: req.requestId,
      };
      req.auth.organizationId = result.rows[0].id;
      req.auth.organizationRole = result.rows[0].role;

      return next();
    } catch {
      return res.status(503).json({
        success: false,
        error: "Organization authorization unavailable",
      });
    }
  };
}

export const requireOrganizationMembership = createOrganizationMiddleware();
