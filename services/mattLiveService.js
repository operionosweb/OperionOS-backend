import { randomUUID } from "node:crypto";
import { createTavusEchoProvider } from "../providers/tavusEchoProvider.js";
import { mattSpeechConfiguration } from "./mattSpeechConfiguration.js";
import { MATT_CONTEXT_MODES, MATT_PAGE_IDS } from "../shared/operionPlatformKnowledge.js";

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

export function createMattLiveService({ provider, speechProvider, speechConfiguration = () => mattSpeechConfiguration(), generateAnswer, assertReadiness = async () => {}, configuration = () => mattLiveConfiguration(), allowedOrganization = (id) => (process.env.MATT_LIVE_ORGANIZATIONS || "").split(",").map((value) => value.trim()).includes(id), maxSessions = 3, idleMs = 180000, now = Date.now, logger = console } = {}) {
  const sessions = new Map(), owners = new Set();
  function touch(session) {
    session.lastActivity = now();
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      close(session).catch((error) => logger.error("Matt idle cleanup failed", error.code || "MATT_PROVIDER_FAILED"));
    }, idleMs);
    session.idleTimer.unref?.();
  }
  function status(organizationId) {
    const config = configuration();
    return { enabled: config.enabled && allowedOrganization(organizationId), missing: config.missing, speech: speechConfiguration(),
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
    if (session.closePending) return session.closePending;
    session.closing = true;
    session.history = [];
    session.controller?.abort();
    clearTimeout(session.timer);
    clearTimeout(session.idleTimer);
    session.closePending = (async () => {
      const cleanup = await Promise.allSettled([closeSpeech(session), provider.end(session.provider.conversationId)]);
      // Keep ownership until termination succeeds, so a failed cleanup cannot spawn another paid room.
      const failed = cleanup.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      sessions.delete(session.id);
      owners.delete(session.owner);
    })();
    try { await session.closePending; }
    finally { session.closePending = null; }
  }
  async function closeSpeech(session, connectionId) {
    // A late cleanup from an older browser connection must not close its replacement.
    if (connectionId && session.speech?.connectionId !== connectionId) return;
    if (session.speechClosing) return session.speechClosing;
    session.speechClosing = (async () => {
      session.speechController?.abort();
      if (session.speechPending) {
        const [result] = await Promise.allSettled([session.speechPending]);
        if (result.status === "rejected") logger.error("Matt pending speech creation ended", result.reason.code || "MATT_SPEECH_CREATION_CANCELLED");
      }
      if (session.speech) {
        await speechProvider.end(session.speech.id);
        session.speech = null;
      }
      if (session.speechUncertain) throw failure("MATT_SPEECH_CLEANUP_UNCERTAIN", "A speech call may remain active. An operator must confirm termination before reconnection.", 502);
    })();
    try { await session.speechClosing; }
    finally { session.speechClosing = null; }
  }
  return {
    status,
    async revoke({ organizationId, userId }) {
      if (!organizationId || !userId) throw failure("MATT_SCOPE_REQUIRED", "Authenticated session ownership is required.", 400);
      await Promise.all([...sessions.values()].filter((session) => session.organizationId === organizationId && session.userId === userId).map(close));
    },
    async openSpeech({ id, organizationId, userId, consent, sdp, signal }) {
      if (!status(organizationId).enabled) throw failure("MATT_NOT_CONFIGURED", "Live Matt is not approved for this organization.", 503);
      const session = find(id, organizationId, userId);
      if (session.closing) throw failure("MATT_SESSION_CLOSING", "The live session is closing. Confirm cleanup before reconnecting.");
      const config = speechConfiguration();
      if (config.provider !== "openai-realtime" || !config.enabled || !speechProvider) throw failure("MATT_SPEECH_NOT_CONFIGURED", "Real-time audio processing requires explicit provider, privacy and spending approvals.", 503);
      if (consent !== true) throw failure("MATT_SPEECH_CONSENT_REQUIRED", "Explicit microphone processing authorization is required.", 403);
      if (session.speech || session.speechPending || session.speechClosing || session.speechUncertain) throw failure("MATT_SPEECH_SESSION_LIMIT", "Close the existing speech connection and confirm termination before reconnecting.");
      if (typeof sdp !== "string" || sdp.length > 60000 || !sdp.startsWith("v=0") || !sdp.includes("m=audio") || sdp.includes("m=video")) throw failure("MATT_SPEECH_INVALID_SDP", "Supply a bounded audio-only WebRTC offer.", 400);
      touch(session);
      const controller = new AbortController(), abort = () => controller.abort();
      session.speechController = controller;
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      session.speechPending = (async () => {
        controller.signal.throwIfAborted();
        await assertReadiness({ organizationId, userId });
        controller.signal.throwIfAborted();
        session.speech = { ...await speechProvider.create(sdp), connectionId: randomUUID() };
        if (controller.signal.aborted || session.closing || session.expires <= now()) {
          await speechProvider.end(session.speech.id);
          session.speech = null;
          throw failure("MATT_SPEECH_CANCELLED", "Speech creation was cancelled; the late call was terminated.");
        }
        return { sdp: session.speech.sdp, connectionId: session.speech.connectionId, expiresAt: new Date(session.expires).toISOString() };
      })();
      try { return await session.speechPending; }
      catch (error) { if (error.uncertain) session.speechUncertain = true; throw error; }
      finally {
        signal?.removeEventListener("abort", abort);
        session.speechPending = null;
        if (session.speechController === controller) session.speechController = null;
      }
    },
    async endSpeech({ id, organizationId, userId, connectionId }) {
      if (connectionId !== undefined && (typeof connectionId !== "string" || !/^[a-f0-9-]{36}$/.test(connectionId))) throw failure("MATT_SPEECH_INVALID_CONNECTION", "Invalid speech connection identifier.", 400);
      await closeSpeech(find(id, organizationId, userId), connectionId);
    },
    async create({ organizationId, userId, consent, signal }) {
      if (!status(organizationId).enabled) throw failure("MATT_NOT_CONFIGURED", status(organizationId).message, 503);
      if (consent !== true) throw failure("MATT_CONSENT_REQUIRED", "Explicit processing authorization is required", 403);
      const owner = `${organizationId}:${userId}`;
      if (owners.has(owner) || owners.size >= maxSessions) throw failure("MATT_SESSION_LIMIT", "Close the existing live Matt session before starting another");
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
        touch(session);
        session.timer = setTimeout(() => { close(session).catch((error) => logger.error("Matt timed session cleanup failed", error.code || "MATT_PROVIDER_FAILED")); }, 600000);
        session.timer.unref?.();
        return { id: session.id, ...remote, expiresAt: new Date(session.expires).toISOString(), idleTimeoutMs: idleMs };
      } catch (error) {
        if (!remote) owners.delete(owner);
        else if (signal?.aborted) logger.error("Matt cancelled session creation; verify provider termination before reconnecting");
        throw error;
      }
    },
    async ask({ id, organizationId, userId, analysisRunId, contextMode = "analysis", pageId = "matt", account, question, confirmation = false, signal }) {
      if (!status(organizationId).enabled) throw failure("MATT_NOT_CONFIGURED", status(organizationId).message, 503);
      const session = find(id, organizationId, userId);
      if (session.closing) throw failure("MATT_SESSION_CLOSING", "The live session is closing. Confirm cleanup before reconnecting.");
      if (!MATT_CONTEXT_MODES.includes(contextMode) || !MATT_PAGE_IDS.includes(pageId)) throw failure("MATT_CONTEXT_DENIED", "Unknown Matt question scope or page.", 400);
      if (typeof question !== "string" || question.trim().length < 3 || question.length > 500) throw failure("MATT_INVALID_QUESTION", "Question must contain 3 to 500 characters", 400);
      if (session.controller) throw failure("MATT_TURN_IN_PROGRESS", "Interrupt the current turn before asking again");
      touch(session);
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      session.controller = controller;
      let completed;
      session.turnDone = new Promise((resolve) => { completed = resolve; });
      try {
        controller.signal.throwIfAborted();
        const contextKey = JSON.stringify([contextMode, analysisRunId || null, pageId, account?.permissions || []]);
        const history = session.contextKey === contextKey ? session.history : [];
        const assistant = await generateAnswer({ organizationId, userId, analysisRunId, contextMode, pageId, account, question: question.trim(), history, confirmation: confirmation === true, signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!assistant || typeof assistant.answer !== "string" || assistant.answer.length > 2000 || !assistant.answer.trim()) throw failure("MATT_INVALID_ANSWER", "The generated answer is invalid", 502);
        session.analysisRunId = analysisRunId;
        session.contextKey = contextKey;
        session.history = [...history, { role: "user", text: question.trim() }, { role: "assistant", text: assistant.answer }].slice(-12);
        return { assistant, turnId: randomUUID() };
      } finally {
        signal?.removeEventListener("abort", abort);
        if (session.controller === controller) session.controller = null;
        completed();
      }
    },
    async interrupt({ id, organizationId, userId }) {
      const session = find(id, organizationId, userId);
      if (!session.controller) return;
      session.controller.abort();
      let timer;
      try {
        await Promise.race([session.turnDone, new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(failure("MATT_INTERRUPT_TIMEOUT", "Answer cancellation could not be confirmed. Disconnect Matt before continuing.", 502)), 5000);
        })]);
      } finally { clearTimeout(timer); }
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
