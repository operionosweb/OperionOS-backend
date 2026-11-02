import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createMattLiveRouter } from "./mattLiveRoutes.js";
import { mattDemoConfiguration } from "../services/mattDemoConfiguration.js";
import { MATT_DEMO_ORGANIZATION_ID, resolveMattDemoAnalysis, readMattDemoContext } from "../services/mattDemoContext.js";
import { createMattLiveService, configuredMattProvider } from "../services/mattLiveService.js";
import { createMattAnswerService } from "../services/mattAnswerService.js";
import { createAIGateway } from "../services/ai/aiGateway.js";
import { createOpenaiMattSpeechProvider } from "../providers/openaiMattSpeechProvider.js";
import { mattSpeechConfiguration } from "../services/mattSpeechConfiguration.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const deny = (status, code, message) => Object.assign(new Error(message), { status, code });

export function createMattDemoRouter({ service, configuration = () => mattDemoConfiguration(), now = Date.now, logger = console } = {}) {
  const router = express.Router(), tokens = new Map(), rates = new Map();
  let issued = 0;
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.vary("Origin");
    const config = configuration();
    let origin = req.headers.origin;
    if (!origin && req.method === "GET" && req.headers.referer) {
      try { origin = new URL(req.headers.referer).origin; }
      catch { return res.status(403).json({ code: "MATT_DEMO_ORIGIN_DENIED", error: "Invalid Demo request origin." }); }
    }
    if (!config.origins.length) return res.status(503).json({ allowed: true, readiness: "configuration_incomplete", code: "MATT_DEMO_NOT_CONFIGURED", error: "Operator must configure MATT_DEMO_ALLOWED_ORIGINS before Demo Matt can connect." });
    if (!origin || !config.origins.includes(origin)) return res.status(403).json({ readiness: "security_rejected", code: "MATT_DEMO_ORIGIN_DENIED", error: "This browser origin is not approved for Demo Matt." });
    res.set({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Matt-Demo-Token" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    const time = now();
    for (const [key, item] of rates) if (item.expires <= time) rates.delete(key);
    for (const [key, item] of tokens) if (item.expires <= time) tokens.delete(key);
    // Use the socket peer, not attacker-controlled forwarding headers. Behind a proxy this deliberately shares one quota.
    const client = digest(req.socket.remoteAddress || "unknown");
    const rate = rates.get(client) || { count: 0, access: 0, expires: time + 3600000 };
    if (!rates.has(client) && rates.size >= 10000) return res.status(503).json({ code: "MATT_DEMO_CAPACITY", error: "Demo access protection is at capacity." });
    rates.set(client, rate);
    if (++rate.count > 240 && req.method !== "DELETE" && !req.path.endsWith("/interrupt")) {
      res.set("Retry-After", String(Math.ceil((rate.expires - time) / 1000)));
      return res.status(429).json({ code: "MATT_DEMO_RATE_LIMIT", error: "Demo request limit reached. Wait before retrying." });
    }
    req.mattDemoPeer = client; req.mattDemoRate = rate; req.mattDemoOrigin = origin;
    next();
  });
  router.use(express.json({ limit: "64kb" }));
  router.get("/status", (_req, res) => {
    const config = configuration(), status = service.status(MATT_DEMO_ORGANIZATION_ID);
    const readiness = !config.enabled ? "configuration_incomplete" : !status.enabled ? "provider_unavailable"
      : issued >= config.maxSessions ? "usage_exhausted" : "configured";
    res.json({ ...status, allowed: true, readiness, enabled: readiness === "configured",
      missing: [...new Set([...(status.missing || []), ...config.missing])],
      message: !config.enabled ? `Demo Matt requires operator configuration: ${config.missing.join(", ")}. No provider session has been created.`
        : issued >= config.maxSessions ? "The approved Demo session allowance is exhausted. Operator review is required." : status.message });
  });
  router.post("/access", (req, res, next) => {
    try {
      const config = configuration();
      if (!config.enabled || !service.status(MATT_DEMO_ORGANIZATION_ID).enabled) throw deny(503, "MATT_DEMO_NOT_CONFIGURED", "Demo provider, identity, processing and bounded usage approval are required.");
      if (req.body?.consent !== true || Object.keys(req.body).some((key) => key !== "consent") || req.headers["x-org-id"] || req.headers.authorization) throw deny(403, "MATT_DEMO_SCOPE_DENIED", "Approve prepared-data Demo processing only; supplied account identities are not accepted.");
      if (issued >= config.maxSessions || req.mattDemoRate.access >= 3) throw deny(429, "MATT_DEMO_USAGE_LIMIT", "Approved Demo access allowance exhausted. Operator review is required.");
      const token = randomBytes(32).toString("base64url"), created = now(), expires = created + 1200000;
      issued++; req.mattDemoRate.access++;
      tokens.set(digest(token), { userId: randomUUID(), origin: req.mattDemoOrigin, client: req.mattDemoPeer, created, expires, started: false, id: null, turns: 0, speech: 0 });
      res.json({ token, expiresAt: new Date(expires).toISOString() });
    } catch (error) { next(error); }
  });
  const authorize = (req, _res, next) => {
    try {
      if (req.headers["x-org-id"] || req.headers.authorization) throw deny(403, "MATT_DEMO_SCOPE_DENIED", "Demo does not accept SaaS credentials or tenant selection.");
      const token = req.headers["x-matt-demo-token"];
      const access = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? tokens.get(digest(token)) : null;
      if (!access || access.expires <= now() || access.origin !== req.mattDemoOrigin || access.client !== req.mattDemoPeer) throw deny(401, "MATT_DEMO_ACCESS_REQUIRED", "Demo access expired or is invalid. Reconnect after confirming cleanup.");
      const queryKeys = req.method === "DELETE" && req.path.endsWith("/speech") ? ["connectionId"] : [];
      if (Object.keys(req.query).some((key) => !queryKeys.includes(key))) throw deny(400, "MATT_DEMO_INVALID_REQUEST", "Unexpected Demo query parameter; tenant selection is not accepted.");
      const allowedKeys = req.method === "POST" && req.path === "/sessions" ? ["consent"]
        : req.method === "POST" && /^\/sessions\/[^/]+\/turns$/.test(req.path) ? ["analysisRunId", "contextMode", "pageId", "question", "confirmation"]
          : req.method === "POST" && /^\/sessions\/[^/]+\/speech$/.test(req.path) ? ["consent", "sdp"] : [];
      if (Object.keys(req.body || {}).some((key) => !allowedKeys.includes(key))) throw deny(400, "MATT_DEMO_INVALID_REQUEST", "Unexpected Demo request field; tenant identities and arbitrary documents are not accepted.");
      if (req.method === "POST" && req.path === "/sessions") {
        if (access.started || now() - access.created > 60000) throw deny(409, "MATT_DEMO_START_EXPIRED", "This one-use session authorization has been consumed or expired. Confirm cleanup before reconnecting.");
        access.started = true;
      } else {
        const id = req.path.match(/^\/sessions\/([^/]+)/)?.[1];
        if (!access.id || id !== access.id) throw deny(404, "MATT_DEMO_SESSION_NOT_FOUND", "This Demo session is unavailable.");
        if (req.method === "POST" && req.path.endsWith("/turns")) {
          if (!req.body.contextMode || req.body.contextMode === "analysis") req.body.analysisRunId = resolveMattDemoAnalysis(req.body.analysisRunId);
          if (++access.turns > 10) throw deny(429, "MATT_DEMO_TURN_LIMIT", "The ten-question Demo allowance is exhausted. Disconnect Matt.");
        }
        if (req.method === "POST" && req.path.endsWith("/speech") && ++access.speech > 3) throw deny(429, "MATT_DEMO_SPEECH_LIMIT", "The Demo speech-connection allowance is exhausted. Disconnect Matt.");
      }
      req.organization = { id: MATT_DEMO_ORGANIZATION_ID }; req.user = { id: access.userId };
      req.mattDemoAccess = access;
      next();
    } catch (error) { next(error); }
  };
  const scopedService = {
    ...service,
    async create(input) {
      const result = await service.create(input);
      const access = [...tokens.values()].find((item) => item.userId === input.userId);
      if (!access || access.expires <= now()) {
        await service.end({ ...input, id: result.id });
        throw deny(401, "MATT_DEMO_ACCESS_EXPIRED", "Demo authorization expired during session creation; the session was terminated.");
      }
      access.id = result.id;
      return result;
    },
  };
  router.use(createMattLiveRouter({ service: scopedService, authenticate: authorize, membership: (_req, _res, next) => next(), permission: (_req, _res, next) => next(),
    reauthorize: (req, res, next) => {
      if (req.mattDemoAccess.expires <= now()) return res.status(401).json({ readiness: "security_rejected", code: "MATT_DEMO_ACCESS_EXPIRED", error: "Demo authorization expired during the request. The session is being terminated." });
      next();
    }, logger }));
  router.use((_req, res) => res.status(404).json({ code: "MATT_DEMO_ROUTE_NOT_FOUND", error: "Demo Matt endpoint not found." }));
  router.use((error, _req, res, _next) => {
    logger.error("Matt Demo request rejected", error.code || error.type || "MATT_DEMO_REQUEST_FAILED");
    const known = error.code?.startsWith("MATT_");
    const status = known ? error.status : error.type === "entity.too.large" ? 413 : error instanceof SyntaxError ? 400 : 500;
    const httpStatus = status || 500;
    const readiness = [401, 403, 404].includes(httpStatus) ? "security_rejected"
      : httpStatus === 400 || httpStatus === 413 ? "invalid_request"
        : error.code?.includes("NOT_CONFIGURED") ? "configuration_incomplete"
        : httpStatus === 429 ? "usage_exhausted" : "provider_unavailable";
    res.status(httpStatus).json({ readiness, code: known ? error.code : "MATT_DEMO_REQUEST_REJECTED", error: known ? error.message : "Demo request rejected." });
  });
  return router;
}

const config = mattDemoConfiguration(), gateway = createAIGateway();
gateway.setBudget(MATT_DEMO_ORGANIZATION_ID, { allocated: config.enabled ? config.intelligenceBudget : 0, hardLimit: true });
export default createMattDemoRouter({ service: createMattLiveService({
  provider: configuredMattProvider(), speechProvider: createOpenaiMattSpeechProvider({ apiKey: process.env.OPENAI_API_KEY }),
  speechConfiguration: () => mattSpeechConfiguration(),
  generateAnswer: createMattAnswerService({ readContext: readMattDemoContext, gateway }),
  configuration: () => mattDemoConfiguration(), allowedOrganization: (id) => id === MATT_DEMO_ORGANIZATION_ID, maxSessions: 1,
  assertReadiness: async () => {
    const budget = await gateway.getBudget(MATT_DEMO_ORGANIZATION_ID);
    if (budget.remaining < gateway.estimate("clause_interpretation", "")) throw deny(409, "MATT_DEMO_MODEL_BUDGET_REQUIRED", "The approved Demo intelligence budget is exhausted.");
  },
}) });
