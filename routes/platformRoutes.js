import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { resolvePlatformAuthorization } from "../middleware/superAdminMiddleware.js";
import { resolveUserIntelligenceContext } from "../services/phase3/intelligence/roleIntelligenceService.js";

const router = express.Router();

router.get("/context", authenticateUser, async (req, res) => {
  try {
    const authorization = await resolvePlatformAuthorization(req.user.id);
    const intelligenceContext = resolveUserIntelligenceContext({
      userId: req.user.id,
      platformRoles: authorization.roles,
      permissions: authorization.permissions,
      rbiProfileId: req.user.rbiProfileId,
    });
    return res.json({ success: true, ...authorization, intelligenceContext });
  } catch {
    return res.status(503).json({
      success: false,
      error: "Platform authorization unavailable",
    });
  }
});

export default router;