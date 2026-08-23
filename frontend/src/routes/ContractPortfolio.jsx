import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Section } from "../components/ui/Layout";
import Reveal from "../components/ui/Reveal";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/States";
import OrganizationGate from "../components/demo/OrganizationGate";
import { useOrganization } from "../context/OrganizationContext";
import { listContracts } from "../lib/contractsApi";

export default function ContractPortfolio() {
  const { organizationId } = useOrganization();

  return (
    <Section>
      <Reveal>
        <p className="op-eyebrow">Contract Portfolio</p>
        <h1 className="op-heading-lg" style={{ marginBottom: "var(--op-space-6)" }}>
          Portfolio operations
        </h1>
      </Reveal>

      <OrganizationGate>
        <PortfolioList organizationId={organizationId} />
      </OrganizationGate>
    </Section>
  );
}

function PortfolioList({ organizationId }) {
  const [state, setState] = useState("loading");
  const [contracts, setContracts] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedContract, setSelectedContract] = useState(null);

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

  const visible = useMemo(() => {
    const filtered = contracts.filter((contract) =>
      contract.title?.toLowerCase().includes(query.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at);
      return sortDesc ? -diff : diff;
    });
  }, [contracts, query, sortDesc]);

  if (state === "loading") return <LoadingState label="Loading contracts…" />;
  if (state === "error") return <ErrorState message={errorMessage} />;

  return (
    <div>
      <Reveal style={{ marginBottom: "var(--op-space-6)" }}>
        <div className="op-surface-plane-primary" style={{ padding: "var(--op-space-5)" }}>
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Contextual layer</p>
          <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-2)" }}>Portfolio to workspace transition</h2>
          <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
            Select a contract to open document and extraction context. Clause, obligation,
            and downstream evidence views remain explicitly unavailable in this layer.
          </p>
          <div className="op-spatial-stage">
            <span className="op-stage-chip op-stage-chip-active">Portfolio</span>
            <span className="op-stage-chip op-stage-chip-active">Contract</span>
            <span className="op-stage-chip op-stage-chip-active">Document</span>
            <span className="op-stage-chip op-stage-chip-active">Analysis</span>
            <span className="op-stage-chip op-stage-chip-unavailable">Obligations</span>
            <span className="op-stage-chip op-stage-chip-unavailable">Impact</span>
          </div>
        </div>
      </Reveal>

      <Reveal className="op-surface" style={{ display: "flex", gap: "var(--op-space-3)", marginBottom: "var(--op-space-6)", flexWrap: "wrap", padding: "var(--op-space-4)" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contracts…"
          className="op-input"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button type="button" className="op-btn op-btn-secondary" onClick={() => setSortDesc((value) => !value)}>
          Sort: {sortDesc ? "Newest first" : "Oldest first"}
        </button>
      </Reveal>

      {!visible.length ? (
        <EmptyState
          title={contracts.length ? "No contracts match your search" : "No contracts yet"}
          description={contracts.length ? "Try a different search term." : "Upload a contract from the Intelligence Hub to get started."}
        />
      ) : (
        <div className="op-flow-shell" style={{ alignItems: "start" }}>
          <div className="op-list-table op-flow-main">
            {visible.map((contract) => (
              <Reveal
                key={contract.id}
                as="div"
                className={[
                  "op-list-row",
                  selectedContract?.id === contract.id ? "op-list-row-selected op-motion-focus" : "",
                ].join(" ").trim()}
              >
                <div>
                  <h3 className="op-heading-md" style={{ marginBottom: 4 }}>{contract.title}</h3>
                  <p className="op-body-sm" style={{ margin: 0 }}>
                    Created {new Date(contract.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="op-badge">{contract.status}</span>
                <button
                  type="button"
                  className="op-btn op-btn-quiet"
                  aria-label={`Inspect ${contract.title}`}
                  onClick={() => {
                    setSelectedContract(contract);
                  }}
                >
                  Inspect
                </button>
                <Link
                  className="op-btn op-btn-secondary"
                  to={`/demo/contracts/${contract.id}`}
                  aria-label={`Open workspace for ${contract.title}`}
                >
                  Open
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal className="op-flow-rail">
            <div className="op-surface-inspector" style={{ padding: "var(--op-space-5)" }}>
              <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Inspector preview</p>
              {!selectedContract ? (
                <p className="op-body-sm">
                  Select Inspect on any contract to view contextual metadata and available actions.
                </p>
              ) : (
                <>
                  <h3 className="op-heading-sm" style={{ marginBottom: "var(--op-space-3)" }}>
                    {selectedContract.title}
                  </h3>
                  <div className="op-stack" style={{ gap: "var(--op-space-2)", marginBottom: "var(--op-space-3)" }}>
                    <div className="op-inspector-kv">
                      <span className="op-body-sm">Status</span>
                      <span className="op-body-sm">{selectedContract.status || "unknown"}</span>
                    </div>
                    <div className="op-inspector-kv">
                      <span className="op-body-sm">Created</span>
                      <span className="op-body-sm">{new Date(selectedContract.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="op-inspector-kv">
                      <span className="op-body-sm">Organization</span>
                      <span className="op-body-sm">{selectedContract.organization_id || "unknown"}</span>
                    </div>
                  </div>

                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-1)" }}>Known relationships</p>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-2)" }}>
                    {"Contract -> Documents -> Extraction status"}
                  </p>

                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-1)" }}>Available actions</p>
                  <p className="op-body-sm" style={{ marginBottom: "var(--op-space-2)" }}>
                    Open contract workspace, inspect current status
                  </p>

                  <p className="op-kicker" style={{ marginBottom: "var(--op-space-1)" }}>Unavailable capabilities</p>
                  <p className="op-body-sm">
                    Clause-level and obligation-level views are not yet available in this route.
                  </p>
                </>
              )}
            </div>
          </Reveal>
        </div>
      )}
    </div>
  );
}
