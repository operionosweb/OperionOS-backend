import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import EvidencePanel from "../components/intelligence/EvidencePanel";
import ContractAssistantPanel from "../components/intelligence/ContractAssistantPanel";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import FinancialImpactSection from "../components/intelligence/FinancialImpactSection";
import OrganizationGate from "../components/demo/OrganizationGate";
import { useOrganization } from "../context/OrganizationContext";
import {
  getContract,
  listContractDocuments,
  listDocumentVersions,
  getDocumentStructure,
  getAnalysisRun,
  processContractIntelligence,
  getAnalysisRunProfile,
  getAnalysisRunFinancialImpact,
  listAnalysisRunRelationships,
  searchContractIntelligence,
  listAnalysisRunClauses,
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
import { CONTRACT_INTELLIGENCE_HIERARCHY, INTELLIGENCE_AVAILABILITY, deriveAvailabilityState } from "../lib/contractIntelligenceModel";

const INTELLIGENCE_SECTIONS = CONTRACT_INTELLIGENCE_HIERARCHY
  .filter((node) => ["clauses", "obligations", "deadlines", "risks", "evidence", "recommendations"].includes(node.id))
  .map((node) => ({
    key: node.id,
    label: node.label,
    finding: node.type.charAt(0).toUpperCase() + node.type.slice(1),
    state: deriveAvailabilityState({ isExposed: false }),
    note: "No read endpoint is exposed for this layer in current frontend boundaries.",
  }));

function formatDeadlineTiming(deadline) {
  if (deadline.absolute_date) {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${deadline.absolute_date}T00:00:00.000Z`));
  }
  if (deadline.deadline_type === "ambiguous") return `${deadline.timing_expression} - exact timing cannot be determined`;
  if (deadline.amount && deadline.unit) {
    const unit = deadline.unit.replaceAll("_", " ");
    return `${deadline.amount} ${unit} ${deadline.direction || "after"}${deadline.anchor_reference ? ` ${deadline.anchor_reference}` : ""}`;
  }
  if (deadline.deadline_type === "event_based") return `${deadline.direction === "upon" ? "Upon" : deadline.direction || "Upon"} ${deadline.anchor_reference || deadline.trigger_expression || "event"}`;
  if (deadline.recurrence?.frequency) return deadline.recurrence.frequency.replaceAll("_", " ");
  return deadline.timing_expression || "Timing not computable";
}

function formatIntelligenceLabel(value) {
  return value ? String(value).replaceAll("_", " ").toLowerCase() : "Not established";
}

function formatFinancialAmount(amount, currency) {
  if (!Number.isFinite(amount) || !currency) return "Not quantified";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function normalizeProfileEvidence(items = []) {
  return items.map((item) => ({
    id: item.evidenceId,
    excerpt: item.evidenceText || item.source?.excerpt,
    source_locator: item.sourceLocation || item.source?.source_locator,
    page_number: item.pageNumber || item.source?.page_number,
  }));
}

export default function ContractDetail() {
  const { id } = useParams();
  const { organizationId } = useOrganization();

  return <OrganizationGate><ContractWorkspace contractId={id} organizationId={organizationId} /></OrganizationGate>;
}

function ContractWorkspace({ contractId, organizationId }) {
  const [state, setState] = useState("loading");
  const [contract, setContract] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [structure, setStructure] = useState({ pages: [], sections: [], chunks: [] });
  const [latestVersionId, setLatestVersionId] = useState("");
  const [analysisRun, setAnalysisRun] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [risks, setRisks] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [profile, setProfile] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [financialImpact, setFinancialImpact] = useState(null);
  const [financialImpactState, setFinancialImpactState] = useState("loading");
  const [processingState, setProcessingState] = useState("idle");
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
        let nextAnalysisRunId = "";

        try {
          nextAnalysisRunId = localStorage.getItem(`operion.activeAnalysisRunId.${contractId}`) || "";
        } catch {
          nextAnalysisRunId = "";
        }

        if (!latestDocument && !nextAnalysisRunId) {
          setState("ready");
          return;
        }

        if (latestDocument) {
          try {
            const [versionsResult, structureResult] = await Promise.all([
              listDocumentVersions(latestDocument.id, organizationId),
              getDocumentStructure(latestDocument.id, organizationId),
            ]);
            const latestVersion = versionsResult?.versions?.[0];
            setLatestVersionId(latestVersion?.id || "");
            setStructure({
              pages: structureResult?.pages || [],
              sections: structureResult?.sections || [],
              chunks: structureResult?.chunks || [],
            });
            if (latestVersion && latestVersion.analysis_run_id) {
              nextAnalysisRunId = latestVersion.analysis_run_id;
            }
          } catch {
            setStructure({ pages: [], sections: [], chunks: [] });
            nextAnalysisRunId = nextAnalysisRunId || "";
          }
        }

        setActiveAnalysisRunId(nextAnalysisRunId);

        if (!nextAnalysisRunId) {
          setAnalysisRun(null);
          setClauses([]);
          setObligations([]);
          setDeadlines([]);
          setRisks([]);
          setRelationships([]);
          setFinancialImpact(null);
          setFinancialImpactState("ready");
          setState("ready");
          return;
        }

        Promise.all([
          getAnalysisRun(nextAnalysisRunId, organizationId),
          listAnalysisRunClauses(nextAnalysisRunId, organizationId),
          listAnalysisRunObligations(nextAnalysisRunId, organizationId),
          listAnalysisRunDeadlines(nextAnalysisRunId, organizationId),
          listAnalysisRunRisks(nextAnalysisRunId, organizationId),
          listAnalysisRunEvidence(nextAnalysisRunId, organizationId),
          getAnalysisRunProfile(nextAnalysisRunId, organizationId).catch(() => null),
          listAnalysisRunRelationships(nextAnalysisRunId, organizationId).catch(() => ({ relationships: [] })),
          getAnalysisRunFinancialImpact(nextAnalysisRunId, organizationId).catch(() => null),
        ])
          .then(([analysisRunResult, clausesResult, obligationsResult, deadlinesResult, risksResult, evidenceResult, profileResult, relationshipsResult, financialImpactResult]) => {
            if (cancelled) return;
            setAnalysisRun(analysisRunResult?.analysisRun || null);
            setClauses(clausesResult?.clauses || []);
            setObligations(obligationsResult?.obligations || []);
            setDeadlines(deadlinesResult?.deadlines || []);
            setRisks(risksResult?.risks || []);
            setEvidence(evidenceResult?.evidence || []);
            setProfile(profileResult?.profile || null);
            setRelationships(relationshipsResult?.relationships || []);
            setFinancialImpact(financialImpactResult?.financialImpact || null);
            setFinancialImpactState(financialImpactResult ? "ready" : "unavailable");
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
            setRelationships([]);
            setFinancialImpact(null);
            setFinancialImpactState("unavailable");
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
  }, [contractId, organizationId]);

  useEffect(() => {
    if (processingState !== "processing" || !activeAnalysisRunId) return undefined;
    const timer = window.setInterval(() => {
      getAnalysisRun(activeAnalysisRunId, organizationId)
        .then((result) => setAnalysisRun(result?.analysisRun || null))
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [processingState, activeAnalysisRunId, organizationId]);

  async function handleFullProcessing() {
    if (!analysisRun?.id) return;
    setProcessingState("processing");
    setErrorMessage("");
    try {
      await processContractIntelligence(analysisRun.id, organizationId);
      const [runResult, clausesResult, obligationsResult, deadlinesResult, risksResult, evidenceResult, profileResult, relationshipsResult, financialImpactResult] = await Promise.all([
        getAnalysisRun(analysisRun.id, organizationId),
        listAnalysisRunClauses(analysisRun.id, organizationId),
        listAnalysisRunObligations(analysisRun.id, organizationId),
        listAnalysisRunDeadlines(analysisRun.id, organizationId),
        listAnalysisRunRisks(analysisRun.id, organizationId),
        listAnalysisRunEvidence(analysisRun.id, organizationId),
        getAnalysisRunProfile(analysisRun.id, organizationId),
        listAnalysisRunRelationships(analysisRun.id, organizationId),
        getAnalysisRunFinancialImpact(analysisRun.id, organizationId),
      ]);
      setAnalysisRun(runResult?.analysisRun || null);
      setClauses(clausesResult?.clauses || []);
      setObligations(obligationsResult?.obligations || []);
      setDeadlines(deadlinesResult?.deadlines || []);
      setRisks(risksResult?.risks || []);
      setEvidence(evidenceResult?.evidence || []);
      setProfile(profileResult?.profile || null);
      setRelationships(relationshipsResult?.relationships || []);
      setFinancialImpact(financialImpactResult?.financialImpact || null);
      setFinancialImpactState("ready");
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
  const recommendations = profile?.recommendations || [];
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
        <p>
          Status: {contract.status} · Created {new Date(contract.created_at).toLocaleDateString()}
        </p></div>
        <span className={`op-status-badge${contract.status ? "" : " is-neutral"}`}>{contract.status || "Status unavailable"}</span>
      </Reveal>

      <nav aria-label="Contract intelligence" className="op-workspace-tabs">
        {[["overview", "Overview"], ["clauses", "Clauses"], ["obligations", "Obligations"], ["deadlines", "Deadlines"], ["risks", "Risks"], ["relationships", "Relationships"], ["evidence", "Evidence"], ["financial-impact", "Financial Impact"], ["search", "Search"], ["assistant", "Assistant"], ["actions", "Actions"]].map(([target, label]) => (
          <a key={target} href={`#${target}`} className="op-btn op-btn-quiet">{label}</a>
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
              Deterministic structure is ready for later Contract Intelligence analysis.
            </p>
            <div className="op-inspector-kv"><span className="op-body-sm">Pages</span><span className="op-body-sm">{structure.pages.length}</span></div>
            <div className="op-inspector-kv"><span className="op-body-sm">Sections</span><span className="op-body-sm">{structure.sections.length}</span></div>
            <div className="op-inspector-kv"><span className="op-body-sm">Chunks</span><span className="op-body-sm">{structure.chunks.length}</span></div>
          </div>

          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Analysis</p>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
              {analysisRun?.status ? `Active analysis run: ${analysisRun.status}` : "Clause analysis has not been requested for this document."}
            </p>
            {analysisRun && analysisRun.status !== "completed" && <Button type="button" variant="primary" onClick={handleFullProcessing} disabled={processingState === "processing"}>
              {processingState === "processing" ? "Understanding contract…" : analysisRun.status === "failed" ? "Retry processing" : "Process contract"}
            </Button>}
            {processingState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
            <Button to={`/app/contracts/${contractId}/analysis`} variant="secondary">View analysis</Button>
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
              <div><span className="op-kicker">Type</span><p className="op-body-sm">{formatIntelligenceLabel(profile.metadata?.contractType)}</p></div>
              <div><span className="op-kicker">Contract number</span><p className="op-body-sm">{profile.metadata?.contractNumber || "Not established"}</p></div>
              <div><span className="op-kicker">Effective</span><p className="op-body-sm">{profile.metadata?.effectiveDate || "Not established"}</p></div>
              <div><span className="op-kicker">Expires</span><p className="op-body-sm">{profile.metadata?.expirationDate || "Not established"}</p></div>
              <div><span className="op-kicker">Renewal</span><p className="op-body-sm">{profile.metadata?.renewalDate || (profile.metadata?.autoRenewal === true ? "Automatic renewal identified" : "Not established")}</p></div>
              <div><span className="op-kicker">Governing law</span><p className="op-body-sm">{profile.metadata?.governingLaw || "Not established"}</p></div>
              <div><span className="op-kicker">Currency</span><p className="op-body-sm">{profile.metadata?.currency || "Not established"}</p></div>
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
          </div>
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
        <ContractAssistantPanel analysisRunId={analysisRun?.id} organizationId={organizationId} />
      </Reveal>

      <Reveal style={{ marginBottom: "var(--op-space-6)" }}>
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
                <span className="op-badge">{clause.review_status || "unknown"}</span>
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
            <Button type="button" variant="primary" onClick={handleObligationAnalysis} disabled={obligationAnalysisState === "processing"}>
              {obligationAnalysisState === "processing" ? "Analysing obligations…" : "Analyse obligations"}
            </Button>
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
                <span className="op-badge">{obligation.confidence != null ? `${Math.round(obligation.confidence * 100)}%` : "unknown"}</span>
                <EvidencePanel findingLabel={obligation.description || "Obligation"} evidence={evidenceFor(obligation)} />
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
            <Button type="button" variant="primary" onClick={handleDeadlineAnalysis} disabled={deadlineAnalysisState === "processing"}>
              {deadlineAnalysisState === "processing" ? "Building deadline intelligence…" : "Build deadline intelligence"}
            </Button>
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
                    {calculation?.result && <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>Calculated from {deadline.anchor_reference || "anchor"} {deadline.direction} {deadline.amount} {deadline.unit?.replaceAll("_", " ")}.</p>}
                    {!deadline.absolute_date && deadline.condition && <p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>Condition: {deadline.condition}</p>}
                  </div>
                  <div><span className="op-badge">{deadline.deadline_type?.replaceAll("_", " ")}</span><p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>{deadline.status?.replaceAll("_", " ")}</p></div>
                  <button type="button" className="op-body-sm" onClick={() => document.getElementById(`clause-${deadline.source_clause_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View source</button>
                  <EvidencePanel findingLabel={deadline.timing_expression || "Deadline"} evidence={evidenceFor(deadline)} />
                </div>
              );
            })}
          </div>
        )}
      </Reveal>

      <Reveal id="risks" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Risks</h2>
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
            <Button type="button" variant="primary" onClick={handleRiskAnalysis} disabled={riskAnalysisState === "processing"}>
              {riskAnalysisState === "processing" ? "Analysing contractual risks…" : "Analyse contractual risks"}
            </Button>
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
              <strong className="op-heading-sm">{risks.length} contractual risk{risks.length === 1 ? "" : "s"} identified</strong>
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
                      <span className="op-body-sm">{Math.round(Number(risk.confidence || 0) * 100)}%</span>
                    </summary>
                    <div style={{ marginTop: "var(--op-space-4)" }}>
                      <p className="op-kicker">Why it matters</p>
                      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.rationale || risk.explanation}</p>
                      <p className="op-kicker">Contractual basis</p>
                      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.description || risk.exposure}</p>
                      {risk.consequence && <><p className="op-kicker">Potential consequence</p><p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.consequence}</p></>}
                      {risk.financial_exposure && <><p className="op-kicker">Financial exposure</p><p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{risk.financial_exposure.type === "quantified" ? `${risk.financial_exposure.currency} ${Number(risk.financial_exposure.amount).toLocaleString()}` : "Unquantified / potentially uncapped"}</p></>}
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
              <p className="op-body-sm op-relationship-boundary">Supplier dependency is shown only when a supplier party is explicitly extracted; no operational dependency is inferred from a name alone.</p>
            </section>
          </div>
        )}
      </Reveal>

      <Reveal id="financial-impact" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <span className="op-page-kicker">Contract intelligence to financial exposure</span>
        <h2 className="op-heading-md" style={{ margin: "var(--op-space-2) 0 var(--op-space-3)" }}>Financial Impact</h2>
        <p className="op-body" style={{ marginBottom: "var(--op-space-4)", maxWidth: 760 }}>
          Trace evidence-linked contractual exposure, triggering events, and the potential value of grounded mitigation actions. Figures are estimates, not guaranteed savings.
        </p>
        {!activeAnalysisRunId ? (
          <EmptyState title="Financial impact is not available yet" description="Select or complete a contract analysis run before financial exposure can be assessed." />
        ) : (
          <FinancialImpactSection financialImpact={financialImpact} state={financialImpactState} />
        )}
      </Reveal>

      <Reveal id="actions" style={{ marginBottom: "var(--op-space-5)", scrollMarginTop: 90 }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Recommended actions</h2>
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
                  <p className="op-body">{recommendation.action}</p>
                  <p className="op-body-sm">{recommendation.disclaimer}</p>
                  {recommendation.riskId && financialActionsByRisk.has(recommendation.riskId) && (() => {
                    const actionValue = financialActionsByRisk.get(recommendation.riskId);
                    return <div className="op-action-value"><span>Exposure before action: {formatFinancialAmount(actionValue.currentExposure, actionValue.currency)}</span><span>Estimated after action: {formatFinancialAmount(actionValue.estimatedExposureAfterMitigation, actionValue.currency)}</span><strong>Potential protected value: {formatFinancialAmount(actionValue.estimatedProtectedValue, actionValue.currency)}</strong><small>Only explicit post-mitigation amounts are calculated. This is not guaranteed savings.</small></div>;
                  })()}
                </div>
                <div className="op-action-controls">
                  {recommendation.riskId && <button type="button" className="op-body-sm" onClick={() => document.getElementById(`risk-${recommendation.riskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>View linked risk</button>}
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
