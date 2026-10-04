import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { listUserOrganizations, requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { getOrganizationPermissions, requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";

const router = express.Router();

router.get("/organizations", authenticateUser, async (req, res) => {
  try {
    const organizations = await listUserOrganizations(req.user.id);
    return res.json({ success: true, organizations });
  } catch {
    return res.status(503).json({
      success: false,
      error: "Organization directory unavailable",
    });
  }
});

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
