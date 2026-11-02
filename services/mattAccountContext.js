import supabase from "../config/supabase.js";
import { assertOrganizationScope, assertResourceId } from "../repositories/phase3/scope.js";
import { validateMattContext } from "./mattContextScope.js";

const failure = (code, message, status = 403) => Object.assign(new Error(message), { code, status });
export function createMattAccountRepository(client = supabase) {
  return {
    async listContracts(organizationId) {
      assertOrganizationScope(organizationId);
      const { data, error } = await client.from("contracts").select("id, organization_id, title, status")
        .eq("organization_id", organizationId).order("id", { ascending: true }).limit(51);
      if (error) throw failure("MATT_ACCOUNT_UNAVAILABLE", "Authorized account catalog is unavailable.", 503);
      if (!Array.isArray(data) || data.some((row) => row.organization_id !== organizationId)) throw failure("MATT_ACCOUNT_SCOPE_FAILED", "Account source scope could not be verified.", 503);
      if (data.length > 50) throw failure("MATT_CONTEXT_TOO_LARGE", "Account scope exceeds 50 contracts. Select a contract to review its evidence.", 413);
      return data.map(({ id, title, status }) => ({ id, title, status }));
    },
    async listLatestRuns(organizationId, contractIds) {
      assertOrganizationScope(organizationId);
      if (!contractIds.length) return [];
      contractIds.forEach((id) => assertResourceId(id, "contractId"));
      const { data, error } = await client.from("analysis_runs").select("id, organization_id, contract_id, status, created_at")
        .eq("organization_id", organizationId).in("contract_id", contractIds).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(201);
      if (error) throw failure("MATT_ACCOUNT_UNAVAILABLE", "Authorized account analyses are unavailable.", 503);
      if (!Array.isArray(data) || data.some((row) => row.organization_id !== organizationId || !contractIds.includes(row.contract_id))) throw failure("MATT_ACCOUNT_SCOPE_FAILED", "Analysis source scope could not be verified.", 503);
      if (data.length > 200) throw failure("MATT_CONTEXT_TOO_LARGE", "Account analysis history exceeds the bounded review limit. Select a contract.", 413);
      const latest = new Map();
      for (const row of data) if (!latest.has(row.contract_id)) latest.set(row.contract_id, { id: row.id, contractId: row.contract_id, status: row.status });
      return [...latest.values()];
    },
  };
}

export function createMattSaasContext({ readAnalysis, repository = createMattAccountRepository() }) {
  return async function readContext({ organizationId, userId, analysisRunId, contextMode = "analysis", pageId = "matt", account }) {
    assertOrganizationScope(organizationId);
    validateMattContext({ contextMode, pageId, analysisRunId });
    if (!account || account.organizationId !== organizationId || account.userId !== userId || !account.permissions?.includes("contract:read")) throw failure("MATT_ACCOUNT_DENIED", "A verified current account and contract-read permission are required.");
    const principal = { organizationId, name: account.name, userId, permissions: [...account.permissions] };
    if (contextMode === "platform") return { account: principal, pageId, evidence: [], limitations: ["Platform guidance only. No account contract, report, flight or document was retrieved."] };
    if (contextMode === "analysis") return { ...await readAnalysis({ organizationId, analysisRunId }), account: principal, pageId };
    const contracts = await repository.listContracts(organizationId);
    const runs = await repository.listLatestRuns(organizationId, contracts.map((item) => item.id));
    const analyses = [];
    for (const run of runs) {
      const context = await readAnalysis({ organizationId, analysisRunId: run.id });
      analyses.push({ contractId: run.contractId, analysisRunId: run.id, status: run.status, ...context });
      if (JSON.stringify(analyses).length > 45000) throw failure("MATT_CONTEXT_TOO_LARGE", "Account findings exceed the bounded review limit. Select a contract.", 413);
    }
    return {
      account: principal, pageId, contracts, analyses,
      evidence: [
        { id: "account:catalog", excerpt: JSON.stringify({ contracts, coverage: "Latest available analysis per listed contract only; missing analysis is not absence of obligations or risk." }), source_locator: "Current authorized organization contract catalog" },
        ...analyses.flatMap((analysis) => analysis.evidence),
      ],
      limitations: ["Account coverage is the latest available analysis per contract, not all document versions or independently verified portfolio exposure. Relative deadlines require known triggers/calendar; no current overdue status is inferred."],
    };
  };
}
