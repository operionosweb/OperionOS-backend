import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import {
  downloadDocumentById,
  getDocumentById,
  listDocumentVersions,
} from "../services/documentIngestionService.js";
import { recordAuditEvent } from "../services/foundationAuditService.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

function sendError(error, res) {
  return res.status(error.status || (error.code === "STORAGE_ERROR" ? 503 : 404)).json({
    success: false,
    code: error.code || "STORAGE_ERROR",
    error: error.message || "Document request failed",
  });
}

router.get("/:id", async (req, res) => {
  try {
    const document = await getDocumentById(req.params.id, req.organization.id);
    const { storage_key: _storageKey, ...safeDocument } = document;
    return res.json({ success: true, document: safeDocument });
  } catch (error) {
    return sendError(error, res);
  }
});

router.get("/:id/versions", async (req, res) => {
  try {
    const versions = await listDocumentVersions(req.params.id, req.organization.id);
    return res.json({ success: true, versions });
  } catch (error) {
    return sendError(error, res);
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const document = await downloadDocumentById(req.params.id, req.organization.id);
    await recordAuditEvent({
      organizationId: req.organization.id,
      actorId: req.user.id,
      requestId: req.requestId,
      action: "document.downloaded",
      entityType: "document",
      entityId: req.params.id,
    });
    res.type(document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
    return res.send(document.buffer);
  } catch (error) {
    return sendError(error, res);
  }
});

export default router;
