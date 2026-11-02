import express from "express";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission, getOrganizationPermissions } from "../middleware/authorizationMiddleware.js";
import { readAnalysisRunClauses, readAnalysisRunObligations, readAnalysisRunDeadlines, readAnalysisRunRisks, readAnalysisRunEvidence, readAnalysisRunFinancialImpact, readAnalysisRunRelationships } from "./analysisRunRoutes.js";
import { aiGateway } from "../services/ai/aiGateway.js";
import { createMattLiveService, configuredMattProvider } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { toSafeHttpError } from "../utils/safeHttpError.js";
import { createOpenaiMattSpeechProvider } from "../providers/openaiMattSpeechProvider.js";
import { createMattSaasContext } from "../services/mattAccountContext.js";

export function createMattLiveRouter({ service, authenticate = authenticateUser, membership = requireOrganizationMembership, permission = requireOrganizationPermission("contract:read"), reauthorize, logger = console }) {
  const router = express.Router();
  const scope = (req) => ({ organizationId: req.organization.id, userId: req.user.id, id: req.params.id });
  const verify = (req, res, checks) => new Promise((resolve, reject) => {
    const finished = () => resolve(false);
    const failed = (error) => { res.removeListener("finish", finished); reject(error); };
    res.once("finish", finished);
    const run = (index) => {
      if (index === checks.length) { res.removeListener("finish", finished); resolve(true); return; }
      try {
        Promise.resolve(checks[index](req, res, (error) => {
          if (error) failed(error);
          else run(index + 1);
        })).catch(failed);
      } catch (error) { failed(error); }
    };
    run(0);
  });
  const refresh = (req, res) => verify(req, res, reauthorize ? [reauthorize] : [authenticate, membership, permission]);
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(authenticate);
  router.use(async (req, res, next) => {
    // The header can narrow cleanup, never authorize access; the owner is authenticated.
    const original = { userId: req.user?.id, organizationId: req.organization?.id || req.get("x-org-id") };
    try {
      if (await verify(req, res, [membership, permission])) return next();
      if ([401, 403].includes(res.statusCode) && original.userId && original.organizationId) {
        await service.revoke(original);
      }
    } catch (error) {
      logger.error("Matt authorization cleanup failed", error.code || "MATT_REQUEST_FAILED");
      if (!res.headersSent) next(error);
    }
  });
  const handle = (operation, recheck = false) => async (req, res) => {
    const controller = new AbortController();
    const original = scope(req), role = req.auth?.organizationRole;
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", abort);
    try {
      const result = await operation(req, controller.signal);
      if (recheck && !controller.signal.aborted) {
        let authorized = false;
        try {
          authorized = await refresh(req, res);
          if (authorized && (req.organization.id !== original.organizationId || req.user.id !== original.userId || req.auth?.organizationRole !== role)) {
            throw Object.assign(new Error("Matt authorization changed during this request. Reconnect after permission verification."), { code: "MATT_AUTHORIZATION_CHANGED", status: 403 });
          }
        } finally {
          if (!authorized || req.organization.id !== original.organizationId || req.user.id !== original.userId || req.auth?.organizationRole !== role) {
            await service.end({ ...original, id: original.id || result?.id });
          }
        }
        if (!authorized) return;
      }
      if (!controller.signal.aborted) res.json(result || { success: true });
    } catch (error) {
      logger.error("Matt live request failed", error.code || "MATT_REQUEST_FAILED");
      if (!controller.signal.aborted && !res.headersSent) {
        const safe = toSafeHttpError(error);
        if (error.code?.startsWith("MATT_")) res.status(error.status || 502).json({ success: false, code: error.code, error: error.message,
          readiness: error.code.includes("NOT_CONFIGURED") ? "configuration_incomplete"
            : [401, 403, 404].includes(error.status) ? "security_rejected"
              : (error.status || 502) >= 500 ? "provider_unavailable" : "request_rejected",
          ...(error.code === "MATT_CONFIRMATION_REQUIRED" ? { estimatedIntelligence: error.estimatedIntelligence } : {}) });
        else res.status(safe.status).json(safe.body);
      }
    } finally { res.removeListener("close", abort); }
  };
  router.get("/status", handle((req) => service.status(req.organization.id)));
  router.post("/sessions", handle((req, signal) => service.create({ ...scope(req), consent: req.body?.consent, signal }), true));
  router.post("/sessions/:id/turns", handle((req, signal) => service.ask({
    ...scope(req), analysisRunId: req.body?.analysisRunId, contextMode: req.body?.contextMode, pageId: req.body?.pageId,
    account: { organizationId: req.organization.id, name: req.organization.name, userId: req.user.id, permissions: getOrganizationPermissions(req.auth?.organizationRole) },
    question: req.body?.question, confirmation: req.body?.confirmation, signal,
  }), true));
  router.post("/sessions/:id/interrupt", handle((req) => service.interrupt(scope(req))));
  router.post("/sessions/:id/speech", handle((req, signal) => service.openSpeech({ ...scope(req), consent: req.body?.consent, sdp: req.body?.sdp, signal }), true));
  router.delete("/sessions/:id/speech", handle((req) => service.endSpeech({ ...scope(req), connectionId: req.query.connectionId })));
  router.delete("/sessions/:id", handle((req) => service.end(scope(req))));
  return router;
}

const readAnalysis = async (scope) => {
  const [clauses, obligations, deadlines, risks, evidence, financialImpact, relationships] = await Promise.all([
    readAnalysisRunClauses(scope), readAnalysisRunObligations(scope), readAnalysisRunDeadlines(scope), readAnalysisRunRisks(scope), readAnalysisRunEvidence(scope),
    readAnalysisRunFinancialImpact(scope), readAnalysisRunRelationships(scope),
  ]);
  return { clauses, obligations, deadlines, risks, evidence, financialImpact, relationships };
};
export default createMattLiveRouter({ service: createMattLiveService({
  provider: configuredMattProvider(), generateAnswer: createMattAnswerService({ readContext: createMattSaasContext({ readAnalysis }), gateway: aiGateway }),
  speechProvider: createOpenaiMattSpeechProvider({ apiKey: process.env.OPENAI_API_KEY }),
  assertReadiness: async ({ organizationId }) => {
    const budget = await aiGateway.getBudget(organizationId);
    if (budget.remaining < aiGateway.estimate("clause_interpretation", "")) {
      throw Object.assign(new Error("Allocate organization intelligence budget before starting a live avatar room."), { code: "MATT_MODEL_BUDGET_REQUIRED", status: 409 });
    }
  },
}) });
