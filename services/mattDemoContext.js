import { DEMO_CONTRACTS } from "../shared/mattDemoContracts.js";
import { createDemonstrationScenarios, GLOBE_DEMO_NOTICE } from "../shared/globeScenarioData.js";
import { validateMattContext } from "./mattContextScope.js";

export const MATT_DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-00000000de00";
const contexts = new Map(), aliases = new Map();
const reject = () => Object.assign(new Error("Select an available prepared Demo contract or flight. Customer analyses are not accessible."), { code: "MATT_DEMO_CONTEXT_DENIED", status: 403 });

function register(alias, context) {
  const id = `00000000-0000-4000-8000-${String(contexts.size + 1).padStart(12, "0")}`;
  aliases.set(alias, id);
  contexts.set(id, context);
}

for (const contract of DEMO_CONTRACTS) {
  register(contract.id, {
    demonstration: true,
    notice: contract.analysisStatus === "synthetic_template"
      ? "Synthetic navigation template, not an uploaded or executed contract. No contract-type analysis or evidence is available; do not substitute another contract's findings."
      : "Prepared fictional demonstration, not an uploaded or executed contract or customer result. Contract-specific synthetic clauses, assumptions and financial illustrations are not verified real-world evidence. Numerical confidence labels are illustrative, not measured accuracy.",
    contract: { id: contract.id, title: contract.title, type: contract.type, aircraft: contract.aircraft },
    clauses: contract.clauses,
    obligations: contract.obligations,
    deadlines: contract.deadlines,
    risks: contract.risks,
    financialExposure: contract.financialImpact,
    recommendations: contract.financialImpact?.items.filter((item) => item.action).map((item) => ({ action: item.action, basis: item.actionWhy })) || [],
    evidence: [
      ...contract.evidence.map((item) => ({ id: item.id, excerpt: item.excerpt, source_locator: item.locator, page_number: item.page })),
      ...(contract.financialImpact ? [{ id: `${contract.id}-financial-assumptions`, excerpt: `Fictional assumed inputs, not verified exposure or contractual rent amounts: ${JSON.stringify(contract.financialImpact)}`, source_locator: "Prepared Demo financial scenario / assumptions, not an executed lease provision" }] : []),
    ],
  });
}
for (const flight of createDemonstrationScenarios()) {
  const { intelligence } = flight;
  register(flight.id, {
    demonstration: true, notice: GLOBE_DEMO_NOTICE,
    aircraft: { id: flight.id, registration: flight.registration, model: flight.model },
    flight: {
      id: flight.id, flightNumber: flight.flightNumber, origin: flight.origin, destination: flight.destination,
      delayMinutes: flight.delayMinutes, rerouting: flight.rerouting, routeDistanceKm: flight.routeDistanceKm,
      provenance: flight.provenance, dataTimestamp: flight.dataTimestamp,
    },
    ...intelligence,
    evidence: [
      ...intelligence.evidence,
      { id: `${flight.id}-scenario`, excerpt: JSON.stringify({ event: intelligence.event, obligations: intelligence.obligations, exposure: intelligence.exposure, risks: intelligence.risks, recommendations: intelligence.recommendations }), source_locator: `${flight.id} / fixed fictional scenario, no live telemetry` },
    ],
  });
}

export function resolveMattDemoAnalysis(alias) {
  if (typeof alias !== "string" || !aliases.has(alias)) throw reject();
  return aliases.get(alias);
}

export async function readMattDemoContext({ organizationId, analysisRunId, contextMode = "analysis", pageId = "matt" }) {
  if (organizationId !== MATT_DEMO_ORGANIZATION_ID) throw reject();
  validateMattContext({ contextMode, pageId, analysisRunId });
  if (contextMode !== "analysis") {
    const account = { name: "Operion prepared Demo account", permissions: ["contract:read"], synthetic: true };
    if (contextMode === "platform") return { demonstration: true, notice: "Platform guidance only; no customer sources.", account, pageId, evidence: [] };
    const contracts = DEMO_CONTRACTS.map(({ id, title, status }) => ({ id, title, status }));
    const preparedContracts = DEMO_CONTRACTS.filter((contract) => contract.analysisStatus !== "synthetic_template");
    const analyses = preparedContracts.map(({ id }) => ({ contractId: id, ...structuredClone(contexts.get(aliases.get(id))) }));
    return { demonstration: true, notice: "Prepared Demo account only. Contract-specific synthetic illustrations are not customer analyses; navigation templates have no analysis.", account, pageId, contracts, analyses,
      coverage: DEMO_CONTRACTS.map(({ id, analysisStatus }) => ({ contractId: id, preparedAnalysisSource: analysisStatus === "synthetic_template" ? null : id, independentAnalysis: false, preparedIllustration: analysisStatus !== "synthetic_template" })),
      evidence: [
        { id: "account:catalog", excerpt: JSON.stringify(contracts), source_locator: "Prepared fictional Demo contract catalog" },
        ...analyses.flatMap((analysis) => analysis.evidence),
      ],
      limitations: ["Do not treat synthetic illustrations as independent real-world analyses or sum unlike currencies, periods or exposure categories. Navigation templates have no evidence. No real aircraft/flight or customer records are available."] };
  }
  if (!contexts.has(analysisRunId)) throw reject();
  return structuredClone(contexts.get(analysisRunId));
}
