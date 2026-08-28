import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Section, Container } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { LoadingState, ErrorState, NotYetIntegrated } from "../components/ui/States";
import EvidencePanel from "../components/intelligence/EvidencePanel";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import OrganizationGate from "../components/demo/OrganizationGate";
import { useOrganization } from "../context/OrganizationContext";
import {
  getContract,
  listContractDocuments,
  listDocumentVersions,
  getDocumentStructure,
  getAnalysisRun,
  listAnalysisRunClauses,
  listAnalysisRunObligations,
  getObligationEstimate,
  analyzeObligations,
  analyzeContractClauses,
} from "../lib/contractsApi";
import { CONTRACT_INTELLIGENCE_HIERARCHY, INTELLIGENCE_AVAILABILITY, deriveAvailabilityState } from "../lib/contractIntelligenceModel";

const ContractSpatialBridge = lazy(() => import("../components/intelligence/spatial/ContractSpatialBridge"));

const INTELLIGENCE_SECTIONS = CONTRACT_INTELLIGENCE_HIERARCHY
  .filter((node) => ["clauses", "obligations", "deadlines", "risks", "evidence", "recommendations"].includes(node.id))
  .map((node) => ({
    key: node.id,
    label: node.label,
    finding: node.type.charAt(0).toUpperCase() + node.type.slice(1),
    state: deriveAvailabilityState({ isExposed: false }),
    note: "No read endpoint is exposed for this layer in current frontend boundaries.",
  }));

const HERO = "https://images.unsplash.com/photo-1569629743817-70d8db6c323b?auto=format&fit=crop&w=1800&q=82";

export default function ContractDetail() {
  const { id } = useParams();
  const { organizationId } = useOrganization();

  return (
    <>
      <section className="op-page-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}>
        <div className="op-page-hero-overlay">
          <Container>
            <Reveal>
              <p className="op-stitch-label">OPERION / CONTRACT WORKSPACE</p>
              <h1>Contract workspace</h1>
              <p>Open the document in a clean, full-height view starting from the top of the workspace.</p>
            </Reveal>
          </Container>
        </div>
      </section>

      <Section>
        <OrganizationGate>
          <ContractWorkspace contractId={id} organizationId={organizationId} />
        </OrganizationGate>
      </Section>
    </>
  );
}

function ContractWorkspace({ contractId, organizationId }) {
  const [state, setState] = useState("loading");
  const [contract, setContract] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [structure, setStructure] = useState({ pages: [], sections: [], chunks: [] });
  const [latestVersionId, setLatestVersionId] = useState("");
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisRun, setAnalysisRun] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [obligationEstimate, setObligationEstimate] = useState(null);
  const [obligationAnalysisState, setObligationAnalysisState] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeAnalysisRunId, setActiveAnalysisRunId] = useState(() => {
    try {
      return localStorage.getItem("operion.activeAnalysisRunId") || "";
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
          nextAnalysisRunId = localStorage.getItem("operion.activeAnalysisRunId") || "";
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
          setState("ready");
          return;
        }

        Promise.all([
          getAnalysisRun(nextAnalysisRunId, organizationId),
          listAnalysisRunClauses(nextAnalysisRunId, organizationId),
          listAnalysisRunObligations(nextAnalysisRunId, organizationId),
        ])
          .then(([analysisRunResult, clausesResult, obligationsResult]) => {
            if (cancelled) return;
            setAnalysisRun(analysisRunResult?.analysisRun || null);
            setClauses(clausesResult?.clauses || []);
            setObligations(obligationsResult?.obligations || []);
            setState("ready");
          })
          .catch((error) => {
            if (cancelled) return;
            setErrorMessage(error.message || "Analysis intelligence could not be loaded.");
            setAnalysisRun(null);
            setClauses([]);
            setObligations([]);
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

  async function handleClauseAnalysis() {
    if (!latestVersionId) return;
    setAnalysisState("processing");
    try {
      const result = await analyzeContractClauses({ contractId, documentVersionId: latestVersionId, organizationId });
      const runId = result?.analysisRun?.id;
      setAnalysisRun(result?.analysisRun || null);
      setActiveAnalysisRunId(runId || "");
      if (runId) {
        const clausesResult = await listAnalysisRunClauses(runId, organizationId);
        setClauses(clausesResult?.clauses || []);
      }
      setAnalysisState("ready");
    } catch (error) {
      setErrorMessage(error.message || "Clause analysis could not be completed.");
      setAnalysisState("error");
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

  return (
    <div>
      <Reveal>
        <p className="op-eyebrow">Contract</p>
        <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-2)" }}>
          {contract.title}
        </h1>
        <p className="op-body" style={{ marginBottom: "var(--op-space-6)" }}>
          Status: {contract.status} · Created {new Date(contract.created_at).toLocaleDateString()}
        </p>
      </Reveal>

      <Reveal className="op-flow-shell" style={{ marginBottom: "var(--op-space-7)" }}>
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
            {latestVersionId && !analysisRun && <Button type="button" variant="primary" onClick={handleClauseAnalysis} disabled={analysisState === "processing"}>
              {analysisState === "processing" ? "Analysing clauses…" : "Analyse clauses"}
            </Button>}
            {analysisState === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{errorMessage}</p>}
            <Button to={`/demo/contracts/${contractId}/analysis`} variant="secondary">View analysis</Button>
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

      <Reveal style={{ marginBottom: "var(--op-space-6)" }}>
        <Suspense fallback={<LoadingState label="Preparing spatial dependency context…" />}>
          <ContractSpatialBridge contract={contract} documents={documents} />
        </Suspense>
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
            <IntelligenceStatus state={INTELLIGENCE_AVAILABILITY.UNAVAILABLE} note="Deadline intelligence is not exposed by the current backend read model." />
          </div>
        </div>
      </Reveal>

      <Reveal style={{ marginBottom: "var(--op-space-5)" }}>
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

      <Reveal style={{ marginBottom: "var(--op-space-5)" }}>
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
              <div key={clause.id} className="op-list-row" style={{ gridTemplateColumns: "1.2fr 1fr 1fr auto" }}>
                <span className="op-body-sm">{clause.clause_number || "Clause"}</span>
                <span className="op-body-sm">{clause.title || "Untitled clause"}</span>
                <span className="op-body-sm">{clause.category || "uncategorized"}</span>
                <span className="op-badge">{clause.review_status || "unknown"}</span>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal style={{ marginBottom: "var(--op-space-5)" }}>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Obligations</h2>
        {analysisRun && !obligations.length && (
          <div className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
              Extract actionable commitments from the validated clauses. This uses the AI Intelligence Budget only after you start it.
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
              <div key={obligation.id} className="op-list-row" style={{ gridTemplateColumns: "1.5fr 1fr 1fr auto" }}>
                <div><span className="op-body-sm">{obligation.description || "Untitled obligation"}</span><p className="op-body-sm" style={{ margin: "var(--op-space-1) 0 0" }}>{obligation.actor || "Actor unclear"} · {obligation.action || "Action unclear"} · {obligation.object || "Object unclear"}</p></div>
                <span className="op-body-sm">{obligation.obligation_type || "unspecified"}</span>
                <span className="op-body-sm">{obligation.timing_expression || obligation.frequency || "Timing not stated"}</span>
                <span className="op-badge">{obligation.confidence != null ? `${Math.round(obligation.confidence * 100)}%` : "unknown"}</span>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal>
        <Link to="/demo/contracts" className="op-body" style={{ color: "var(--op-color-text-muted)" }}>
          ← Back to Contract Portfolio
        </Link>
      </Reveal>

      <Reveal style={{ marginTop: "var(--op-space-5)" }}>
        <Suspense fallback={<LoadingState label="Preparing spatial intelligence…" />}>
          <ContractSpatialBridge
            contract={contract}
            documents={documents}
            analysisRun={analysisRun}
            clauses={clauses}
            obligations={obligations}
          />
        </Suspense>
      </Reveal>
    </div>
  );
}
