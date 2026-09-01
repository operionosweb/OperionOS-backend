import crypto from "node:crypto";
import axios from "axios";

import { createPostgresIntelligenceStore } from "./postgresIntelligenceStore.js";

const DEFAULT_COSTS = Object.freeze({
  classification: 5,
  summarisation: 10,
  clause_interpretation: 25,
  obligation_reasoning: 30,
  risk_reasoning: 35,
  full_contract_analysis: 100,
});

const JOB_STATUSES = new Set([
  "pending", "estimating", "awaiting_confirmation", "processing",
  "completed", "failed", "cancelled", "budget_blocked",
]);

export function hashContent(content = "") {
  return crypto.createHash("sha256").update(String(content), "utf8").digest("hex");
}

export function createInMemoryIntelligenceStore() {
  return {
    kind: "memory",
    budgets: new Map(),
    usage: [],
    jobs: new Map(),
    cache: new Map(),
  };
}

function scopedKey(organizationId, key) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId || "")) throw Object.assign(new Error("A valid organization scope is required"), { code: "ORGANIZATION_ACCESS_DENIED" });
  return `${organizationId}:${key}`;
}

function budgetSnapshot(budget) {
  const consumed = Number(budget.consumed || 0);
  const reserved = Number(budget.reserved || 0);
  return {
    allocated: Number(budget.allocated || 0), consumed, reserved,
    remaining: Math.max(0, Number(budget.allocated || 0) - consumed - reserved),
    warning: consumed >= Number(budget.warningThreshold || 80),
    hardLimit: budget.hardLimit !== false,
  };
}

function parseStructuredOutput(output) {
  if (output && typeof output === "object") return output;
  if (typeof output !== "string") throw Object.assign(new Error("Provider returned no structured output"), { code: "INVALID_STRUCTURED_OUTPUT" });
  try {
    return JSON.parse(output.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim());
  } catch {
    throw Object.assign(new Error("Provider returned invalid structured output"), { code: "INVALID_STRUCTURED_OUTPUT" });
  }
}

function createMistralProvider({ apiKey = process.env.MISTRAL_API_KEY, model = process.env.MISTRAL_MODEL || "mistral-large-latest", http = axios } = {}) {
  return {
    name: "mistral", model,
    async generate(request) {
      if (!apiKey) throw Object.assign(new Error("MISTRAL_API_KEY missing"), { code: "INVALID_PROVIDER_CONFIGURATION" });
      const response = await http.post("https://api.mistral.ai/v1/chat/completions", {
        model, messages: [{ role: "system", content: request.system || "Return valid JSON." }, { role: "user", content: request.input }],
        temperature: request.temperature ?? 0.1,
        response_format: request.structured ? { type: "json_object" } : undefined,
      }, { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: request.timeoutMs || 25000 });
      return { output: response?.data?.choices?.[0]?.message?.content, usage: response?.data?.usage || {} };
    },
  };
}

function createOpenRouterProvider({ apiKey = process.env.OPENROUTER_API_KEY, model = process.env.OPENROUTER_MODEL || "mistralai/mistral-large-latest", http = axios } = {}) {
  return {
    name: "openrouter", model,
    async generate(request) {
      if (!apiKey) throw Object.assign(new Error("OPENROUTER_API_KEY missing"), { code: "INVALID_PROVIDER_CONFIGURATION" });
      const response = await http.post("https://openrouter.ai/api/v1/chat/completions", {
        model, messages: [{ role: "system", content: request.system || "Return valid JSON." }, { role: "user", content: request.input }],
        temperature: request.temperature ?? 0.1,
        response_format: request.structured ? { type: "json_object" } : undefined,
      }, { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: request.timeoutMs || 25000 });
      return { output: response?.data?.choices?.[0]?.message?.content, usage: response?.data?.usage || {} };
    },
  };
}

export function createAIGateway({
  providers = {}, store = createInMemoryIntelligenceStore(), costs = DEFAULT_COSTS,
  now = () => new Date().toISOString(), analysisVersion = "ai-foundation-v1",
} = {}) {
  const configuredProviders = Object.keys(providers).length ? providers : {
    mistral: createMistralProvider(),
    ...(process.env.OPENROUTER_API_KEY ? { openrouter: createOpenRouterProvider() } : {}),
  };

  function getMemoryBudget(organizationId) {
    const key = scopedKey(organizationId, "budget");
    if (!store.budgets.has(key)) store.budgets.set(key, { allocated: 0, consumed: 0, reserved: 0, warningThreshold: 80, hardLimit: true });
    return store.budgets.get(key);
  }

  function setBudget(organizationId, values) {
    if (store.kind === "postgres") return store.setBudget(organizationId, values).then(budgetSnapshot);
    const budget = { ...getMemoryBudget(organizationId), ...values };
    store.budgets.set(scopedKey(organizationId, "budget"), budget);
    return budgetSnapshot(budget);
  }

  function getBudget(organizationId) {
    scopedKey(organizationId, "budget");
    if (store.kind === "postgres") return store.getBudget(organizationId).then(budgetSnapshot);
    return budgetSnapshot(getMemoryBudget(organizationId));
  }

  async function createJob(job) {
    if (store.kind === "postgres") return store.createJob(job);
    store.jobs.set(scopedKey(job.organizationId, job.id), job);
    return job;
  }

  async function updateJob(job) {
    if (store.kind === "postgres") return store.updateJob(job);
    store.jobs.set(scopedKey(job.organizationId, job.id), job);
    return job;
  }

  async function findCached(cacheIdentity, cacheKey) {
    if (store.kind === "postgres") return store.getCache(cacheIdentity);
    return store.cache.get(cacheKey) || null;
  }

  function estimate(operation, input = "") {
    const base = Number(costs[operation] ?? costs.full_contract_analysis ?? 0);
    return Math.max(0, Math.ceil(base * Math.max(1, String(input).length / 12000)));
  }

  async function request({ organizationId, userId = null, operation, input = "", deterministicResult, existingIntelligence, documentHash = hashContent(input), provider = process.env.AI_PROVIDER || "mistral", model, promptVersion = null, confirmation = false, structured = true, system }) {
    if (!operation) throw Object.assign(new Error("An operation type is required"), { code: "INVALID_AI_REQUEST" });
    scopedKey(organizationId, "request");
    if (deterministicResult !== undefined) return { success: true, source: "deterministic", intelligenceConsumption: 0, result: deterministicResult };
    if (existingIntelligence !== undefined) return { success: true, source: "cache", intelligenceConsumption: 0, result: existingIntelligence };
    const selected = configuredProviders[provider];
    if (!selected || typeof selected.generate !== "function") throw Object.assign(new Error(`Provider is not configured: ${provider}`), { code: "INVALID_PROVIDER_CONFIGURATION" });
    const resolvedModel = model || selected.model || null;
    const cacheKey = scopedKey(organizationId, `${documentHash}:${operation}:${analysisVersion}:${promptVersion || "default"}:${provider}:${resolvedModel || "default"}`);
    const cacheIdentity = { organizationId, documentHash, operation, analysisVersion, promptVersion, provider, model: resolvedModel };
    const cached = await findCached(cacheIdentity, cacheKey);
    if (cached) return { success: true, source: "cache", intelligenceConsumption: 0, result: cached.result, job: cached.job };

    const estimated = estimate(operation, input);
    let budget = store.kind === "postgres" ? await store.getBudget(organizationId) : getMemoryBudget(organizationId);
    const snapshot = budgetSnapshot(budget);
    const requestKey = hashContent(JSON.stringify(cacheIdentity));
    const job = { id: crypto.randomUUID(), organizationId, userId, operation, status: "estimating", estimatedIntelligence: estimated, actualIntelligence: 0, requestKey, createdAt: now() };
    const persistedJob = await createJob(job);
    if (persistedJob?.id !== job.id) {
      return { success: false, code: "REQUEST_IN_PROGRESS", job: persistedJob, estimatedIntelligence: persistedJob?.estimatedIntelligence ?? estimated };
    }
    if (estimated > snapshot.remaining && budget.hardLimit) {
      job.status = "budget_blocked";
      await updateJob(job);
      return { success: false, code: "INSUFFICIENT_INTELLIGENCE_BUDGET", job, estimatedIntelligence: estimated, remainingIntelligence: snapshot.remaining, requiredAction: "Increase the AI Intelligence Budget or choose a lower-cost operation." };
    }
    if (estimated >= Number(costs.confirmationThreshold ?? 50) && !confirmation) {
      job.status = "awaiting_confirmation";
      await updateJob(job);
      return { success: false, code: "CONFIRMATION_REQUIRED", job, estimatedIntelligence: estimated, remainingIntelligence: snapshot.remaining };
    }
    if (store.kind === "postgres") {
      budget = await store.reserveBudget(organizationId, estimated);
      if (!budget) {
        job.status = "budget_blocked";
        await updateJob(job);
        return { success: false, code: "INSUFFICIENT_INTELLIGENCE_BUDGET", job, estimatedIntelligence: estimated, remainingIntelligence: snapshot.remaining, requiredAction: "Increase the AI Intelligence Budget or choose a lower-cost operation." };
      }
    } else {
      budget.reserved = Number(budget.reserved || 0) + estimated;
    }
    job.status = "processing"; job.provider = selected.name || provider; job.model = resolvedModel;
    await updateJob(job);
    try {
      const response = await selected.generate({ input, system, structured });
      const actual = estimated;
      const result = structured ? parseStructuredOutput(response?.output) : response?.output;
      if (store.kind !== "postgres") {
        budget.reserved -= estimated;
        budget.consumed = Number(budget.consumed || 0) + actual;
      }
      job.status = "completed"; job.actualIntelligence = actual; job.completedAt = now(); job.technicalUsage = response?.usage || {};
      const usage = { organizationId, userId, jobId: job.id, operation, estimatedIntelligence: estimated, actualIntelligence: actual, provider: job.provider, model: job.model, technicalUsage: job.technicalUsage, createdAt: now() };
      if (store.kind === "postgres" && typeof store.completeRequest === "function") {
        budget = await store.completeRequest({ job, reservedAmount: estimated, usage, cache: { ...cacheIdentity, result } });
      } else if (store.kind === "postgres") {
        budget = await store.consumeBudget(organizationId, estimated, actual);
        await updateJob(job);
        await store.recordUsage(usage);
        await store.putCache({ ...cacheIdentity, result, job: { ...job } });
      } else {
        await updateJob(job);
        store.usage.push(usage);
        store.cache.set(cacheKey, { result, job: { ...job }, createdAt: now(), documentHash, analysisVersion });
      }
      return { success: true, source: "provider", result, job, budget: budgetSnapshot(budget) };
    } catch (error) {
      job.status = "failed"; job.error = { code: error.code || "PROVIDER_FAILED", message: error.message }; job.completedAt = now();
      if (store.kind === "postgres" && typeof store.failRequest === "function") await store.failRequest(job, estimated);
      else {
        if (store.kind === "postgres") await store.releaseBudget(organizationId, estimated);
        else budget.reserved -= estimated;
        await updateJob(job);
      }
      throw error;
    }
  }

  function getJob(organizationId, jobId) {
    scopedKey(organizationId, jobId);
    if (store.kind === "postgres") return store.getJob(organizationId, jobId);
    return store.jobs.get(scopedKey(organizationId, jobId)) || null;
  }
  function cancelJob(organizationId, jobId) {
    if (store.kind === "postgres") return store.cancelJob(organizationId, jobId, now());
    const job = getJob(organizationId, jobId);
    if (!job) return null;
    if (["pending", "estimating", "awaiting_confirmation"].includes(job.status)) {
      job.status = "cancelled";
      job.completedAt = now();
    }
    return job;
  }
  return { request, estimate, hashContent, setBudget, getBudget, getJob, cancelJob, store, providers: configuredProviders };
}

export const aiGateway = createAIGateway({ store: createPostgresIntelligenceStore() });

export { DEFAULT_COSTS, JOB_STATUSES, createMistralProvider, createOpenRouterProvider };