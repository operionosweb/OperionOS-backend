import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";

const router = express.Router();

router.get(
  "/context",
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("organization:read"),
  (req, res) => {
    const { claims, ...user } = req.user;

    res.json({
      success: true,
      user,
      organization: req.organization,
      request_id: req.requestId,
    });
  }
);

export default router;
