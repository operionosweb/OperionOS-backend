import express from "express";
import { requireOciAccess } from "../middleware/ociAccessMiddleware.js";

export function createOciAccessRouter(authorize = requireOciAccess) {
  const router = express.Router();
  router.get("/access", authorize, (req, res) => res.json({
    success: true,
    user: { id: req.ociIdentity.id, email: req.ociIdentity.email },
    role: "super_admin",
    mfaRequired: true,
    mfaVerified: true,
  }));
  return router;
}

export default createOciAccessRouter();
