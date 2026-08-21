import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { getAnalysisRunById } from "../services/documentIngestionService.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

router.get("/:id", async (req, res) => {
  try {
    const analysisRun = await getAnalysisRunById(
      req.params.id,
      req.organization.id
    );
    return res.json({ success: true, analysisRun });
  } catch (error) {
    return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 404)).json({
      success: false,
      code: error.code || "STORAGE_ERROR",
      error: error.message || "Analysis run request failed",
    });
  }
});

export default router;
