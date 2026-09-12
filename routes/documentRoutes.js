import express from "express";

import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import {
  downloadDocumentById,
  getDocumentById,
  listDocumentVersions,
  getDocumentStructure,
} from "../services/documentIngestionService.js";
import { recordAuditEvent } from "../services/foundationAuditService.js";
import { sendSafeHttpError } from "../utils/safeHttpError.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

function sendError(error, res) {
  return sendSafeHttpError(res, error, {
    status: 500,
    code: "DOCUMENT_REQUEST_FAILED",
    message: "The document request could not be completed",
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

router.get("/:id/structure", async (req, res) => {
  try {
    return res.json({ success: true, ...(await getDocumentStructure(req.params.id, req.organization.id)) });
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
