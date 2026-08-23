import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Section } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import Button from "../components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import OrganizationGate from "../components/demo/OrganizationGate";
import UploadContract from "../components/demo/UploadContract";
import SpatialModeToggle from "../components/intelligence/spatial/SpatialModeToggle";
import SpatialTransition from "../components/intelligence/spatial/SpatialTransition";
import { useOrganization } from "../context/OrganizationContext";
import { listContracts } from "../lib/contractsApi";

export default function DemoHub() {
  const { organizationId } = useOrganization();
  const [mode, setMode] = useState("standard");

  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">Contract Intelligence Hub</p>
        <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-4)", maxWidth: 860 }}>
          Operational workspace for ingestion, visibility, and evidence-ready contract analysis.
        </h1>
        <p className="op-body-lg" style={{ marginBottom: "var(--op-space-6)" }}>
          Source → Extraction → Clauses → Obligations → Evidence → Impact.
        </p>

        <SpatialModeToggle mode={mode} onChange={setMode} />
      </Reveal>

      <OrganizationGate>
        {mode === "standard" ? (
          <SpatialTransition kind="enter">
            <Reveal className="op-flow-shell" style={{ marginBottom: "var(--op-space-7)" }}>
              <div className="op-flow-main">
                <div className="op-surface-plane-primary" style={{ padding: "var(--op-space-6)" }}>
                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Context</p>
                  <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>
                    Operational ingest
                  </h2>
                  <UploadContract organizationId={organizationId} />
                </div>

                <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-6)" }}>
                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Active intelligence</p>
                  <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>
                    Explore Contract Intelligence
                  </h2>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
                    Transition from source documents into analysis context and
                    emerging intelligence structure.
                  </p>
                  <Button to="/demo/contracts" variant="secondary">Go to Contract Portfolio</Button>
                </div>
              </div>

              <div className="op-flow-rail">
                <div className="op-surface-inspector" style={{ padding: "var(--op-space-5)" }}>
                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Next action</p>
                  <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Move into portfolio workspace</h2>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
                    Continue from contract context into document and extraction exploration.
                  </p>
                  <Button to="/demo/contracts" variant="primary">Open portfolio</Button>
                </div>
              </div>
            </Reveal>
          </SpatialTransition>
        ) : (
          <SpatialTransition kind="navigate">
            <Reveal className="op-flow-shell" style={{ marginBottom: "var(--op-space-7)" }}>
              <div className="op-flow-main">
                <div className="op-surface-spatial" style={{ padding: "var(--op-space-6)" }}>
                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Spatial context</p>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
                    Intelligence workspace entrypoint with explicit data boundaries.
                  </p>
                  <div className="op-spatial-stage">
                    <span className="op-stage-chip op-stage-chip-active">Contract</span>
                    <span className="op-stage-chip op-stage-chip-active">Document</span>
                    <span className="op-stage-chip op-stage-chip-active">Analysis</span>
                    <span className="op-stage-chip op-stage-chip-unavailable">Clauses</span>
                    <span className="op-stage-chip op-stage-chip-unavailable">Obligations</span>
                    <span className="op-stage-chip op-stage-chip-unavailable">Evidence</span>
                  </div>
                </div>
              </div>

              <div className="op-flow-rail">
                <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-6)" }}>
                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Next action</p>
                  <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Open portfolio workspace</h2>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
                    Use portfolio selection to move from context into focused contract investigation.
                  </p>
                  <Button to="/demo/contracts" variant="primary">Open portfolio</Button>
                </div>
              </div>
            </Reveal>
          </SpatialTransition>
        )}

        <RecentContracts organizationId={organizationId} />
      </OrganizationGate>
    </Section>
  );
}

function RecentContracts({ organizationId }) {
  const [state, setState] = useState("loading");
  const [contracts, setContracts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    listContracts(organizationId)
      .then((result) => {
        if (cancelled) return;
        setContracts(result?.contracts || []);
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
  }, [organizationId]);

  if (state === "loading") return <LoadingState label="Loading your contracts…" />;
  if (state === "error") return <ErrorState message={errorMessage} />;
  if (!contracts.length) {
    return (
      <EmptyState
        title="No contracts yet"
        description="Upload your first contract above to start Contract Intelligence analysis."
      />
    );
  }

  return (
    <Reveal className="op-flow-shell">
      <div className="op-flow-main">
        <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Recent work</p>
        <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-4)" }}>Recent contracts</h2>
        <div className="op-list-table">
          {contracts.slice(0, 5).map((contract) => (
            <Link
              key={contract.id}
              to={`/demo/contracts/${contract.id}`}
              className="op-list-row"
            >
              <span className="op-body">{contract.title}</span>
              <span className="op-badge">{contract.status}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="op-flow-rail">
        <div className="op-surface-inspector" style={{ padding: "var(--op-space-5)" }}>
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Operational note</p>
          <p className="op-body-sm">
            Recent work reflects currently ingested contracts only. No downstream
            intelligence values are synthesized in this surface.
          </p>
        </div>
      </div>
    </Reveal>
  );
}
