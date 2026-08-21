import express from "express";
import multer from "multer";

import {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract,
} from "../services/contractService.js";
import {
  ingestContractUpload,
  listDocumentsForContract,
} from "../services/documentIngestionService.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function receiveUpload(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        code: "FILE_TOO_LARGE",
        error: "The uploaded file exceeds the 20MB limit",
      });
    }

    return res.status(400).json({
      success: false,
      code: "INVALID_FILE",
      error: "The uploaded file could not be received",
    });
  });
}

function sendIngestionError(error, res) {
  const status = error.status || (error.code === "STORAGE_ERROR" ? 503 : 400);
  return res.status(status).json({
    success: false,
    code: error.code || "STORAGE_ERROR",
    error: error.message || "Document request failed",
  });
}

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "contract-routes",
    status: "operational",
  });
});

router.use(authenticateUser, requireOrganizationMembership);

router.post(
  "/upload",
  requireOrganizationPermission("contract:write"),
  receiveUpload,
  async (req, res) => {
    try {
      const result = await ingestContractUpload({
        file: req.file,
        organizationId: req.organization.id,
        userId: req.user.id,
        requestId: req.requestId,
        title: req.body.title,
        contractId: req.body.contract_id || null,
        documentId: req.body.document_id || null,
      });

      return res.status(201).json(result);
    } catch (error) {
      return sendIngestionError(error, res);
    }
  }
);

// Legacy JSON contract path remains protected but is not used by Phase 2 upload.
router.post(
  "/",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    try {
      const result = await createContract({
        ...req.body,
        organizationId: req.organization.id,
        userId: req.user.id,
      });
      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Contract creation failed",
      });
    }
  }
);

router.get(
  "/",
  requireOrganizationPermission("contract:read"),
  async (req, res) => {
    try {
      return res.status(200).json(await getAllContracts(req.organization.id));
    } catch {
      return res.status(503).json({
        success: false,
        code: "STORAGE_ERROR",
        error: "Contract lookup failed",
      });
    }
  }
);

router.get(
  "/:id/documents",
  requireOrganizationPermission("contract:read"),
  async (req, res) => {
    try {
      const documents = await listDocumentsForContract(
        req.params.id,
        req.organization.id
      );
      return res.json({ success: true, documents });
    } catch (error) {
      return sendIngestionError(error, res);
    }
  }
);

router.get(
  "/:id",
  requireOrganizationPermission("contract:read"),
  async (req, res) => {
    const result = await getContractById(req.params.id, req.organization.id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  }
);

router.put(
  "/:id",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    const result = await updateContract(
      req.params.id,
      req.body,
      req.organization.id
    );
    return res.status(result.success ? 200 : 404).json(result);
  }
);

router.delete(
  "/:id",
  requireOrganizationPermission("contract:write"),
  async (req, res) => {
    const result = await deleteContract(req.params.id, req.organization.id);
    return res.status(result.success ? 200 : 404).json(result);
  }
);

export default router;
