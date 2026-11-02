// Update these reviewed facts alongside the referenced routes and readiness documents.
export const OPERION_KNOWLEDGE_VERSION = "2026-11-02-platform-v2";
export const OPERION_PLATFORM_KNOWLEDGE = [
  { id: "platform:purpose", title: "Operion and OCI", status: "implemented", page: "dashboard", path: "/dashboard", permission: "contract:read",
    description: "Operion is aviation Contract Intelligence first: review contract requirements, obligations, deadlines, risks and supporting evidence. OCI means Contract Intelligence Core. Human review is required; Operion is not legal advice or a generic contract repository.",
    workflow: "Start at Dashboard, choose Contracts, select an authorized agreement and inspect its workspace.",
    sources: ["frontend/src/components/layout/ProductionLayout.jsx", "routes/analysisRunRoutes.js"] },
  { id: "platform:ingestion", title: "Upload, parsing and analysis", status: "configuration_required", page: "upload", path: "/upload", permission: "contract:write",
    description: "Authorized users can upload contract documents and use the existing ingestion/analysis pipeline. Parsing, source quality, supported formats and configured services constrain results. Complete OCR, translation and amendment reconciliation are not guaranteed. Matt does not start extraction or upload documents.",
    workflow: "Use Upload with contract-write permission. Review document versions and the existing analysis in Contracts. Analysis requires contract-analyze permission and configured services/budget.",
    sources: ["routes/documentRoutes.js", "services/documentIngestionService.js", "middleware/authorizationMiddleware.js"] },
  { id: "platform:findings", title: "Clauses, obligations, deadlines and risks", status: "implemented", page: "contracts", path: "/contracts", permission: "contract:read",
    description: "Contract workspaces expose canonical OCI clauses, obligations, deadlines, risk findings and evidence. Conditional deadlines require their trigger dates and calendar rules; a relative expression does not establish an overdue event. Missing findings do not establish absence of risk.",
    workflow: "Select a contract, inspect clauses, obligations, deadlines and risks, then open the source evidence before deciding.",
    sources: ["routes/analysisRunRoutes.js", "frontend/src/routes/Matt.jsx"] },
  { id: "platform:search", title: "Search and summaries", status: "implemented", page: "intelligence", path: "/contracts", permission: "contract:read",
    description: "Matt can explain selected canonical findings and source excerpts. Its current search path is organization-and-analysis-scoped PostgreSQL text search, not a verified semantic/vector retrieval path. No unscoped embedding memory is used by Matt. Generated interpretation requires model configuration and budget.",
    workflow: "Choose an authorized analyzed contract and ask a question; inspect cited sources and limitations.",
    sources: ["repositories/phase3/searchChunkRepository.js", "services/mattAnswerService.js"] },
  { id: "platform:exposure", title: "Financial impact and recommendations", status: "implemented", page: "contracts", path: "/contracts", permission: "contract:read",
    description: "Existing OCI financial-impact calculations can be explained where inputs are available. Missing amounts, triggers or attribution must remain unknown. Prepared Demo amounts are fictional assumptions, not customer exposure, invoices or measured savings. Recommendations are review suggestions; Matt does not send notices, approve actions or change records.",
    workflow: "Inspect Financial Impact and its underlying clauses, assumptions and evidence. Ask for clarification, not automatic execution.",
    sources: ["services/phase3/intelligence/financialImpactService.js", "frontend/src/components/matt/MattProposal.jsx"] },
  { id: "platform:aviation", title: "Aviation relationships and Globe", status: "demo_only", page: "globe", path: "/live-tracking", permission: "contract:read",
    description: "The Globe supplies twenty explicitly fictional flight/aircraft scenarios, scenario contracts, operational events and conditional legal-scope candidates. It is not verified live telemetry or a real aircraft ownership feed. SaaS Matt can explain authorized OCI aviation relationships, but arbitrary client flight objects are not trusted as evidence.",
    workflow: "In Demo select a Globe aircraft and Ask Matt about this flight. Verify the fictional-data notice. Scenario dates are not current observations. Hypothetical delay arithmetic and estimated exposure are assumptions, not verified liability. Historical or live claims require dated supplied evidence; missing telemetry, amounts or attribution remain unavailable. In SaaS inspect authorized aviation relationships in the contract analysis.",
    sources: ["shared/globeScenarioData.js", "routes/aviationRoutes.js", "routes/analysisRunRoutes.js"] },
  { id: "platform:reports", title: "Evidence and reports", status: "implemented", page: "reports", path: "/matt", permission: "contract:read",
    description: "Matt reports show the last completed response, findings, source evidence and limitations from the current authorized browser session. They are not globally retrievable reports or signed legal deliverables. Reports are cleared on account/permission changes; source ID validity alone does not establish answer accuracy.",
    workflow: "Inspect findings, open supporting evidence, and use the full response report. Return to the same conversation context.",
    sources: ["frontend/src/components/matt/mattSessions.js", "frontend/src/components/matt/MattSessionBoundary.jsx", "frontend/src/routes/Matt.jsx"] },
  { id: "platform:matt", title: "Matt voice and video", status: "configuration_required", page: "matt", path: "/matt", permission: "contract:read",
    description: "Demo and SaaS share one Matt session, reasoning, microphone and avatar architecture. Approved live mode uses browser speech or separately approved OpenAI Realtime input, Operion reasoning, and Tavus Text Echo/Daily synchronized output. The one-time introduction is prerecorded, not a live answer. Provider identity, fixed voice, privacy, budget and actual device acceptance remain required. Lip-sync, emotional delivery and persistent production Matt have not been verified.",
    workflow: "Open Ask Matt or the circular portrait, skip/watch the introduction, approve permitted processing, connect, then activate the microphone. If blocked, inspect the precise configuration error. Do not share confidential data in Demo.",
    sources: ["docs/MATT_EXTERNAL_ACTIVATION_CHECKLIST.md", "frontend/src/components/matt/useMattLive.js"] },
  { id: "platform:permissions", title: "Permissions and account boundaries", status: "implemented", page: "account", path: "/contracts", permission: "organization:read",
    description: "SaaS identity, active organization membership and contract-read permission are verified server-side for Matt data requests. An organization selector is not authority by itself. Platform Super Admin does not automatically grant Matt access to customer contracts. Demo capabilities grant only prepared-data Matt access, never customer or administrative access.",
    workflow: "Select an active organization and wait for permission verification. If access fails, ask your organization administrator; do not bypass the gate.",
    sources: ["middleware/organizationMiddleware.js", "middleware/authorizationMiddleware.js", "routes/mattDemoRoutes.js"] },
  { id: "platform:roadmap", title: "Prediction, simulation and external knowledge", status: "roadmap", page: "intelligence", path: "/contracts", permission: "contract:read",
    description: "Predictive Risk Intelligence and general Scenario Simulation are not accepted as verified production capabilities. Prepared scenario arithmetic and risk review are not predictive models. Matt does not have a general live-web research tool; public aviation knowledge must have explicit supplied sources, not invented current facts. No measured accuracy, ROI, security certification or confidential paid-pilot readiness is established.",
    workflow: "Ask what source and implementation status supports a capability. Treat missing data as unavailable and future functionality as roadmap.",
    sources: ["docs/MATT_REALTIME_ARCHITECTURE_ASSESSMENT.md", "docs/MATT_EXTERNAL_ACTIVATION_CHECKLIST.md"] },
];

export const MATT_CONTEXT_MODES = ["analysis", "account", "platform"];
export const MATT_PAGE_IDS = ["dashboard", "contracts", "upload", "intelligence", "globe", "reports", "matt", "account"];
export function mattPageId(pathname) {
  if (/\/live-tracking|\/aviation/.test(pathname)) return "globe";
  if (/\/matt\/report/.test(pathname)) return "reports";
  return MATT_PAGE_IDS.find((id) => pathname.startsWith(`/demo/${id}`) || pathname.startsWith(`/app/${id}`)) || "matt";
}

export function readOperionPlatformKnowledge({ demo = false } = {}) {
  return {
    version: OPERION_KNOWLEDGE_VERSION,
    features: structuredClone(OPERION_PLATFORM_KNOWLEDGE).map((item) => ({ ...item, path: `${demo ? "/demo" : "/app"}${item.path}` })),
    evidence: OPERION_PLATFORM_KNOWLEDGE.map((item) => ({
      id: item.id, excerpt: `${item.title}. Status: ${item.status}. ${item.description} Workflow: ${item.workflow} Permission: ${item.permission}.`,
      source_locator: `Reviewed Operion implementation ${OPERION_KNOWLEDGE_VERSION}: ${item.sources.join(", ")}`,
    })),
  };
}
