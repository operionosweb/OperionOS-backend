import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import EvidencePanel from "../components/intelligence/EvidencePanel";
import ContractAssistantPanel from "../components/intelligence/ContractAssistantPanel";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import FinancialImpactSection from "../components/intelligence/FinancialImpactSection";
import AviationContractCoreSection from "../components/intelligence/AviationContractCoreSection";
import ObligationFulfilmentReview from "../components/intelligence/ObligationFulfilmentReview";
import AviationLeaseRiskAssessment from "../components/intelligence/AviationLeaseRiskAssessment";
import AviationExternalRiskIntelligence from "../components/intelligence/AviationExternalRiskIntelligence";
import AviationEventImpactPanel from "../components/intelligence/AviationEventImpactPanel";
import AviationRedeliveryIntelligence from "../components/intelligence/AviationRedeliveryIntelligence";
import PortfolioContractAssistantPanel from "../components/intelligence/PortfolioContractAssistantPanel";
import OrganizationGate from "../components/demo/OrganizationGate";
import { useOrganization } from "../context/OrganizationContext";
import { ORGANIZATION_PERMISSIONS } from "../lib/permissions";
import { getContractClassificationPresentation } from "../lib/contractPresentation";
import {
  getContract,
  listContractDocuments,
  listDocumentVersions,
  getDocumentStructure,
  getAnalysisRun,
  processContractIntelligence,
  getAnalysisRunProfile,
  getAnalysisRunFinancialImpact,
  getAnalysisRunRoleIntelligence,
  listAnalysisRunRelationships,
  searchContractIntelligence,
  listAnalysisRunClauses,
  compareAnalysisRuns,
  listAnalysisRunObligations,
  listAnalysisRunDeadlines,
  listAnalysisRunRisks,
  listAnalysisRunEvidence,
  getObligationEstimate,
  getRiskEstimate,
  analyzeObligations,
  analyzeDeadlines,
  analyzeRisks,
} from "../lib/contractsApi";
import {
  CONTRACT_INTELLIGENCE_HIERARCHY,
  INTELLIGENCE_AVAILABILITY,
  deriveAvailabilityState,
  resolveContractWorkspaceAnalysisRunId,
} from "../lib/contractIntelligenceModel";

const INTELLIGENCE_SECTIONS = CONTRACT_INTELLIGENCE_HIERARCHY
  .filter((node) => ["clauses", "obligations", "deadlines", "risks", "evidence", "recommendations"].includes(node.id))
  .map((node) => ({
    key: node.id,
    label: node.label,
    finding: node.type.charAt(0).toUpperCase() + node.type.slice(1),
    state: deriveAvailabilityState({ isExposed: false }),
    note: "No read endpoint is exposed for this layer in current frontend boundaries.",
  }));

const WORKSPACE_SECTIONS = Object.freeze({
  overview: "Overview",
  relationships: "Parties & Aircraft",
  redelivery: "Redelivery",
  "commercial-terms": "Commercial Terms",
  obligations: "Obligations",
  deadlines: "Key Dates",
  "financial-impact": "Financial Exposure",
  risks: "Risks",
  "missing-terms": "Missing / Unclear",
  actions: "Actions",
  evidence: "Evidence",
  assistant: "Ask Matt",
  clauses: "Clauses",
  search: "Search",
});

const PROCESSING_STAGES = {
  queued: ["Document received", "Ready to build Contract Intelligence."],
  processing: ["Validating document", "Confirming the secure document source and analysis scope."],
  extracting: ["Identifying clauses", "Reading contract structure and preserving source evidence."],
  analysing: ["Extracting contract intelligence", "Building obligations, deadlines, risks and the contract summary."],
  indexing: ["Building searchable intelligence", "Preparing evidence-backed search across the contract."],
  completed: ["Contract Intelligence ready", "Review the summary, risks, obligations, deadlines and source evidence below."],
  failed: ["Analysis needs attention", "The previous processing attempt did not complete. You can retry safely."],
};

function formatDeadlineTiming(deadline) {
  if (deadline.absolute_date) {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${deadline.absolute_date}T00:00:00.000Z`));
  }
  if (deadline.computability === "non_computable") {
    return `${deadline.timing_expression || "Contractual timing"} - no calculable date was established`;
  }
  if (deadline.deadline_type === "ambiguous" || deadline.computability === "ambiguous") {
    return `${deadline.timing_expression || "Contractual timing"} - exact timing requires human review`;
  }
  if (deadline.amount && deadline.unit) {
    const unit = deadline.unit.replaceAll("_", " ");
    return `${deadline.amount} ${unit} ${deadline.direction || "after"}${deadline.anchor_reference ? ` ${deadline.anchor_reference}` : ""}`;
  }
  if (deadline.deadline_type === "event_based") return `${deadline.direction === "upon" ? "Upon" : deadline.direction || "Upon"} ${deadline.anchor_reference || deadline.trigger_expression || "event"}`;
  if (deadline.recurrence?.frequency) return deadline.recurrence.frequency.replaceAll("_", " ");
  return deadline.timing_expression || "Timing not computable";
}

function formatDeadlineMonitoring(monitoring) {
  if (!monitoring) return null;
  switch (monitoring.status) {
    case "passed":
      return `Date passed ${Math.abs(monitoring.daysRemaining)} day${Math.abs(monitoring.daysRemaining) === 1 ? "" : "s"} ago`;
    case "due_today":
      return "Date is today";
    case "approaching":
      return `${monitoring.daysRemaining} day${monitoring.daysRemaining === 1 ? "" : "s"} remaining`;
    case "scheduled":
      return `${monitoring.daysRemaining} days remaining`;
    case "awaiting_condition":
      return "Awaiting condition confirmation";
    case "awaiting_trigger":
      return "Awaiting trigger date";
    case "unresolved":
      return "Timing could not be calculated";
    case "unverified_date":
      return "Date requires verification";
    case "excluded":
      return "Excluded after review";
    default:
      return "No calculated date";
  }
}

function formatIntelligenceLabel(value) {
  return value ? String(value).replaceAll("_", " ").toLowerCase() : "Not established";
}

function getFindingReviewLabel(item, incomplete = false) {
  const confidence = Number(item?.confidence);
  if (
    incomplete
    || item?.review_status === "requires_review"
    || item?.status === "requires_review"
    || Number.isFinite(confidence) && confidence < 0.85
  ) {
    return "Human review required";
  }
  if (["verified", "reviewed", "approved", "confirmed"].includes(item?.review_status)) return "Reviewed";
  return "Evidence review pending";
}

function formatFinancialAmount(amount, currency) {
  if (!Number.isFinite(amount) || !currency) return "Not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

const NOT_ESTABLISHED = "Not established from the contract.";

function formatCommercialTerm(term) {
  const value = term?.value || {};
  if (Number.isFinite(value.amount) && value.currency) {
    const amount = formatFinancialAmount(value.amount, value.currency);
    return `${amount}${value.frequency ? ` / ${value.frequency}` : value.unit ? ` / ${String(value.unit).replaceAll("_", " ")}` : ""}`;
  }
  if (Number.isFinite(value.ratePercent)) return `${value.ratePercent}% - ${value.formula || "contractual adjustment formula"}`;
  if (value.rate && Number.isFinite(value.rate.amount)) return `${formatFinancialAmount(value.rate.amount, value.rate.currency)} / ${String(value.rate.unit || "stated unit").replaceAll("_", " ")}`;
  return typeof value === "string" ? value : NOT_ESTABLISHED;
}

function normalizeProfileEvidence(items = []) {
  return items.map((item) => ({
    id: item.evidenceId,
    clause_id: item.clauseId,
    excerpt: item.evidenceText || item.source?.excerpt,
    source_locator: item.sourceLocation || item.source?.source_locator,
    page_number: item.pageNumber || item.source?.page_number,
  }));
}

function evidenceBackedRecommendations(items = [], clauses = []) {
  if (!Array.isArray(items)) return [];
  const clausesById = new Map(clauses
    .filter((clause) => clause && typeof clause === "object" && clause.id)
    .map((clause) => [clause.id, clause]));
  return items.map((item) => {
    if (!item || typeof item !== "object") return null;
    const evidence = (Array.isArray(item.evidence) ? item.evidence : []).filter((source) => {
      if (!source || typeof source !== "object") return false;
      const clause = clausesById.get(source.clauseId);
      if (!clause || typeof source.evidenceText !== "string" || !source.evidenceText.trim()) return false;
      const clauseText = String(clause.source_text || "").replace(/\s+/g, " ").trim();
      const excerpt = source.evidenceText.replace(/\s+/g, " ").trim();
      return clauseText.includes(excerpt);
    });
    return { ...item, evidence };
  }).filter((item) => item && item.evidence.length > 0);
}

const RECOMMENDATION_CATEGORY_LABELS = Object.freeze({
  contractual_protection: "Contractual protection",
  commercial_protection: "Commercial protection",
  operational_protection: "Aviation operations",
  deadline_obligation_management: "Deadline and obligation",
  negotiation_intelligence: "Negotiation review",
});

function formatComparisonSource(candidate) {
  return `${candidate.documentName} · version ${candidate.documentVersionNumber} · source created ${candidate.sourceCreatedAt
    ? new Date(candidate.sourceCreatedAt).toLocaleDateString()
    : "date unavailable"}`;
}

export default function ContractDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const requestedAnalysisRunId = searchParams.get("analysisRunId") || "";
  const organization = useOrganization();
  const { organizationId } = organization;

  return <OrganizationGate><ContractWorkspace
    contractId={id}
    organizationId={organizationId}
    requestedAnalysisRunId={requestedAnalysisRunId}
    canAnalyze={organization.hasOrganizationPermission(ORGANIZATION_PERMISSIONS.CONTRACT_ANALYZE)}
    canReview={organization.hasOrganizationPermission(ORGANIZATION_PERMISSIONS.CONTRACT_WRITE)}
  /></OrganizationGate>;
}

function ContractWorkspace({ contractId, organizationId, requestedAnalysisRunId, canAnalyze, canReview }) {
  const [state, setState] = useState("loading");
  const [contract, setContract] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocumentVersion, setActiveDocumentVersion] = useState(null);
  const [structure, setStructure] = useState({ pages: [], sections: [], chunks: [] });
  const [latestExtractionStatus, setLatestExtractionStatus] = useState(null);
  const [analysisRun, setAnalysisRun] = useState(null);
  const [comparisonSources, setComparisonSources] = useState([]);
  const [comparisonSourcesState, setComparisonSourcesState] = useState("loading");
  const [comparisonSourcesError, setComparisonSourcesError] = useState("");
  const [sourceAAnalysisRunId, setSourceAAnalysisRunId] = useState("");
  const [sourceBAnalysisRunId, setSourceBAnalysisRunId] = useState("");
  const [changeComparison, setChangeComparison] = useState(null);
  const [changeComparisonState, setChangeComparisonState] = useState("idle");
  const [changeComparisonError, setChangeComparisonError] = useState("");
  const [clauses, setClauses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [risks, setRisks] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [profile, setProfile] = useState(null);
  const [roleIntelligence, setRoleIntelligence] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [financialImpact, setFinancialImpact] = useState(null);
  const [financialImpactState, setFinancialImpactState] = useState("loading");
  const [aviationLeaseAssessment, setAviationLeaseAssessment] = useState(null);
  const [processingState, setProcessingState] = useState("idle");
  const [processingStatusError, setProcessingStatusError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const [obligationEstimate, setObligationEstimate] = useState(null);
  const [riskEstimate, setRiskEstimate] = useState(null);
  const [obligationAnalysisState, setObligationAnalysisState] = useState("idle");
  const [deadlineAnalysisState, setDeadlineAnalysisState] = useState("idle");
  const [riskAnalysisState, setRiskAnalysisState] = useState("idle");
  const [includeSemanticReview, setIncludeSemanticReview] = useState(false);
  const [riskFilters, setRiskFilters] = useState({ category: "all", severity: "all", confidence: "all", status: "all" });
  const [errorMessage, setErrorMessage] = useState("");
  const [activeAnalysisRunId, setActiveAnalysisRunId] = useState(() => {
    try {
      return localStorage.getItem(`operion.activeAnalysisRunId.${contractId}`) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setLatestExtractionStatus(null);
    setActiveDocumentVersion(null);
    setAviationLeaseAssessment(null);

    Promise.all([
      getContract(contractId, organizationId),
      listContractDocuments(contractId, organizationId),
    ])
      .then(async ([contractResult, documentsResult]) => {
        if (cancelled) return;

        const nextDocuments = documentsResult?.documents || [];
        setContract(contractResult?.contract || null);
        setDocuments(nextDocuments);

        const latestDocument = nextDocuments[0];
        let selectedDocument = latestDocument;
        let selectedVersion = null;
        let requestedAnalysisRun = null;
        let storedAnalysisRunId = "";

        try {
          storedAnalysisRunId = localStorage.getItem(`operion.activeAnalysisRunId.${contractId}`) || "";
        } catch {
          storedAnalysisRunId = "";
        }
        let nextAnalysisRunId = resolveContractWorkspaceAnalysisRunId({
          hasLatestDocument: Boolean(latestDocument),
          storedRunId: storedAnalysisRunId,
        });

        if (requestedAnalysisRunId) {
          const requestedRunResult = await getAnalysisRun(requestedAnalysisRunId, organizationId);
          requestedAnalysisRun = requestedRunResult?.analysisRun;
          if (!requestedAnalysisRun || requestedAnalysisRun.contract_id !== contractId || requestedAnalysisRun.status !== "completed") {
            throw new Error("The requested source analysis is unavailable for this contract.");
          }
          const versionGroups = await Promise.all(nextDocuments.map(async (document) => ({
            document,
            versions: (await listDocumentVersions(document.id, organizationId))?.versions || [],
          })));
          const selectedSource = versionGroups
            .flatMap(({ document, versions }) => versions.map((version) => ({ document, version })))
            .find(({ version }) => version.id === requestedAnalysisRun.document_version_id);
          if (!selectedSource) {
            throw new Error("The requested source version is unavailable for this contract.");
          }
          selectedDocument = selectedSource.document;
          selectedVersion = selectedSource.version;
          nextAnalysisRunId = requestedAnalysisRunId;
        }

        if (!selectedDocument && !nextAnalysisRunId) {
          setLatestExtractionStatus(null);
          setState("ready");
          return;
        }

        if (selectedDocument) {
          try {
            const structureResult = await getDocumentStructure(selectedDocument.id, organizationId);
            if (cancelled) return;
            if (!requestedAnalysisRunId) {
              const versionsResult = await listDocumentVersions(selectedDocument.id, organizationId);
              selectedVersion = versionsResult?.versions?.[0] || null;
            }
            if (cancelled) return;
            setActiveDocumentVersion(selectedVersion);
            setLatestExtractionStatus(selectedVersion?.extraction_status || null);
            setStructure({
              pages: structureResult?.pages || [],
              sections: structureResult?.sections || [],
              chunks: structureResult?.chunks || [],
            });
            if (!requestedAnalysisRunId) {
              nextAnalysisRunId = resolveContractWorkspaceAnalysisRunId({
                hasLatestDocument: true,
                latestVersion: selectedVersion,
                storedRunId: storedAnalysisRunId,
              });
            }
          } catch (error) {
            if (cancelled) return;
            setErrorMessage(error.message || "The selected document and version could not be verified.");
            setState("error");
            return;
          }
        }

        setActiveAnalysisRunId(nextAnalysisRunId);

        if (!nextAnalysisRunId) {
          setAnalysisRun(null);
          setClauses([]);
          setObligations([]);
          setDeadlines([]);
          setRisks([]);
          setRoleIntelligence(null);
          setRelationships([]);
          setFinancialImpact(null);
          setFinancialImpactState("ready");
          setAviationLeaseAssessment(null);
          setState("ready");
          return;
        }

        Promise.all([
          requestedAnalysisRun
            ? Promise.resolve({ analysisRun: requestedAnalysisRun })
            : getAnalysisRun(nextAnalysisRunId, organizationId),
          listAnalysisRunClauses(nextAnalysisRunId, organizationId),
          listAnalysisRunObligations(nextAnalysisRunId, organizationId),
          listAnalysisRunDeadlines(nextAnalysisRunId, organizationId),
          listAnalysisRunRisks(nextAnalysisRunId, organizationId),
          listAnalysisRunEvidence(nextAnalysisRunId, organizationId),
          getAnalysisRunProfile(nextAnalysisRunId, organizationId).catch(() => null),
          listAnalysisRunRelationships(nextAnalysisRunId, organizationId).catch(() => ({ relationships: [] })),
          getAnalysisRunFinancialImpact(nextAnalysisRunId, organizationId).catch(() => null),
          getAnalysisRunRoleIntelligence(nextAnalysisRunId, organizationId).catch(() => null),
        ])
          .then(([analysisRunResult, clausesResult, obligationsResult, deadlinesResult, risksResult, evidenceResult, profileResult, relationshipsResult, financialImpactResult, roleIntelligenceResult]) => {
            if (cancelled) return;
            const nextRoleIntelligence = roleIntelligenceResult?.intelligence || null;
            const nextFinancialImpact = nextRoleIntelligence?.financialImpact || financialImpactResult?.financialImpact || null;
            setAnalysisRun(analysisRunResult?.analysisRun || null);
            setClauses(clausesResult?.clauses || []);
            setObligations(nextRoleIntelligence?.obligations || obligationsResult?.obligations || []);
            setDeadlines(nextRoleIntelligence?.deadlines || deadlinesResult?.deadlines || []);
            setRisks(nextRoleIntelligence?.risks || risksResult?.risks || []);
            setEvidence(evidenceResult?.evidence || []);
            setProfile(profileResult?.profile || null);
            setRoleIntelligence(nextRoleIntelligence);
            setRelationships(relationshipsResult?.relationships || []);
            setFinancialImpact(nextFinancialImpact);
            setFinancialImpactState(nextFinancialImpact ? "ready" : "unavailable");
            setState("ready");
          })
          .catch((error) => {
            if (cancelled) return;
            setErrorMessage(error.message || "Analysis intelligence could not be loaded.");
            setAnalysisRun(null);
            setClauses([]);
            setObligations([]);
            setDeadlines([]);
            setRisks([]);
            setEvidence([]);
            setProfile(null);
            setRoleIntelligence(null);
            setRelationships([]);
            setFinancialImpact(null);
            setFinancialImpactState("unavailable");
            setAviationLeaseAssessment(null);
            setState("error");
          });
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [contractId, organizationId, requestedAnalysisRunId]);

  useEffect(() => {
    if (state !== "ready" || !requestedAnalysisRunId || !window.location.hash) return;
    const sourceElement = document.getElementById(window.location.hash.slice(1));
    sourceElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state, requestedAnalysisRunId, clauses]);

  useEffect(() => {
    if (state !== "ready") return undefined;
    let cancelled = false;
    setComparisonSourcesState("loading");
    setComparisonSourcesError("");
    setChangeComparison(null);
    setChangeComparisonState("idle");
    setSourceAAnalysisRunId("");
    setSourceBAnalysisRunId("");
    if (!documents.length) {
      setComparisonSources([]);
      setComparisonSourcesState("ready");
      return undefined;
    }

    Promise.all(documents.map(async (document) => {
      const result = await listDocumentVersions(document.id, organizationId);
      return (result?.versions || [])
        .filter((version) => version.extraction_status === "completed"
          && version.analysis_run_status === "completed"
          && version.analysis_run_id)
        .map((version) => ({
          analysisRunId: version.analysis_run_id,
          sourceCreatedAt: version.created_at,
          documentId: document.id,
          documentName: document.filename || "Untitled document",
          documentVersionId: version.id,
          documentVersionNumber: version.version_number,
        }));
    }))
      .then((sourceGroups) => {
        if (cancelled) return;
        const uniqueSources = [...new Map(sourceGroups.flat().map((source) => [source.analysisRunId, source])).values()];
        setComparisonSources(uniqueSources);
        setComparisonSourcesState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setComparisonSources([]);
        setComparisonSourcesError(error.message || "Completed contract analyses could not be loaded.");
        setComparisonSourcesState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [documents, organizationId, state]);

  useEffect(() => {
    if (processingState !== "processing" || !activeAnalysisRunId) return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      getAnalysisRun(activeAnalysisRunId, organizationId)
        .then((result) => {
          if (cancelled) return;
          setAnalysisRun(result?.analysisRun || null);
          setProcessingStatusError("");
        })
        .catch((error) => {
          if (!cancelled) {
            setProcessingStatusError(error.message || "Processing status could not be refreshed.");
          }
        });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [processingState, activeAnalysisRunId, organizationId]);

  async function handleFullProcessing() {
    if (!analysisRun?.id || latestExtractionStatus !== "completed") return;
    setProcessingState("processing");
    setProcessingStatusError("");
    setErrorMessage("");
    try {
      await processContractIntelligence(analysisRun.id, organizationId);
      const financialImpactLoad = getAnalysisRunFinancialImpact(analysisRun.id, organizationId)
        .then((result) => ({ result, error: null }))
        .catch((error) => ({ result: null, error }));
      const [runResult, clausesResult, obligationsResult, deadlinesResult, risksResult, evidenceResult, profileResult, relationshipsResult, financialImpactResult] = await Promise.all([
        getAnalysisRun(analysisRun.id, organizationId),
        listAnalysisRunClauses(analysisRun.id, organizationId),
        listAnalysisRunObligations(analysisRun.id, organizationId),
        listAnalysisRunDeadlines(analysisRun.id, organizationId),
        listAnalysisRunRisks(analysisRun.id, organizationId),
        listAnalysisRunEvidence(analysisRun.id, organizationId),
        getAnalysisRunProfile(analysisRun.id, organizationId),
        listAnalysisRunRelationships(analysisRun.id, organizationId),
        financialImpactLoad,
      ]);
      setAnalysisRun(runResult?.analysisRun || null);
      setClauses(clausesResult?.clauses || []);
      setObligations(obligationsResult?.obligations || []);
      setDeadlines(deadlinesResult?.deadlines || []);
      setRisks(risksResult?.risks || []);
      setEvidence(evidenceResult?.evidence || []);
      setProfile(profileResult?.profile || null);
      setRelationships(relationshipsResult?.relationships || []);
      setFinancialImpact(financialImpactResult.result?.financialImpact || null);
      setFinancialImpactState(financialImpactResult.error ? "unavailable" : "ready");
      setProcessingStatusError("");
      setProcessingState("ready");
    } catch (error) {
      setErrorMessage(error.message || "Contract intelligence processing failed.");
      setProcessingState("error");
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!analysisRun?.id || !searchQuery.trim()) return;
    setSearchState("loading");
    try {
      const result = await searchContractIntelligence(analysisRun.id, organizationId, searchQuery.trim());
      setSearchResults(result?.results || []);
      setSearchState("ready");
    } catch (error) {
      setErrorMessage(error.message || "Contract search failed.");
      setSearchState("error");
    }
  }

  async function handleChangeComparison(event) {
    event.preventDefault();
    if (!sourceAAnalysisRunId || !sourceBAnalysisRunId || sourceAAnalysisRunId === sourceBAnalysisRunId) return;
    setChangeComparisonState("loading");
    setChangeComparisonError("");
    setChangeComparison(null);
    try {
      const result = await compareAnalysisRuns(sourceAAnalysisRunId, sourceBAnalysisRunId, organizationId);
      setChangeComparison(result?.comparison || null);
      setChangeComparisonState("ready");
    } catch (error) {
      setChangeComparisonError(error.message || "The selected analyses could not be compared.");
      setChangeComparisonState("error");
    }
  }

  useEffect(() => {
    if (!analysisRun?.id || obligations.length) return undefined;
    let cancelled = false;
    getObligationEstimate(analysisRun.id, organizationId)
      .then((result) => {
        if (!cancelled) setObligationEstimate(result);
      })
      .catch(() => {
        if (!cancelled) setObligationEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisRun, organizationId, obligations.length]);

  useEffect(() => {
    if (!analysisRun?.id || risks.length || !includeSemanticReview) return undefined;
    let cancelled = false;
    getRiskEstimate(analysisRun.id, organizationId)
      .then((result) => {
        if (!cancelled) setRiskEstimate(result);
      })
      .catch(() => {
        if (!cancelled) setRiskEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisRun, organizationId, risks.length, includeSemanticReview]);

  async function handleObligationAnalysis() {
    if (!analysisRun?.id) return;
    setObligationAnalysisState("processing");
    try {
      const result = await analyzeObligations(analysisRun.id, organizationId);
      setObligations(result?.obligations || []);
      setObligationAnalysisState("ready");
    } catch (error) {
      setErrorMessage(error.message || "Obligation analysis could not be completed.");
      setObligationAnalysisState("error");
    }
  }

  async function handleDeadlineAnalysis() {
    if (!analysisRun?.id) return;
    setDeadlineAnalysisState("processing");
    try {
      const result = await analyzeDeadlines(analysisRun.id, organizationId);
      setDeadlines(result?.deadlines || []);
      setDeadlineAnalysisState("ready");
    } catch (error) {
      setErrorMessage(error.message || "Deadline intelligence could not be built.");
      setDeadlineAnalysisState("error");
    }
  }

  async function handleRiskAnalysis() {
    if (!analysisRun?.id) return;
    setRiskAnalysisState("processing");
    try {
      const result = await analyzeRisks(analysisRun.id, organizationId, { useAIFallback: includeSemanticReview });
      setRisks(result?.risks || []);
      const financialImpactResult = await getAnalysisRunFinancialImpact(analysisRun.id, organizationId);
      setFinancialImpact(financialImpactResult?.financialImpact || null);
      setFinancialImpactState("ready");
      setRiskAnalysisState(result?.status === "partial_failure" ? "partial" : "ready");
    } catch (error) {
      setErrorMessage(error.message || "Contract risk intelligence could not be built.");
      setRiskAnalysisState("error");
    }
  }

  if (state === "loading") return <LoadingState label="Loading contract…" />;
  if (state === "error") return <ErrorState message={errorMessage} />;
  if (!contract) return <ErrorState message="Contract not found." />;

  const latestDocument = documents[0];
  const clauseAvailability = deriveAvailabilityState({
    isExposed: Boolean(activeAnalysisRunId),
    items: clauses,
  });
  const obligationAvailability = deriveAvailabilityState({
    isExposed: Boolean(activeAnalysisRunId),
    items: obligations,
  });
  const deadlineAvailability = deriveAvailabilityState({
    isExposed: Boolean(activeAnalysisRunId),
    items: deadlines,
  });
  const riskAvailability = deriveAvailabilityState({
    isExposed: Boolean(activeAnalysisRunId),
    items: risks,
  });
  const filteredRisks = risks.filter((risk) => {
    const confidence = Number(risk.confidence || 0);
    return (riskFilters.category === "all" || risk.risk_category === riskFilters.category)
      && (riskFilters.severity === "all" || risk.severity === riskFilters.severity)
      && (riskFilters.status === "all" || risk.status === riskFilters.status)
      && (riskFilters.confidence === "all"
        || riskFilters.confidence === "high" && confidence >= 0.85
        || riskFilters.confidence === "review" && confidence < 0.85);
  });
  const severityCounts = risks.reduce((counts, risk) => ({ ...counts, [risk.severity]: (counts[risk.severity] || 0) + 1 }), {});
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const keyRisks = [...risks].sort((left, right) => (severityOrder[left.severity] ?? 4) - (severityOrder[right.severity] ?? 4)).slice(0, 3);
  const parties = profile?.metadata?.parties || [];
  const aircraftIdentifiers = profile?.aircraft_identifiers || [];
  const assetIdentificationReview = profile?.metadata?.assetIdentificationReview || {};
  const profileRunId = profile?.analysis_run_id || profile?.analysisRunId;
  const recommendations = analysisRun?.id === activeAnalysisRunId
    && (!profileRunId || profileRunId === activeAnalysisRunId)
    ? evidenceBackedRecommendations(profile?.recommendations || [], clauses)
    : [];
  const leaseIntelligence = profile?.metadata?.leaseIntelligence || profile?.metadata?.lease_intelligence || {};
  const leaseLifecycleRelationships = leaseIntelligence.lifecycleRelationships || [];
  const keyCommercialTerms = profile?.key_commercial_terms || [];
  const operationalTerms = profile?.key_operational_terms || [];
  const missingTerms = profile?.unusual_or_missing_terms || [];
  const executiveSynthesis = profile?.metadata?.executiveSynthesis || {};
  const contractClassification = getContractClassificationPresentation(contract, profile);
  const workspaceSectionOrder = [...new Set([
    ...(roleIntelligence?.sectionOrder || []),
    ...Object.keys(WORKSPACE_SECTIONS),
  ])].filter((sectionId) => WORKSPACE_SECTIONS[sectionId]
    && (sectionId !== "redelivery" || Boolean(leaseIntelligence.redelivery)));
  const extractionBlocked = latestExtractionStatus !== "completed";
  const processingStage = extractionBlocked
    ? latestExtractionStatus === "requires_ocr"
      ? ["OCR required", "One or more pages could not be extracted. Contract analysis is blocked until document text extraction is complete."]
      : latestExtractionStatus
        ? ["Extraction incomplete", `Document extraction status is ${latestExtractionStatus}. Contract analysis is unavailable until extraction completes.`]
        : ["Extraction status unavailable", "Contract analysis is unavailable until the document's completed extraction status can be verified."]
    : PROCESSING_STAGES[analysisRun?.status] || ["Document structured", "Contract Intelligence has not started yet."];
  const financialActionsByRisk = new Map((financialImpact?.actions || []).map((action) => [action.riskId, action]));
  const partyEvidence = normalizeProfileEvidence([profile?.evidence_claims?.find((claim) => claim.field === "parties")?.evidence].filter(Boolean));
  const evidenceFor = (item) => {
    if (item.evidence?.length) return item.evidence;
    if (item.source_evidence_id) return evidence.filter((source) => source.id === item.source_evidence_id);
    const sourceText = String(item.source_text || clauses.find((clause) => clause.id === item.clause_id)?.source_text || "").toLowerCase();
    return evidence.filter((source) => sourceText && (sourceText.includes(String(source.excerpt || "").toLowerCase()) || String(source.excerpt || "").toLowerCase().includes(sourceText))).slice(0, 2);
  };

  return (
    <div className="op-workspace-page">
      <Reveal className="op-page-heading">
        <div><span className="op-page-kicker">Contract workspace</span>
        <h1>
          {contract.title}
        </h1>
        <p className={`op-contract-type-summary${contractClassification.isEstablished ? "" : " is-neutral"}`}>
          <strong>{contractClassification.type}</strong>
          {contractClassification.confidence && <span> · {contractClassification.confidence}</span>}
        </p>
        {contractClassification.reviewLabel && <p className="op-body-sm">{contractClassification.reviewLabel}. Confirm the type against the source contract before relying on it.</p>}
        <p>
          Status: {contract.status} · Created {new Date(contract.created_at).toLocaleDateString()}
        </p></div>
        <span className={`op-status-badge${contract.status ? "" : " is-neutral"}`}>{contract.status || "Status unavailable"}</span>
      </Reveal>

      {roleIntelligence && <Reveal className="op-page-heading" aria-label="Role-based intelligence summary">
        <div>
          <span className="op-page-kicker">{roleIntelligence.profile.roleName} intelligence</span>
          <h2>{roleIntelligence.summary.question}</h2>
          <p>{roleIntelligence.summary.headline}</p>
        </div>
        {roleIntelligence.alerts.length > 0 && <div aria-label="Priority alerts">
          {roleIntelligence.alerts.slice(0, 3).map((alert) => (
            <span key={alert.id} className="op-status-badge" style={{ marginInlineStart: "var(--op-space-2)" }}>
              {alert.rolePresentation?.headline || alert.title}
            </span>
          ))}
        </div>}
      </Reveal>}

      <nav aria-label="Contract intelligence" className="op-workspace-tabs">
        {workspaceSectionOrder.map((target) => (
          <a key={target} href={`#${target}`} className="op-btn op-btn-quiet">{WORKSPACE_SECTIONS[target]}</a>
        ))}
      </nav>

      <Reveal id="overview" className="op-flow-shell" style={{ marginBottom: "var(--op-space-7)", scrollMarginTop: 90 }}>
        <div className="op-flow-main">
          <div className="op-surface-plane-primary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Contract</p>
            <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>{contract.title}</h2>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-2)" }}>
              Status: {contract.status || "unknown"}
            </p>
            <p className="op-body-sm">
              Documents linked: {documents.length}
            </p>
          </div>

          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Documents</p>
            {!documents.length ? (
              <p className="op-body-sm">No documents are currently linked to this contract.</p>
            ) : (
              <div className="op-list-table">
                {documents.slice(0, 4).map((document) => (
                  <div key={document.id} className="op-list-row" style={{ gridTemplateColumns: "1fr auto" }}>
                    <span className="op-body-sm">{document.filename || "Untitled document"}</span>
                    <span className="op-badge">{document.status || "unknown"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Document structure</p>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              {latestExtractionStatus === "completed"
                ? "Document extraction completed. Review the source structure before Contract Intelligence analysis."
                : latestExtractionStatus === "requires_ocr"
                  ? "Some pages need successful OCR before this document can be analysed. The original upload is retained."
                  : latestExtractionStatus
                    ? `Document extraction is ${latestExtractionStatus}; Contract Intelligence is blocked until extraction completes.`
                    : "Completed document extraction could not be confirmed; Contract Intelligence remains unavailable."}
            </p>
            <div className="op-inspector-kv"><span className="op-body-sm">Pages</span><span className="op-body-sm">{structure.pages.length}</span></div>
            <div className="op-inspector-kv"><span className="op-body-sm">Sections</span><span className="op-body-sm">{structure.sections.length}</span></div>
            <div className="op-inspector-kv"><span className="op-body-sm">Chunks</span><span className="op-body-sm">{structure.chunks.length}</span></div>
          </div>

          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Contract Intelligence</p>
            <div className={`op-processing-state is-${analysisRun?.status || "unavailable"}`} role={processingState === "processing" ? "status" : undefined} aria-live="polite">
              <span>{processingStage[0]}</span>
              <p>{processingStage[1]}</p>
            </div>
            {processingStatusError && processingState === "processing" && <p className="op-body-sm" role="status" style={{ marginTop: "var(--op-space-3)" }}>
              {processingStatusError} Contract Intelligence processing continues; this status will retry automatically.
            </p>}
            {canAnalyze && analysisRun && analysisRun.status !== "completed" && latestExtractionStatus === "completed" && <Button type="button" variant="primary" onClick={handleFullProcessing} disabled={processingState === "processing"}>
              {processingState === "processing" ? processingStage[0] : analysisRun.status === "failed" ? "Retry analysis" : "Analyse contract"}
            </Button>}
            {processingState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
            {analysisRun?.status === "completed" && <Button to="#intelligence-summary" variant="secondary">Review intelligence</Button>}
          </div>
        </div>

        <div className="op-flow-rail">
          <div className="op-surface-inspector" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Hierarchy</p>
            <div className="op-hierarchy-rail">
              <div className="op-hierarchy-node op-hierarchy-node-active">
                <span className="op-kicker">Contract</span>
                <span className="op-body-sm">{contract.title}</span>
              </div>
              <span className="op-hierarchy-link">downstream</span>
              <div className="op-hierarchy-node">
                <span className="op-kicker">Documents</span>
                <span className="op-body-sm">{documents.length} linked item(s)</span>
              </div>
              <span className="op-hierarchy-link">downstream</span>
              <div className="op-hierarchy-node">
                <span className="op-kicker">Analysis / Intelligence</span>
                <span className="op-body-sm">
                  {latestDocument ? latestDocument.status || "status unknown" : "No document status available"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {profile && (
        <Reveal style={{ marginBottom: "var(--op-space-6)" }}>
          <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Contract profile</h2>
          <div className="op-surface-plane-primary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-body" style={{ marginBottom: "var(--op-space-4)" }}>{profile.executive_summary}</p>
            <div className="op-contract-profile-grid">
              <div><span className="op-kicker">Detected type</span><p className="op-body-sm">{contractClassification.type}</p>{contractClassification.reviewLabel && <p className="op-body-sm">{contractClassification.reviewLabel}</p>}</div>
              <div><span className="op-kicker">Contract number</span><p className="op-body-sm">{profile.metadata?.contractNumber || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Effective</span><p className="op-body-sm">{profile.metadata?.effectiveDate || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Executed</span><p className="op-body-sm">{profile.metadata?.executionDate || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Commencement</span><p className="op-body-sm">{profile.metadata?.commencementDate || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Expires</span><p className="op-body-sm">{profile.metadata?.expirationDate || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Renewal</span><p className="op-body-sm">{profile.metadata?.renewalDate || (profile.metadata?.autoRenewal === true ? "Automatic renewal identified" : NOT_ESTABLISHED)}</p></div>
              <div><span className="op-kicker">Governing law</span><p className="op-body-sm">{profile.metadata?.governingLaw || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Jurisdiction</span><p className="op-body-sm">{profile.metadata?.jurisdiction || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Currency</span><p className="op-body-sm">{profile.metadata?.currency || NOT_ESTABLISHED}</p></div>
              <div><span className="op-kicker">Confidence</span><p className="op-body-sm">{Math.round(Number(profile.confidence || 0) * 100)}%</p></div>
            </div>
            <div className="op-contract-context-grid">
              <section>
                <p className="op-kicker">Counterparties</p>
                {parties.length ? parties.map((party) => <p key={`${party.role}-${party.name}`} className="op-body-sm"><strong>{party.name}</strong> · {formatIntelligenceLabel(party.role)}</p>) : <p className="op-body-sm">Not established from contract evidence.</p>}
                {parties.length > 0 && <EvidencePanel findingLabel="Contract counterparties" evidence={partyEvidence} />}
              </section>
              <section>
                <p className="op-kicker">Affected aircraft / assets</p>
                {aircraftIdentifiers.length ? aircraftIdentifiers.map((identifier) => <div className="op-profile-identifier" key={`${identifier.type}-${identifier.value}`}><p className="op-body-sm"><strong>{identifier.value}</strong> · {formatIntelligenceLabel(identifier.type)}</p><EvidencePanel findingLabel={`${identifier.value} identifier`} evidence={normalizeProfileEvidence([identifier.evidence].filter(Boolean))} /></div>) : <p className="op-body-sm">No aircraft or engine identifier was established.</p>}
              </section>
            </div>
            {leaseLifecycleRelationships.length > 0 && (
              <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-4)" }}>
                <p className="op-kicker">Lease lifecycle relationships</p>
                {leaseLifecycleRelationships.map((relationship, index) => (
                  <article className="op-relationship-item" key={`${relationship.type}-${index}`}>
                    <div>
                      <strong className="op-body">Conditional extension option</strong>
                      <p className="op-body-sm">
                        {relationship.noticeDeadline
                          ? `Derived latest notice date: ${relationship.noticeDeadline}`
                          : `Notice deadline: ${NOT_ESTABLISHED}`}
                      </p>
                      <p className="op-body-sm">
                        {relationship.exerciseStatus === "not_established"
                          ? "Option exercise is not established by the available evidence."
                          : "Option exercise status requires review."}
                      </p>
                      {relationship.uncertainty && <p className="op-body-sm op-relationship-boundary">{relationship.uncertainty}</p>}
                    </div>
                    <EvidencePanel findingLabel="Extension option and related lease expiry" evidence={normalizeProfileEvidence(relationship.evidence || [])} />
                  </article>
                ))}
              </section>
            )}
            <div className="op-grid op-grid-3" style={{ marginTop: "var(--op-space-4)" }}>
              <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
                <p className="op-kicker">Material exposures</p>
                {executiveSynthesis.materialExposures?.length ? executiveSynthesis.materialExposures.slice(0, 3).map((item, index) => <button key={item.id || index} type="button" className="op-list-row" style={{ width: "100%", textAlign: "left" }} onClick={() => item.id && document.getElementById(`risk-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><span className="op-body-sm">{item.title}</span></button>) : <p className="op-body-sm">{NOT_ESTABLISHED}</p>}
              </section>
              <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
                <p className="op-kicker">Critical dates / triggers</p>
                {executiveSynthesis.criticalDates?.length ? executiveSynthesis.criticalDates.slice(0, 3).map((item, index) => <button key={item.id || index} type="button" className="op-list-row" style={{ width: "100%", textAlign: "left" }} onClick={() => item.id && document.getElementById(`deadline-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><span className="op-body-sm">{item.date || item.trigger || NOT_ESTABLISHED}</span></button>) : <p className="op-body-sm">{NOT_ESTABLISHED}</p>}
              </section>
              <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
                <p className="op-kicker">Recommended next actions</p>
                {executiveSynthesis.recommendedActions?.length ? executiveSynthesis.recommendedActions.slice(0, 3).map((item, index) => <button key={`${item.riskId || "action"}-${index}`} type="button" className="op-list-row" style={{ width: "100%", textAlign: "left" }} onClick={() => document.getElementById("actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="op-body-sm">{item.action}</span></button>) : <p className="op-body-sm">{NOT_ESTABLISHED}</p>}
              </section>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal id="commercial-terms" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Commercial terms and return exposure</h2>
        {!profile ? (
          <EmptyState title="Commercial terms unavailable" description="Complete the contract profile before reviewing evidence-backed lease economics." />
        ) : (
          <div className="op-grid op-grid-2">
            <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)" }}>
              <p className="op-kicker">Evidence-backed commercial terms</p>
              {!keyCommercialTerms.length ? <p className="op-body-sm">{NOT_ESTABLISHED}</p> : keyCommercialTerms.map((term, index) => (
                <article className="op-relationship-item" key={`${term.type || "term"}-${index}`}>
                  <div><strong className="op-body">{term.title || formatIntelligenceLabel(term.type)}</strong><p className="op-body-sm">{formatCommercialTerm(term)}</p></div>
                  <EvidencePanel findingLabel={term.title || "Commercial term"} evidence={normalizeProfileEvidence([term.evidence].filter(Boolean))} />
                </article>
              ))}
              {leaseIntelligence.commercialTerms?.baseRent && !profile.metadata?.expirationDate && <p className="op-body-sm op-relationship-boundary">Monthly rent established; total contractual rent exposure cannot be established from the available contract data.</p>}
            </section>
            <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
              <p className="op-kicker">Redelivery, insurance and operational conditions</p>
              {!operationalTerms.length ? <p className="op-body-sm">{NOT_ESTABLISHED}</p> : operationalTerms.map((term, index) => (
                <article className="op-relationship-item" key={`${term.category || "requirement"}-${index}`}>
                  <div><strong className="op-body">{formatIntelligenceLabel(term.category)}</strong><p className="op-body-sm">{term.requirement}</p>{term.important && <span className="op-status-badge">Important</span>}</div>
                  <EvidencePanel findingLabel={formatIntelligenceLabel(term.category)} evidence={normalizeProfileEvidence([term.evidence].filter(Boolean))} />
                </article>
              ))}
            </section>
          </div>
        )}
      </Reveal>

      {!!profile && (
        <Reveal style={{ marginBottom: "var(--op-space-5)" }}>
          <AviationContractCoreSection key={activeAnalysisRunId} core={profile.metadata?.aviationCore} />
        </Reveal>
      )}

      {analysisRun?.status === "completed" && (
        <Reveal id="search" style={{ marginBottom: "var(--op-space-6)", scrollMarginTop: 90 }}>
          <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Search this contract</h2>
          <form onSubmit={handleSearch} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
            <div style={{ display: "flex", gap: "var(--op-space-2)", alignItems: "end", flexWrap: "wrap" }}>
              <label className="op-body-sm" style={{ flex: "1 1 260px" }}>Contract text
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search termination, maintenance reserves, redelivery..." style={{ width: "100%" }} />
              </label>
              <Button type="submit" variant="primary" disabled={searchState === "loading"}>{searchState === "loading" ? "Searching…" : "Search"}</Button>
            </div>
            {searchState === "ready" && !searchResults.length && <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>No matching contract text was found.</p>}
            {!!searchResults.length && <div className="op-list-table" style={{ marginTop: "var(--op-space-4)" }}>{searchResults.map((result) => (
              <div key={result.id} className="op-list-row" style={{ gridTemplateColumns: "auto 1fr" }}>
                <span className="op-badge">{result.page_start ? `Page ${result.page_start}` : "Page unavailable"}</span>
                <span className="op-body-sm">{result.text_content}</span>
              </div>
            ))}</div>}
          </form>
        </Reveal>
      )}

      <Reveal id="assistant" style={{ marginBottom: "var(--op-space-6)", scrollMarginTop: 90 }}>
        <PortfolioContractAssistantPanel organizationId={organizationId} />
        <ContractAssistantPanel analysisRunId={analysisRun?.id} organizationId={organizationId} />
      </Reveal>

      <Reveal id="intelligence-summary" style={{ marginBottom: "var(--op-space-6)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Intelligence overview</h2>
        <div className="op-grid op-grid-3">
          <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
            <p className="op-body" style={{ marginBottom: 4 }}>Clauses</p>
            <IntelligenceStatus state={clauseAvailability} note={activeAnalysisRunId ? "Real clause data from the active analysis run." : "No active analysis run is selected for this contract."} />
          </div>
          <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
            <p className="op-body" style={{ marginBottom: 4 }}>Obligations</p>
            <IntelligenceStatus state={obligationAvailability} note={activeAnalysisRunId ? "Real obligation data from the active analysis run." : "No active analysis run is selected for this contract."} />
          </div>
          <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
            <p className="op-body" style={{ marginBottom: 4 }}>Deadlines</p>
            <IntelligenceStatus state={deadlineAvailability} note={activeAnalysisRunId ? "Deterministic temporal intelligence from the active analysis run." : "No active analysis run is selected for this contract."} />
          </div>
          <div className="op-surface" style={{ padding: "var(--op-space-4)" }}>
            <p className="op-body" style={{ marginBottom: 4 }}>Risks</p>
            <IntelligenceStatus state={riskAvailability} note={activeAnalysisRunId ? "Evidence-linked contractual exposure from the active analysis run." : "No active analysis run is selected for this contract."} />
          </div>
        </div>
        {activeAnalysisRunId && (
          <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-4)" }}>
            {[
              ["Key risks", keyRisks, "risk", (item) => `${item.severity || "unrated"} / ${item.title || item.risk_type}`],
              ["Key obligations", obligations.slice(0, 3), "obligation", (item) => [item.actor, item.action, item.object].filter(Boolean).join(" ") || item.description],
              ["Key deadlines", deadlines.slice(0, 3), "deadline", formatDeadlineTiming],
              ["Important clauses", clauses.slice(0, 3), "clause", (item) => `${item.clause_number || "Clause"} / ${item.title || item.category}`],
            ].map(([label, items, type, format]) => (
              <section key={label} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
                <p className="op-kicker" style={{ marginBottom: "var(--op-space-3)" }}>{label}</p>
                {!items.length ? <p className="op-body-sm">No records are available for this analysis run.</p> : items.map((item) => (
                  <button key={item.id} type="button" className="op-list-row" style={{ width: "100%", gridTemplateColumns: "1fr auto", textAlign: "left" }} onClick={() => document.getElementById(`${type}-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                    <span className="op-body-sm">{format(item)}</span>
                    <span className="op-body-sm">View</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal id="structure" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Structure</h2>
        {!structure.sections.length ? (
          <EmptyState title="No structural sections" description="The document has not produced structural records yet." />
        ) : (
          <div className="op-list-table">
            {structure.sections.map((section) => (
              <div key={section.id} className="op-list-row" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                <span className="op-body-sm">{section.metadata?.clause_number || section.section_order + 1}</span>
                <span className="op-body-sm">{section.heading || "Untitled section"}</span>
                <span className="op-badge">{section.parent_section_id ? "Subsection" : "Section"}</span>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal id="clauses" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Clauses</h2>
        <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
          <h3 className="op-heading-sm" style={{ marginBottom: "var(--op-space-2)" }}>Compare contract sources</h3>
          <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
            Compare two explicitly selected completed analyses. This identifies candidate text changes and linked intelligence for review; it does not determine amendment status, legal effect, or which source governs.
          </p>
          {comparisonSourcesState === "loading" ? (
            <LoadingState label="Loading completed analyses…" />
          ) : comparisonSourcesState === "error" ? (
            <ErrorState message={comparisonSourcesError} />
          ) : comparisonSources.length < 2 ? (
            <p className="op-body-sm">Two completed, extracted analyses for this contract are required before comparison is available.</p>
          ) : (
            <form onSubmit={handleChangeComparison}>
              <div className="op-grid op-grid-2" style={{ marginBottom: "var(--op-space-3)" }}>
                <label className="op-body-sm">Source A
                  <select value={sourceAAnalysisRunId} onChange={(event) => setSourceAAnalysisRunId(event.target.value)} required>
                    <option value="">Select a completed analysis</option>
                    {comparisonSources.map((source) => <option key={source.analysisRunId} value={source.analysisRunId}>{formatComparisonSource(source)}</option>)}
                  </select>
                </label>
                <label className="op-body-sm">Source B
                  <select value={sourceBAnalysisRunId} onChange={(event) => setSourceBAnalysisRunId(event.target.value)} required>
                    <option value="">Select a completed analysis</option>
                    {comparisonSources.map((source) => <option key={source.analysisRunId} value={source.analysisRunId}>{formatComparisonSource(source)}</option>)}
                  </select>
                </label>
              </div>
              <Button type="submit" variant="secondary" disabled={!sourceAAnalysisRunId || !sourceBAnalysisRunId || sourceAAnalysisRunId === sourceBAnalysisRunId || changeComparisonState === "loading"}>
                {changeComparisonState === "loading" ? "Comparing sources…" : "Compare selected sources"}
              </Button>
              {changeComparisonState === "error" && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{changeComparisonError}</p>}
            </form>
          )}
          {changeComparison && (
            <div style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-body-sm" role="status">
                Candidate comparison · {Object.entries(changeComparison.summary).map(([type, count]) => `${count} ${type.replaceAll("_", " ")}`).join(" · ") || "no matches"}
              </p>
              <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                Source A/B order is user-selected, not contractual chronology. Execution, effective date, legal applicability, and supersession status are unknown. No historical findings were changed.
              </p>
              <div className="op-list-table" style={{ marginTop: "var(--op-space-3)" }}>
                {changeComparison.changes.map((change, index) => (
                  <details key={`${change.type}-${change.original?.clauseId || "none"}-${change.comparison?.clauseId || "none"}-${index}`} className="op-list-row" style={{ display: "block", padding: "var(--op-space-3)" }}>
                    <summary className="op-body-sm" style={{ cursor: "pointer" }}>
                      <strong>{change.type.replaceAll("_", " ")}</strong>
                      {" · "}{change.original?.clauseNumber || change.comparison?.clauseNumber || "Clause identity unresolved"}
                      {" · "}{change.original?.title || change.comparison?.title || "Untitled clause"}
                      {change.financialTermReviewRequired ? " · financial term review" : ""}
                    </summary>
                    <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                      Impact review: {formatIntelligenceLabel(change.impactStatus)}. {change.type === "unchanged"
                        ? "The clause text matches; related intelligence has not been independently revalidated."
                        : "A source relationship or wording match is not proof that a finding is invalid or legally superseded."}
                    </p>
                    <div className="op-grid op-grid-2" style={{ marginTop: "var(--op-space-3)" }}>
                      {[["Source A", change.original], ["Source B", change.comparison]].map(([label, source]) => (
                        <section key={label} className="op-surface" style={{ padding: "var(--op-space-3)" }}>
                          <p className="op-kicker">{label}{source ? ` · ${source.category || "uncategorized"}` : " · no unique match"}</p>
                          {source && <>
                            <p className="op-body-sm">{source.text}</p>
                            {source.evidenceStatus === "missing" && <p className="op-body-sm" role="note">No linked page evidence is available for this clause; verify the source document manually.</p>}
                            {source.evidence.map((item) => <p key={item.id} className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                              {item.sourceLocator || (item.pageNumber ? `Page ${item.pageNumber}` : "Page unavailable")}: “{item.excerpt}”
                            </p>)}
                          </>}
                        </section>
                      ))}
                    </div>
                    {change.type !== "unchanged" && <div style={{ marginTop: "var(--op-space-3)" }}>
                      <p className="op-kicker">Existing findings to review</p>
                      {[["Source A", change.linkedIntelligence.original], ["Source B", change.linkedIntelligence.comparison]].map(([label, intelligence]) => (
                        <section key={label} style={{ marginTop: "var(--op-space-2)" }}>
                          <p className="op-body-sm">
                            {label}: {intelligence.obligations.length} linked obligations · {intelligence.deadlines.length} linked deadlines · {intelligence.risks.length} linked risk findings · {intelligence.financialAssessments.length} linked financial assessments · {intelligence.potentiallyRelatedDeadlines.length} potentially related term deadlines
                          </p>
                          {intelligence.obligations.map((item) => <p key={`obligation-${item.id}`} className="op-body-sm">Possible obligation impact requiring review: {item.description} ({formatIntelligenceLabel(item.status)}; {formatIntelligenceLabel(item.reviewStatus)}).</p>)}
                          {intelligence.deadlines.map((item) => <p key={`deadline-${item.id}`} className="op-body-sm">Linked deadline requiring review: {item.timingExpression || "Timing not established"}{item.absoluteDate ? ` · ${item.absoluteDate}` : ""} ({formatIntelligenceLabel(item.reviewStatus)}).</p>)}
                          {intelligence.risks.map((item) => <p key={`risk-${item.id}`} className="op-body-sm">Linked risk requiring review: {item.title} ({formatIntelligenceLabel(item.severity)}; {formatIntelligenceLabel(item.reviewStatus)}).</p>)}
                          {intelligence.financialAssessments.map((item) => <p key={`financial-${item.id}`} className="op-body-sm">Financial assessment requiring review: {item.description || item.category}{Number.isFinite(item.baseAmount) ? ` · ${formatFinancialAmount(item.baseAmount, item.currency)}${item.frequency ? ` / ${item.frequency}` : ""}` : " · amount not quantified"}. No assessment was recalculated.</p>)}
                          {intelligence.potentiallyRelatedDeadlines.map((item) => <div key={`possible-deadline-${item.id}`}>
                            <p className="op-body-sm">Potentially affected deadline requiring confirmation: {item.timingExpression || "Timing not established"}{item.absoluteDate ? ` · ${item.absoluteDate}` : ""}.</p>
                            {item.potentiallyAffectedObligations.map((obligation) => <p key={`possible-obligation-${obligation.id}`} className="op-body-sm">Possible dependent obligation: {obligation.description}.</p>)}
                            {item.potentiallyAffectedRisks.map((risk) => <p key={`possible-risk-${risk.id}`} className="op-body-sm">Possible dependent risk: {risk.title}.</p>)}
                          </div>)}
                          {change.financialTermReviewRequired && !intelligence.financialAssessments.length && <p className="op-body-sm">Financial term changed, but no linked financial assessment was available in this analysis.</p>}
                        </section>
                      ))}
                      <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>{change.recommendedAction}</p>
                    </div>}
                  </details>
                ))}
              </div>
              <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>{changeComparison.limitations.join(" ")}</p>
            </div>
          )}
        </section>
        {!activeAnalysisRunId ? (
          <EmptyState title="No active analysis run selected" description="This contract has no active run selected, so no clause records can be shown yet." />
        ) : clauseAvailability === INTELLIGENCE_AVAILABILITY.LOADING ? (
          <LoadingState label="Loading clauses…" />
        ) : !clauses.length ? (
          <EmptyState title="No clauses were returned for this analysis run." description="This means the active analysis run currently has no clause records." />
        ) : (
          <div className="op-list-table">
            {clauses.map((clause) => (
              <div id={`clause-${clause.id}`} key={clause.id} className="op-list-row" style={{ gridTemplateColumns: "1.2fr 1fr 1fr auto auto", scrollMarginTop: 90 }}>
                <span className="op-body-sm">{clause.clause_number || "Clause"}</span>
                <span className="op-body-sm">{clause.title || "Untitled clause"}</span>
                <span className="op-body-sm">{clause.category || "uncategorized"}</span>
                <div><span className="op-badge">{getFindingReviewLabel(clause)}</span>{clause.confidence != null && <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>{Math.round(clause.confidence * 100)}% confidence</p>}</div>
                <EvidencePanel findingLabel={clause.title || clause.clause_number || "Clause"} evidence={evidenceFor(clause)} />
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal id="obligations" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Obligations</h2>
        {analysisRun && !obligations.length && (
          <div className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              Extract actionable commitments from validated clauses using deterministic analysis. This consumes zero AI Intelligence Budget.
            </p>
            {obligationEstimate && <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>Estimated Intelligence Budget: {obligationEstimate.estimatedIntelligence} · Remaining: {obligationEstimate.budget?.remaining ?? "unknown"}</p>}
            {canAnalyze && <Button type="button" variant="primary" onClick={handleObligationAnalysis} disabled={obligationAnalysisState === "processing"}>
              {obligationAnalysisState === "processing" ? "Analysing obligations…" : "Analyse obligations"}
            </Button>}
            {obligationAnalysisState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
          </div>
        )}
        {!activeAnalysisRunId ? (
          <EmptyState title="No active analysis run selected" description="This contract has no active run selected, so no obligation records can be shown yet." />
        ) : obligationAvailability === INTELLIGENCE_AVAILABILITY.LOADING ? (
          <LoadingState label="Loading obligations…" />
        ) : !obligations.length ? (
          <EmptyState title="No obligations were returned for this analysis run." description="This means the active analysis run currently has no obligation records." />
        ) : (
          <div className="op-list-table">
            {obligations.map((obligation) => (
              <div id={`obligation-${obligation.id}`} key={obligation.id} className="op-list-row" style={{ gridTemplateColumns: "1.5fr 1fr 1fr auto auto", scrollMarginTop: 90 }}>
                <div><span className="op-body-sm">{obligation.description || "Untitled obligation"}</span><p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>{obligation.actor || "Actor unclear"} · {obligation.action || "Action unclear"} · {obligation.object || "Object unclear"}</p></div>
                <span className="op-body-sm">{obligation.obligation_type || "unspecified"}</span>
                <span className="op-body-sm">{obligation.timing_expression || obligation.frequency || "Timing not stated"}</span>
                <div><span className="op-badge">{getFindingReviewLabel(obligation, !obligation.actor || !obligation.action || !obligation.object)}</span>{obligation.confidence != null && <p className="op-body-sm" style={{ marginTop: "var(--op-space-1)" }}>{Math.round(obligation.confidence * 100)}% confidence</p>}</div>
                <EvidencePanel findingLabel={obligation.description || "Obligation"} evidence={evidenceFor(obligation)} />
                <ObligationFulfilmentReview analysisRunId={activeAnalysisRunId} organizationId={organizationId} obligation={obligation} canReview={canReview} />
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal id="deadlines" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Deadlines</h2>
        {analysisRun && obligations.length > 0 && !deadlines.length && (
          <div className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              Build temporal intelligence from existing obligations. Deterministic interpretation consumes zero AI Intelligence Budget.
            </p>
            {canAnalyze && <Button type="button" variant="primary" onClick={handleDeadlineAnalysis} disabled={deadlineAnalysisState === "processing"}>
              {deadlineAnalysisState === "processing" ? "Building deadline intelligence…" : "Build deadline intelligence"}
            </Button>}
            {deadlineAnalysisState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
          </div>
        )}
        {!activeAnalysisRunId ? (
          <EmptyState title="No active analysis run selected" description="This contract has no active run selected, so no deadline records can be shown yet." />
        ) : !obligations.length ? (
          <EmptyState title="No obligations available" description="Deadline intelligence is built from existing obligations, not by reanalysing the contract." />
        ) : !deadlines.length ? (
          <EmptyState title="Deadline intelligence has not been built" description="The current obligations are ready for deterministic temporal interpretation." />
        ) : (
          <>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              Date monitoring is calculated from established absolute dates, does not determine whether an obligation was performed, and requires source verification before action.
            </p>
            <div className="op-list-table">
              {deadlines.map((deadline) => {
                const obligation = obligations.find((item) => item.id === deadline.obligation_id);
                const calculation = deadline.metadata?.calculation;
                return (
                  <div id={`deadline-${deadline.id}`} key={deadline.id} className="op-list-row" style={{ gridTemplateColumns: "1.4fr 1.1fr 0.8fr auto auto", scrollMarginTop: 90 }}>
                    <div>
                      <span className="op-body-sm">{obligation?.description || "Linked obligation"}</span>
                      <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>{obligation?.actor || "Actor unclear"}</p>
                    </div>
                    <div>
                      <strong className="op-body-sm">{formatDeadlineTiming(deadline)}</strong>
                      <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>
                        {formatDeadlineMonitoring(deadline.monitoring)}
                        {deadline.monitoring?.reviewRequired ? " - extracted date is not verified" : ""}
                      </p>
                      {calculation?.result && <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>Calculated from {deadline.anchor_reference || "anchor"} {deadline.direction} {deadline.amount} {deadline.unit?.replaceAll("_", " ")}.</p>}
                      {!deadline.absolute_date && deadline.condition && <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>Condition: {deadline.condition}</p>}
                    </div>
                    <div><span className="op-badge">{deadline.deadline_type?.replaceAll("_", " ")}</span><p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>{getFindingReviewLabel(deadline, ["non_computable", "ambiguous"].includes(deadline.computability))}</p>{deadline.confidence != null && <p className="op-body-sm">{Math.round(deadline.confidence * 100)}% confidence</p>}</div>
                    <button type="button" className="op-body-sm" onClick={() => document.getElementById(`clause-${deadline.source_clause_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View source</button>
                    <EvidencePanel findingLabel={deadline.timing_expression || "Deadline"} evidence={evidenceFor(deadline)} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Reveal>

      <Reveal id="risks" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Risks</h2>
        <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)", maxWidth: 760 }}>
          Risk findings are evidence-linked screening signals, not confirmed legal conclusions. Review low-confidence findings and cure or notice periods against the source clause.
        </p>
        {analysisRun && profile?.classification?.type === "AIRCRAFT_LEASE" && profile?.classification?.status === "confirmed" && (
          <AviationLeaseRiskAssessment
            analysisRunId={analysisRun.id}
            organizationId={organizationId}
            canReview={canReview}
            onAssessmentChange={setAviationLeaseAssessment}
          />
        )}
        {analysisRun && (
          <AviationExternalRiskIntelligence
            contractId={contractId}
            analysisRunId={analysisRun.id}
            organizationId={organizationId}
          />
        )}
        {analysisRun && clauses.length > 0 && !risks.length && (
          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              Identify material contractual exposure from existing clauses, obligations, and deadlines. Deterministic screening uses zero AI Intelligence Budget.
            </p>
            <label className="op-body-sm" style={{ display: "flex", alignItems: "center", gap: "var(--op-space-2)", marginBottom: "var(--op-space-3)" }}>
              <input type="checkbox" checked={includeSemanticReview} onChange={(event) => setIncludeSemanticReview(event.target.checked)} />
              Include bounded semantic review for nuanced candidates
            </label>
            {includeSemanticReview && riskEstimate && (
              <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
                Estimated Intelligence Budget per candidate batch: {riskEstimate.estimatedIntelligence} · Remaining: {riskEstimate.budget?.remaining ?? "unknown"}
              </p>
            )}
            {canAnalyze && <Button type="button" variant="primary" onClick={handleRiskAnalysis} disabled={riskAnalysisState === "processing"}>
              {riskAnalysisState === "processing" ? "Analysing contractual risks…" : "Analyse contractual risks"}
            </Button>}
            {riskAnalysisState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
            {riskAnalysisState === "partial" && <p className="op-body-sm" style={{ marginTop: "var(--op-space-3)" }}>Materialized risks were retained; some semantic candidates require review or retry.</p>}
          </div>
        )}
        {!activeAnalysisRunId ? (
          <EmptyState title="No active analysis run selected" description="This contract has no active run selected, so no risk records can be shown yet." />
        ) : !clauses.length ? (
          <EmptyState title="No clause intelligence available" description="Contract risk intelligence consumes existing contractual facts and cannot run before clauses exist." />
        ) : !risks.length ? (
          <EmptyState title="No material contractual risks identified" description="No persisted material exposure exists for the current analysis run." />
        ) : (
          <>
            <div className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
              <strong className="op-heading-sm">{risks.length} potential contractual risk finding{risks.length === 1 ? "" : "s"}</strong>
              <p className="op-body-sm" style={{ marginTop: "var(--op-space-2)" }}>
                {(["critical", "high", "medium", "low"]).filter((severity) => severityCounts[severity]).map((severity) => `${severityCounts[severity]} ${severity}`).join(" · ")}
              </p>
            </div>
            <div className="op-grid op-grid-3" style={{ marginBottom: "var(--op-space-4)" }}>
              <label className="op-body-sm">Category
                <select value={riskFilters.category} onChange={(event) => setRiskFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="all">All categories</option>
                  {[...new Set(risks.map((risk) => risk.risk_category))].map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="op-body-sm">Severity
                <select value={riskFilters.severity} onChange={(event) => setRiskFilters((current) => ({ ...current, severity: event.target.value }))}>
                  <option value="all">All severities</option>
                  {(["critical", "high", "medium", "low"]).map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </label>
              <label className="op-body-sm">Confidence
                <select value={riskFilters.confidence} onChange={(event) => setRiskFilters((current) => ({ ...current, confidence: event.target.value }))}>
                  <option value="all">All confidence</option>
                  <option value="high">85% and above</option>
                  <option value="review">Below 85%</option>
                </select>
              </label>
              <label className="op-body-sm">Status
                <select value={riskFilters.status} onChange={(event) => setRiskFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="all">All statuses</option>
                  {[...new Set(risks.map((risk) => risk.status))].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                </select>
              </label>
            </div>
            <div className="op-list-table">
              {filteredRisks.map((risk) => {
                const relatedObligations = obligations.filter((item) => risk.affected_obligation_ids?.includes(item.id));
                const relatedDeadlines = deadlines.filter((item) => risk.affected_deadline_ids?.includes(item.id));
                return (
                  <details id={`risk-${risk.id}`} key={risk.id} className="op-list-row" style={{ display: "block", padding: "var(--op-space-4)", scrollMarginTop: 90 }}>
                    <summary style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.7fr auto", gap: "var(--op-space-3)", alignItems: "center" }}>
                      <strong className="op-body-sm">{risk.title}</strong>
                      <span className="op-body-sm">{risk.risk_category?.replaceAll("_", " ")}</span>
                      <span className="op-badge">{risk.severity}</span>
                      <span className="op-body-sm">{getFindingReviewLabel(risk)} · {Math.round(Number(risk.confidence || 0) * 100)}%</span>
                    </summary>
                    <div style={{ marginTop: "var(--op-space-4)" }}>
                      <p className="op-kicker">Why it matters</p>
                      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.rationale || risk.explanation}</p>
                      <p className="op-kicker">Contractual basis</p>
                      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.description || risk.exposure}</p>
                      {risk.consequence && <><p className="op-kicker">Potential consequence</p><p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.consequence}</p></>}
                      {risk.financial_exposure && <><p className="op-kicker">Financial exposure</p><p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.financial_exposure.type === "quantified" ? `${risk.financial_exposure.currency} ${Number(risk.financial_exposure.amount).toLocaleString()}` : "Unquantified / potentially uncapped"}</p></>}
                      {(risk.recommended_action || risk.metadata?.recommended_action) && <><p className="op-kicker">Suggested action</p><p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.recommended_action || risk.metadata.recommended_action}</p></>}
                      {risk.deadline_monitoring && <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>Current deadline status: {formatDeadlineMonitoring(risk.deadline_monitoring)}. This date status does not establish performance or breach.</p>}
                      <p className="op-kicker">Related intelligence</p>
                      {relatedObligations.length ? relatedObligations.map((item) => <p key={item.id} className="op-body-sm">Obligation: {item.description}</p>) : <p className="op-body-sm">No related obligation record.</p>}
                      {relatedDeadlines.map((item) => <p key={item.id} className="op-body-sm">Deadline: {formatDeadlineTiming(item)}</p>)}
                      <p className="op-kicker" style={{ marginTop: "var(--op-space-3)" }}>Source evidence</p>
                      {(risk.evidence || []).map((item) => (
                        <div key={item.evidence_id} style={{ marginBottom: "var(--op-space-2)" }}>
                          <p className="op-body-sm">{item.source?.source_locator || (item.source?.page_number ? `Page ${item.source.page_number}` : "Contract source")}</p>
                          {item.source?.excerpt && <p className="op-body-sm">“{item.source.excerpt}”</p>}
                        </div>
                      ))}
                      {risk.clause_id && <button type="button" className="op-body-sm" onClick={() => document.getElementById(`clause-${risk.clause_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View source clause</button>}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </Reveal>

      <Reveal id="relationships" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Aircraft and supplier relationships</h2>
        {!profile ? (
          <EmptyState title="Relationship intelligence unavailable" description="A completed contract profile is required before evidence-backed relationships can be shown." />
        ) : !aircraftIdentifiers.length && !parties.length ? (
          <EmptyState title="No relationships established" description="No aircraft, engine, or counterparty relationship was established from the available contract evidence." />
        ) : (
          <div className="op-relationship-grid">
            <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-4)" }}>
              <p className="op-kicker">Materialized aircraft links</p>
              {assetIdentificationReview.status === "requires_review" && (
                <div className="op-surface-plane-secondary" role="note" style={{ marginBottom: "var(--op-space-3)", padding: "var(--op-space-3)" }}>
                  <p className="op-kicker">Conflicting aircraft identifiers</p>
                  <p className="op-body-sm">Review the source candidates below. No aircraft relationship or event impact was inferred.</p>
                  {assetIdentificationReview.conflicts.map((conflict) => (
                    <div key={conflict.type} style={{ marginTop: "var(--op-space-2)" }}>
                      <p className="op-body-sm">{formatIntelligenceLabel(conflict.type)}</p>
                      {conflict.candidates.map((candidate) => <p className="op-body-sm" key={`${conflict.type}-${candidate.value}`}>
                        <strong>{candidate.value}</strong>
                        {candidate.evidence?.sourceLocation ? ` · ${candidate.evidence.sourceLocation}` : ""}
                        {candidate.evidence?.evidenceText ? ` · “${candidate.evidence.evidenceText}”` : ""}
                      </p>)}
                    </div>
                  ))}
                </div>
              )}
              {relationships.length ? relationships.map((relationship) => (
                <div className="op-relationship-item" key={relationship.id}>
                  <div><strong className="op-body">{relationship.registration || relationship.serial_number || "Aircraft identity unavailable"}</strong><p className="op-body-sm">{[relationship.manufacturer, relationship.model, relationship.aircraft_type].filter(Boolean).join(" · ") || "Aircraft details unavailable"}</p></div>
                  <span className="op-badge">{formatIntelligenceLabel(relationship.relationship_type)}</span>
                  <EvidencePanel findingLabel={`${relationship.registration || relationship.serial_number || "Aircraft"} relationship`} evidence={relationship.excerpt ? [relationship] : []} />
                </div>
              )) : <p className="op-body-sm">Identifiers were extracted, but no active organization aircraft matched them. No relationship has been inferred.</p>}
            </section>
            <section className="op-surface-plane-secondary" style={{ padding: "var(--op-space-4)" }}>
              <p className="op-kicker">Contract parties / dependencies</p>
              {parties.length ? parties.map((party) => <div className="op-relationship-item" key={`${party.role}-${party.name}`}><div><strong className="op-body">{party.name}</strong><p className="op-body-sm">{formatIntelligenceLabel(party.role)}</p></div></div>) : <p className="op-body-sm">No counterparty was established from the available evidence.</p>}
              <p className="op-body-sm op-relationship-boundary">Party and actor roles are extracted from contract wording and require human confirmation where the airport, operator, supplier, or service provider role is not explicit. No operational dependency is inferred from a name alone.</p>
            </section>
          </div>
        )}
        {activeAnalysisRunId && <AviationEventImpactPanel
          analysisRunId={activeAnalysisRunId}
          organizationId={organizationId}
          relationships={relationships}
        />}
      </Reveal>

      {leaseIntelligence.redelivery && <AviationRedeliveryIntelligence
        redelivery={leaseIntelligence.redelivery}
        relationships={relationships}
        obligations={obligations}
        deadlines={deadlines}
        leaseAssessment={aviationLeaseAssessment}
        financialImpact={financialImpact}
      />}

      <Reveal id="financial-impact" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <span className="op-page-kicker">Contract intelligence to financial exposure</span>
        <h2 className="op-heading-md" style={{ margin: "var(--op-space-2) 0 var(--op-space-3)" }}>Financial Impact</h2>
        <p className="op-body" style={{ marginBottom: "var(--op-space-4)", maxWidth: 760 }}>
          Trace evidence-linked contractual exposure, triggering events, and the potential value of grounded mitigation actions. Figures are estimates, not guaranteed savings.
        </p>
        {!activeAnalysisRunId ? (
          <EmptyState title="Financial impact is not available yet" description="Select or complete a contract analysis run before financial exposure can be assessed." />
        ) : (
          <FinancialImpactSection
            financialImpact={financialImpact}
            obligations={obligations}
            deadlines={deadlines}
            leaseRiskAssessment={aviationLeaseAssessment}
            state={financialImpactState}
          />
        )}
      </Reveal>

      <Reveal id="missing-terms" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Missing or unclear terms</h2>
        {!profile ? (
          <EmptyState title="Missing-term review unavailable" description="A completed aircraft lease profile is required." />
        ) : !missingTerms.length ? (
          <EmptyState title="No material checklist gaps identified" description="The aircraft lease checklist has evidence-backed coverage across its material areas. This is not a legal completeness opinion." />
        ) : (
          <div className="op-list-table">{missingTerms.map((item) => (
            <article className="op-list-row" key={item.field} style={{ display: "block", padding: "var(--op-space-4)" }}>
              <span className="op-status-badge is-neutral">Requires review</span>
              <h3 className="op-heading-sm">{item.what || `${formatIntelligenceLabel(item.field)} not established from the contract.`}</h3>
              <p className="op-body-sm"><strong>Why it matters:</strong> {item.whyItMatters}</p>
              <p className="op-body-sm"><strong>Basis:</strong> {item.basis}</p>
              <p className="op-body-sm"><strong>Recommended review:</strong> {item.recommendedReview}</p>
            </article>
          ))}</div>
        )}
      </Reveal>

      <Reveal id="actions" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Recommended actions</h2>
        <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)", maxWidth: 760 }}>These are operational review suggestions derived from identified contract findings. They are not extracted contractual requirements and should be approved by the responsible contract owner.</p>
        {latestExtractionStatus && latestExtractionStatus !== "completed" && (
          <p className="op-body-sm" role="status" style={{ marginBottom: "var(--op-space-3)" }}>
            Source extraction is {formatIntelligenceLabel(latestExtractionStatus)}. Recommendations reflect only available extracted passages and may omit contract content; verify the complete source before acting.
          </p>
        )}
        {!profile ? (
          <EmptyState title="Recommendations unavailable" description="Recommendations require a completed contract profile and evidence-backed risks." />
        ) : !recommendations.length ? (
          <EmptyState title="No recommended actions generated" description="No evidence-backed risk recommendation is available for this analysis run." />
        ) : (
          <div className="op-action-list">
            {recommendations.map((recommendation, index) => (
              <article className="op-surface-plane-secondary op-action-item" key={`${recommendation.riskId || "recommendation"}-${index}`}>
                <div>
                  <span className="op-kicker">Grounded recommendation {index + 1}</span>
                  <h3 className="op-heading-sm">{recommendation.title}</h3>
                  <span className="op-badge">{RECOMMENDATION_CATEGORY_LABELS[recommendation.category] || "Contract review"}</span>
                  <p className="op-body">{recommendation.action}</p>
                  {recommendation.observedFacts?.length > 0 && <p className="op-body-sm"><strong>Observed source fact:</strong> {recommendation.observedFacts.join(" · ")}</p>}
                  {recommendation.interpretation && <p className="op-body-sm"><strong>Interpretation:</strong> {recommendation.interpretation}</p>}
                  {recommendation.potentialImpact && <p className="op-body-sm"><strong>Potential impact (not quantified):</strong> {recommendation.potentialImpact}</p>}
                  {recommendation.missingInformation?.length > 0 && <p className="op-body-sm"><strong>Information still required:</strong> {recommendation.missingInformation.join(" · ")}</p>}
                  <p className="op-body-sm"><strong>Owner:</strong> {recommendation.suggestedOwner ? formatIntelligenceLabel(recommendation.suggestedOwner) : NOT_ESTABLISHED} · <strong>Priority:</strong> {recommendation.priority || NOT_ESTABLISHED}</p>
                  {recommendation.triggerDeadline && <p className="op-body-sm"><strong>Trigger / deadline:</strong> {recommendation.triggerDeadline}</p>}
                  <p className="op-body-sm"><strong>Evidence review:</strong> {formatIntelligenceLabel(recommendation.evidenceSufficiency)}{recommendation.evidenceConfidence !== null && recommendation.evidenceConfidence !== undefined ? ` · lowest linked extraction confidence ${Math.round(recommendation.evidenceConfidence * 100)}% (not probability)` : ""}</p>
                  <p className="op-body-sm">{recommendation.disclaimer}</p>
                  {recommendation.riskId && financialActionsByRisk.has(recommendation.riskId) && (() => {
                    const actionValue = financialActionsByRisk.get(recommendation.riskId);
                    return <div className="op-action-value"><span>Exposure before action: {formatFinancialAmount(actionValue.currentExposure, actionValue.currency)}</span><span>Estimated after action: {formatFinancialAmount(actionValue.estimatedExposureAfterMitigation, actionValue.currency)}</span><strong>Potential protected value: {formatFinancialAmount(actionValue.estimatedProtectedValue, actionValue.currency)}</strong><small>Only explicit post-mitigation amounts are calculated. This is not guaranteed savings.</small></div>;
                  })()}
                </div>
                <div className="op-action-controls">
                  {recommendation.riskId && <button type="button" className="op-body-sm" onClick={() => document.getElementById(`risk-${recommendation.riskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View linked risk</button>}
                  {recommendation.evidence[0]?.clauseId && activeDocumentVersion?.id === analysisRun?.document_version_id && (
                    <Link
                      className="op-body-sm"
                      to={`/app/contracts/${encodeURIComponent(contractId)}?analysisRunId=${encodeURIComponent(activeAnalysisRunId)}#clause-${encodeURIComponent(recommendation.evidence[0].clauseId)}`}
                    >
                      Open cited source · version {activeDocumentVersion.version_number ?? activeDocumentVersion.number ?? analysisRun.document_version_id}
                    </Link>
                  )}
                  <EvidencePanel findingLabel={recommendation.title} evidence={normalizeProfileEvidence(recommendation.evidence)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal id="evidence" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Evidence</h2>
        {!activeAnalysisRunId ? (
          <EmptyState title="No active analysis run selected" description="Evidence becomes available within a contract analysis run." />
        ) : !evidence.length ? (
          <EmptyState title="No evidence records available" description="The active analysis run has not returned persisted evidence records." />
        ) : (
          <div className="op-evidence-grid">
            {evidence.map((item) => {
              const source = item.source || item;
              return <article className="op-evidence-card" key={item.id || item.evidence_id}>
                <div className="op-row-between"><span className="op-page-kicker">Source evidence</span><span className="op-status-badge is-neutral">{source.page_number ? `Page ${source.page_number}` : "Page unavailable"}</span></div>
                <strong>{source.source_locator || "Document location unavailable"}</strong>
                <blockquote>{source.excerpt || "No excerpt is available for this evidence record."}</blockquote>
              </article>;
            })}
          </div>
        )}
      </Reveal>

      <Reveal>
        <Link to="/app/contracts" className="op-body" style={{ color: "var(--op-color-text-muted)" }}>
          ← Back to Contract Portfolio
        </Link>
      </Reveal>

    </div>
  );
}
