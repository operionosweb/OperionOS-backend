import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";
import { readAnalysisRunClauses, readAnalysisRunObligations, readAnalysisRunDeadlines, readAnalysisRunRisks, readAnalysisRunEvidence } from "./analysisRunRoutes.js";
import { aiGateway } from "../services/ai/aiGateway.js";
import { createMattLiveService, configuredMattProvider } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { toSafeHttpError } from "../utils/safeHttpError.js";

export function createMattLiveRouter({ service, authenticate = authenticateUser, membership = requireOrganizationMembership, permission = requireOrganizationPermission("contract:read"), logger = console }) {
  const router = express.Router();
  router.use(authenticate, membership, permission);
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  const scope = (req) => ({ organizationId: req.organization.id, userId: req.user.id, id: req.params.id });
  const handle = (operation) => async (req, res) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", abort);
    try {
      const result = await operation(req, controller.signal);
      if (!controller.signal.aborted) res.json(result || { success: true });
    } catch (error) {
      if (!controller.signal.aborted) {
        logger.error("Matt live request failed", error.code || "MATT_REQUEST_FAILED");
        const safe = toSafeHttpError(error);
        if (error.code?.startsWith("MATT_")) res.status(error.status || 502).json({ success: false, code: error.code, error: error.message,
          ...(error.code === "MATT_CONFIRMATION_REQUIRED" ? { estimatedIntelligence: error.estimatedIntelligence } : {}) });
        else res.status(safe.status).json(safe.body);
      }
    } finally { res.removeListener("close", abort); }
  };
  router.get("/status", handle((req) => service.status(req.organization.id)));
  router.post("/sessions", handle((req, signal) => service.create({ ...scope(req), consent: req.body?.consent, signal })));
  router.post("/sessions/:id/turns", handle((req, signal) => service.ask({ ...scope(req), analysisRunId: req.body?.analysisRunId, question: req.body?.question, confirmation: req.body?.confirmation, signal })));
  router.post("/sessions/:id/interrupt", handle((req) => service.interrupt(scope(req))));
  router.delete("/sessions/:id", handle((req) => service.end(scope(req))));
  return router;
}

const readContext = async (scope) => {
  const [clauses, obligations, deadlines, risks, evidence] = await Promise.all([
    readAnalysisRunClauses(scope), readAnalysisRunObligations(scope), readAnalysisRunDeadlines(scope), readAnalysisRunRisks(scope), readAnalysisRunEvidence(scope),
  ]);
  return { clauses, obligations, deadlines, risks, evidence };
};
export default createMattLiveRouter({ service: createMattLiveService({
  provider: configuredMattProvider(), generateAnswer: createMattAnswerService({ readContext, gateway: aiGateway }),
  assertReadiness: async ({ organizationId }) => {
    const budget = await aiGateway.getBudget(organizationId);
    if (budget.remaining < aiGateway.estimate("clause_interpretation", "")) {
      throw Object.assign(new Error("Allocate organization intelligence budget before starting a live avatar room."), { code: "MATT_MODEL_BUDGET_REQUIRED", status: 409 });
    }
  },
}) });
