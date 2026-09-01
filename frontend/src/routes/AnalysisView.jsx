import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Section, Container } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import AnalysisPipeline from "../components/demo/AnalysisPipeline";
import IntelligenceStatus from "../components/intelligence/IntelligenceStatus";
import SpatialModeToggle from "../components/intelligence/spatial/SpatialModeToggle";
import SpatialStage from "../components/intelligence/spatial/SpatialStage";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import OrganizationGate from "../components/demo/OrganizationGate";
import { useOrganization } from "../context/OrganizationContext";
import {
  listContractDocuments,
  listDocumentVersions,
  getAnalysisRun,
  listAnalysisRunClauses,
  listAnalysisRunObligations,
} from "../lib/contractsApi";
import { CONTRACT_INTELLIGENCE_HIERARCHY, INTELLIGENCE_AVAILABILITY, deriveAvailabilityState } from "../lib/contractIntelligenceModel";

const HERO = "https://images.unsplash.com/photo-1589782182703-2aaa69037b5b?auto=format&fit=crop&w=1800&q=82";

export default function AnalysisView() {
  const { id } = useParams();
  const { organizationId } = useOrganization();

  return (
    <>
      <section className="op-page-hero op-cinematic-hero" style={{ backgroundImage: `url(${HERO})` }}>
        <div className="op-page-hero-overlay">
          <Container>
            <Reveal>
              <p className="op-stitch-label">OPERION / ANALYSIS</p>
              <h1>Contract analysis pipeline</h1>
              <p>Review extraction and analysis output from the top of the pipeline, not from mid-scroll state.</p>
            </Reveal>
          </Container>
        </div>
      </section>

      <Section>
        <Reveal>
          <p className="op-eyebrow">Analysis</p>
          <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-6)" }}>
            Contract analysis pipeline
          </h1>
        </Reveal>

        <OrganizationGate>
          <AnalysisContent contractId={id} organizationId={organizationId} />
        </OrganizationGate>

        <Reveal style={{ marginTop: "var(--op-space-6)" }}>
          <Link to={`/demo/contracts/${id}`} className="op-body" style={{ color: "var(--op-text-muted)" }}>
            ← Back to contract
          </Link>
        </Reveal>
      </Section>
    </>
  );
}

function AnalysisContent({ contractId, organizationId }) {
  const [state, setState] = useState("loading");
  const [version, setVersion] = useState(null);
  const [analysisRun, setAnalysisRun] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState("standard");
  const [activeStageId, setActiveStageId] = useState("source");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    listContractDocuments(contractId, organizationId)
      .then(async (documentsResult) => {
        const latestDocument = documentsResult?.documents?.[0];
        if (!latestDocument) {
          if (!cancelled) setState("empty");
          return;
        }

        let nextAnalysisRunId = "";
        try {
          nextAnalysisRunId = localStorage.getItem(`operion.activeAnalysisRunId.${contractId}`) || "";
        } catch {
          nextAnalysisRunId = "";
        }

        const versionsResult = await listDocumentVersions(latestDocument.id, organizationId);
        const latestVersion = versionsResult?.versions?.[0];
        if (cancelled) return;
        setVersion(latestVersion || null);

        if (!latestVersion) {
          setState("empty");
          return;
        }

        if (!nextAnalysisRunId) {
          setAnalysisRun(null);
          setClauses([]);
          setObligations([]);
          setState("ready");
          return;
        }

        const [analysisRunResult, clausesResult, obligationsResult] = await Promise.all([
          getAnalysisRun(nextAnalysisRunId, organizationId),
          listAnalysisRunClauses(nextAnalysisRunId, organizationId),
          listAnalysisRunObligations(nextAnalysisRunId, organizationId),
        ]);

        if (cancelled) return;
        setAnalysisRun(analysisRunResult?.analysisRun || null);
        setClauses(clausesResult?.clauses || []);
        setObligations(obligationsResult?.obligations || []);
        setState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, organizationId]);

  if (state === "loading") return <LoadingState label="Loading analysis status…" />;
  if (state === "error") return <ErrorState message={errorMessage} />;
  if (state === "empty") {
    return (
      <EmptyState
        title="No analysis yet"
        description="Upload a contract from the Intelligence Hub to start an analysis run."
      />
    );
  }

  const stages = useMemo(
    () => {
      const clauseStatus = deriveAvailabilityState({
        isExposed: Boolean(analysisRun?.id),
        items: clauses,
      });
      const obligationStatus = deriveAvailabilityState({
        isExposed: Boolean(analysisRun?.id),
        items: obligations,
      });

      const futureStages = CONTRACT_INTELLIGENCE_HIERARCHY
        .filter((node) => ["deadlines", "risks", "evidence", "recommendations"].includes(node.id))
        .map((node) => ({
          id: node.id,
          label: node.label,
          availability: INTELLIGENCE_AVAILABILITY.UNAVAILABLE,
          details: `${node.label} is not exposed by the current backend read model.`,
        }));

      return [
        {
          id: "source",
          label: "Source",
          availability: INTELLIGENCE_AVAILABILITY.AVAILABLE,
          details: "Document version and source payload are available.",
        },
        {
          id: "extraction",
          label: "Extraction",
          availability: INTELLIGENCE_AVAILABILITY.AVAILABLE,
          details: `Extraction status is currently ${version?.extraction_status || "queued"}.`,
        },
        {
          id: "clauses",
          label: "Clauses",
          availability: clauseStatus,
          details: clauses.length ? `${clauses.length} real clause records are available.` : "No clause records were returned for the active analysis run.",
        },
        {
          id: "obligations",
          label: "Obligations",
          availability: obligationStatus,
          details: obligations.length ? `${obligations.length} real obligation records are available.` : "No obligation records were returned for the active analysis run.",
        },
        ...futureStages,
      ];
    },
    [analysisRun?.id, clauses, obligations, version?.extraction_status]
  );

  const activeStage = stages.find((item) => item.id === activeStageId) || stages[0];

  return (
    <Reveal className="op-stack" style={{ gap: "var(--op-space-4)" }}>
      <div className="op-row" style={{ flexWrap: "wrap" }}>
        <SpatialModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="op-surface" style={{ padding: "var(--op-space-6)" }}>
        <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Pipeline progression</p>
        <p className="op-body" style={{ marginBottom: "var(--op-space-4)" }}>
          Source and extraction stages are connected to live backend data.
          Downstream intelligence stages are architecturally prepared but not
          exposed by current read endpoints.
        </p>

        <SpatialStage stages={stages} activeStageId={activeStageId} onSelectStage={(stage) => setActiveStageId(stage.id)} />

        <AnalysisPipeline status={version?.extraction_status || "queued"} />

        <p className="op-body" style={{ marginTop: "var(--op-space-4)" }}>
          Document version {version?.version_number}: extraction status{" "}
          <strong style={{ color: "var(--op-color-text-primary)" }}>{version?.extraction_status}</strong>.
        </p>
      </div>

      {mode === "standard" ? (
        <SpatialTransition kind="enter">
          <div className="op-surface-raised" style={{ padding: "var(--op-space-5)" }}>
            <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Standard stage details</p>
            <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{activeStage.label}</h3>
            <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{activeStage.details}</p>
            <IntelligenceStatus state={activeStage.availability} />
          </div>
        </SpatialTransition>
      ) : (
        <SpatialTransition kind="navigate">
          <div className="op-grid op-grid-2">
            <div className="op-surface-spatial" style={{ padding: "var(--op-space-5)" }}>
              <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Spatial progression</p>
              <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>
                Stage selection preserves context while focusing one layer of the
                intelligence pipeline at a time.
              </p>
              <div className="op-spatial-stage">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    className={[
                      "op-stage-chip",
                      stage.id === activeStageId ? "op-stage-chip-active op-motion-focus" : "",
                      stage.availability === INTELLIGENCE_AVAILABILITY.UNAVAILABLE ? "op-stage-chip-unavailable" : "",
                    ].join(" ").trim()}
                    onClick={() => setActiveStageId(stage.id)}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="op-surface" style={{ padding: "var(--op-space-5)" }}>
              <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Inspector</p>
              <h3 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>{activeStage.label}</h3>
              <p className="op-body-sm" style={{ marginBottom: "var(--op-space-3)" }}>{activeStage.details}</p>
              <IntelligenceStatus state={activeStage.availability} />
              <p className="op-body-sm">
                {activeStage.availability === INTELLIGENCE_AVAILABILITY.AVAILABLE
                  ? "Data source is available in current API boundaries."
                  : "No synthetic values are shown for unavailable stages."}
              </p>
            </div>
          </div>
        </SpatialTransition>
      )}

      <div className="op-surface-raised" style={{ padding: "var(--op-space-5)" }}>
        <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Clause and obligation results</p>
        <div className="op-grid op-grid-2">
          <div>
            <p className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Clauses</p>
            {!clauses.length ? (
              <p className="op-body-sm">No clauses were returned for this analysis run.</p>
            ) : (
              <div className="op-list-table">
                {clauses.slice(0, 8).map((clause) => (
                  <div key={clause.id} className="op-list-row" style={{ gridTemplateColumns: "1.2fr 1fr auto" }}>
                    <span className="op-body-sm">{clause.clause_number || "Clause"}</span>
                    <span className="op-body-sm">{clause.title || "Untitled"}</span>
                    <span className="op-badge">{clause.review_status || "unknown"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Obligations</p>
            {!obligations.length ? (
              <p className="op-body-sm">No obligations were returned for this analysis run.</p>
            ) : (
              <div className="op-list-table">
                {obligations.slice(0, 8).map((obligation) => (
                  <div key={obligation.id} className="op-list-row" style={{ gridTemplateColumns: "1.5fr 1fr auto" }}>
                    <span className="op-body-sm">{obligation.description || "Untitled"}</span>
                    <span className="op-body-sm">{obligation.obligation_type || "unspecified"}</span>
                    <span className="op-badge">{obligation.priority || "unknown"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
