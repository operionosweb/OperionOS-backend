import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { getOrganizationPermissions, requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";

const router = express.Router();

router.get(
  "/context",
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("organization:read"),
  (req, res) => {
    const { claims, ...user } = req.user;
    const intelligenceContext = resolveUserIntelligenceContext({
      userId: req.user.id,
      organizationId: req.organization.id,
      organizationRole: req.auth.organizationRole,
      permissions: getOrganizationPermissions(req.auth.organizationRole),
      rbiProfileId: req.user.rbiProfileId,
    });

    res.json({
      success: true,
      user,
      organization: req.organization,
      intelligenceContext,
      request_id: req.requestId,
    });
  }
);

export default router;
