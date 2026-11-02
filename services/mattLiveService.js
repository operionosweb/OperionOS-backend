import { randomUUID } from "node:crypto";
import { createTavusEchoProvider } from "../providers/tavusEchoProvider.js";

function failure(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}
export function mattLiveConfiguration(env = process.env) {
  const modelProvider = env.AI_PROVIDER || "mistral";
  const missing = [
    ["MATT_LIVE_ENABLED", env.MATT_LIVE_ENABLED === "true"],
    ["MATT_LIVE_APPROVAL_ID", Boolean(env.MATT_LIVE_APPROVAL_ID)],
    ["MATT_LIVE_ORGANIZATIONS", Boolean(env.MATT_LIVE_ORGANIZATIONS)],
    ["TAVUS_API_KEY", Boolean(env.TAVUS_API_KEY)],
    ["TAVUS_MATT_ECHO_PAL_ID", Boolean(env.TAVUS_MATT_ECHO_PAL_ID)],
    ["TAVUS_MATT_FACE_ID", Boolean(env.TAVUS_MATT_FACE_ID)],
    ["TAVUS_MATT_VOICE_ID", Boolean(env.TAVUS_MATT_VOICE_ID)],
    ["MATT_ECHO_PAL_APPROVED", env.MATT_ECHO_PAL_APPROVED === "true"],
    ["MATT_FIXED_VOICE_APPROVED", env.MATT_FIXED_VOICE_APPROVED === "true"],
    ["MATT_DATA_PROCESSING_APPROVED", env.MATT_DATA_PROCESSING_APPROVED === "true"],
    ["MATT_BUDGET_APPROVED", env.MATT_BUDGET_APPROVED === "true"],
    ["MATT_SUPPORTED_MODEL_PROVIDER", ["mistral", "openrouter"].includes(modelProvider)],
    [modelProvider === "openrouter" ? "OPENROUTER_API_KEY" : "MISTRAL_API_KEY", Boolean(modelProvider === "openrouter" ? env.OPENROUTER_API_KEY : env.MISTRAL_API_KEY)],
  ].filter(([, ready]) => !ready).map(([name]) => name);
  return { enabled: missing.length === 0, missing };
}

export function createMattLiveService({ provider, generateAnswer, assertReadiness = async () => {}, configuration = () => mattLiveConfiguration(), allowedOrganization = (id) => (process.env.MATT_LIVE_ORGANIZATIONS || "").split(",").map((value) => value.trim()).includes(id), now = Date.now, logger = console } = {}) {
  const sessions = new Map(), owners = new Set();
  function status(organizationId) {
    const config = configuration();
    return { enabled: config.enabled && allowedOrganization(organizationId), missing: config.missing,
      message: !config.enabled ? "Live Matt is not configured. Provider identity, fixed voice, processing authority and budget approvals are required."
        : !allowedOrganization(organizationId) ? "Live Matt is not approved for this organization." : "Approved live connection available." };
  }
  function find(id, organizationId, userId) {
    const session = sessions.get(id);
    if (!session || session.organizationId !== organizationId || session.userId !== userId) throw failure("MATT_SESSION_NOT_FOUND", "Live Matt session not found", 404);
    if (session.expires <= now()) throw failure("MATT_SESSION_EXPIRED", "Live Matt session expired");
    return session;
  }
  async function close(session) {
    session.controller?.abort();
    clearTimeout(session.timer);
    // Keep ownership until termination succeeds, so a failed cleanup cannot spawn another paid room.
    await provider.end(session.provider.conversationId);
    sessions.delete(session.id);
    owners.delete(session.owner);
  }
  return {
    status,
    async create({ organizationId, userId, consent, signal }) {
      if (!status(organizationId).enabled) throw failure("MATT_NOT_CONFIGURED", status(organizationId).message, 503);
      if (consent !== true) throw failure("MATT_CONSENT_REQUIRED", "Explicit processing authorization is required", 403);
      const owner = `${organizationId}:${userId}`;
      if (owners.has(owner) || owners.size >= 3) throw failure("MATT_SESSION_LIMIT", "Close the existing live Matt session before starting another");
      owners.add(owner);
      let remote;
      try {
        await assertReadiness({ organizationId, userId });
        signal?.throwIfAborted();
        remote = await provider.create();
        if (signal?.aborted) {
          await provider.end(remote.conversationId);
          owners.delete(owner);
          remote = null;
          signal.throwIfAborted();
        }
        const session = { id: randomUUID(), owner, organizationId, userId, provider: remote, expires: now() + 600000, history: [], analysisRunId: null };
        sessions.set(session.id, session);
        session.timer = setTimeout(() => { close(session).catch((error) => logger.error("Matt timed session cleanup failed", error.code || "MATT_PROVIDER_FAILED")); }, 600000);
        session.timer.unref?.();
        return { id: session.id, ...remote, expiresAt: new Date(session.expires).toISOString() };
      } catch (error) {
        if (!remote) owners.delete(owner);
        else if (signal?.aborted) logger.error("Matt cancelled session creation; verify provider termination before reconnecting");
        throw error;
      }
    },
    async ask({ id, organizationId, userId, analysisRunId, question, confirmation = false, signal }) {
      if (!status(organizationId).enabled) throw failure("MATT_NOT_CONFIGURED", status(organizationId).message, 503);
      const session = find(id, organizationId, userId);
      if (typeof question !== "string" || question.trim().length < 3 || question.length > 500) throw failure("MATT_INVALID_QUESTION", "Question must contain 3 to 500 characters", 400);
      if (session.controller) throw failure("MATT_TURN_IN_PROGRESS", "Interrupt the current turn before asking again");
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      session.controller = controller;
      try {
        controller.signal.throwIfAborted();
        const history = session.analysisRunId === analysisRunId ? session.history : [];
        const assistant = await generateAnswer({ organizationId, userId, analysisRunId, question: question.trim(), history, confirmation: confirmation === true, signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!assistant || typeof assistant.answer !== "string" || assistant.answer.length > 2000 || !assistant.answer.trim()) throw failure("MATT_INVALID_ANSWER", "The generated answer is invalid", 502);
        session.analysisRunId = analysisRunId;
        session.history = [...history, { role: "user", text: question.trim() }, { role: "assistant", text: assistant.answer }].slice(-12);
        return { assistant, turnId: randomUUID() };
      } finally {
        signal?.removeEventListener("abort", abort);
        if (session.controller === controller) session.controller = null;
      }
    },
    interrupt({ id, organizationId, userId }) {
      find(id, organizationId, userId).controller?.abort();
    },
    async end({ id, organizationId, userId }) {
      const session = sessions.get(id);
      if (!session || session.organizationId !== organizationId || session.userId !== userId) throw failure("MATT_SESSION_NOT_FOUND", "Live Matt session not found", 404);
      await close(session);
    },
  };
}

export function configuredMattProvider() {
  return createTavusEchoProvider({ apiKey: process.env.TAVUS_API_KEY, palId: process.env.TAVUS_MATT_ECHO_PAL_ID, faceId: process.env.TAVUS_MATT_FACE_ID, voiceId: process.env.TAVUS_MATT_VOICE_ID });
}
