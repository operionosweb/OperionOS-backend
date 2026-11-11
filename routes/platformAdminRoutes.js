import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireSuperAdmin } from "../middleware/superAdminMiddleware.js";
import { createPlatformAdminService } from "../services/platformAdminService.js";
import { createProductionDiagnosticService } from "../services/productionDiagnosticService.js";

function requireMfa(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  try {
    // The router's authentication middleware verifies this token before this check.
    const parts = token?.split(".");
    if (parts?.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))?.aal === "aal2") return next();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return res.status(403).json({ success: false, error: "A verified multi-factor session is required for this operation." });
}

export function createPlatformAdminRouter({ service = createPlatformAdminService(), diagnostics = createProductionDiagnosticService(), authenticate = authenticateUser, authorize = requireSuperAdmin } = {}) {
  const router = express.Router();
  router.use(authenticate, authorize, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });
  const writes = new Map();
  router.use((req, res, next) => {
    if (req.method === "GET") return next();
    const now = Date.now();
    for (const [key, value] of writes) if (value.expires <= now) writes.delete(key);
    const key = req.user.id;
    const entry = writes.get(key) || { count: 0, expires: now + 60000 };
    if (writes.size >= 10000 && !writes.has(key)) return res.status(503).json({ success: false, error: "Administrative protection is at capacity." });
    writes.set(key, entry);
    if (++entry.count > 10) return res.status(429).set("Retry-After", "60").json({ success: false, error: "Too many administrative changes. Wait one minute." });
    return next();
  });
  const handle = callback => async (req, res) => {
    try { res.json({ success: true, ...await callback(req) }); }
    catch (error) {
      const status = error.code === "23505" ? 409 : error.status || 503;
      if (status >= 500) console.error("platform_admin_failed", { code: error.code || "ADMIN_UNAVAILABLE" });
      res.status(status).json({ success: false, error: ["GLOBAL_SCOPE_UNVERIFIED", "GLOBAL_TLS_UNVERIFIED"].includes(error.code) ? error.message : status >= 500
        ? "Administration operation failed. Refresh to check current state before retrying; an external Auth change may already have completed."
        : error.code === "23505" ? "This record already exists." : error.message });
    }
  };
  router.get("/summary", handle(req => service.summary(req.query.days)));
  router.get("/contract-intelligence", requireMfa, handle(() => service.contractIntelligence()));
  router.get("/production-diagnostics", requireMfa, handle(() => diagnostics()));
  router.get("/users", handle(req => service.users(req.query)));
  router.get("/users/:id", handle(req => service.user(req.params.id)));
  router.post("/users", handle(req => service.provision(req.user.id, req.body)));
  router.post("/users/:id/recovery", handle(req => service.recovery(req.user.id, req.params.id, req.body)));
  router.patch("/users/:id/status", handle(req => service.accountStatus(req.user.id, req.params.id, req.body)));
  router.put("/users/:id/platform-role", handle(req => service.platformRole(req.user.id, req.params.id, req.body)));
  router.get("/organizations", handle(req => service.organizations(req.query)));
  router.get("/organizations/:id", handle(req => service.organization(req.params.id)));
  router.post("/organizations", handle(req => service.saveOrganization(req.user.id, null, req.body)));
  router.put("/organizations/:id", handle(req => service.saveOrganization(req.user.id, req.params.id, req.body)));
  router.put("/organizations/:id/members/:userId", handle(req => service.membership(req.user.id, req.params.id, req.params.userId, req.body)));
  return router;
}
export default createPlatformAdminRouter();
