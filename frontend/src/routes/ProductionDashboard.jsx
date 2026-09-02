import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, FileCheck2, FileText, ShieldAlert, Upload } from "lucide-react";
import OrganizationGate from "../components/demo/OrganizationGate";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useOrganization } from "../context/OrganizationContext";
import { listContracts } from "../lib/contractsApi";

function DashboardContent({ organizationId }) {
  const [state, setState] = useState("loading");
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listContracts(organizationId)
      .then((result) => {
        if (cancelled) return;
        setContracts(result?.contracts || []);
        setState("ready");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || "The contract portfolio could not be loaded.");
        setState("error");
      });
    return () => { cancelled = true; };
  }, [organizationId]);

  const summary = useMemo(() => {
    const active = contracts.filter((contract) => String(contract.status).toLowerCase() === "active").length;
    const statuses = new Set(contracts.map((contract) => contract.status).filter(Boolean)).size;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = contracts.filter((contract) => new Date(contract.created_at).getTime() >= cutoff).length;
    return { active, statuses, recent };
  }, [contracts]);

  if (state === "loading") {
    return <div className="op-metric-grid" role="status" aria-label="Loading dashboard">{[1, 2, 3, 4].map((item) => <div className="op-skeleton" key={item} />)}</div>;
  }
  if (state === "error") return <ErrorState message={error} />;
  if (!contracts.length) {
    return <EmptyState title="Your contract intelligence workspace is ready" description="Upload your first aviation contract to begin deterministic document processing and contract intelligence analysis." action={<Link to="/app/upload" className="op-primary-action"><Upload size={17} />Upload contract</Link>} />;
  }

  const metrics = [
    { label: "Contracts", value: contracts.length, note: "Registered in this organisation", icon: FileText },
    { label: "Active", value: summary.active, note: "Based on contract status", icon: Activity },
    { label: "Statuses represented", value: summary.statuses, note: "Distinct recorded contract states", icon: FileCheck2 },
    { label: "Added recently", value: summary.recent, note: "Within the last 30 days", icon: ShieldAlert },
  ];

  return (
    <>
      <div className="op-metric-grid">
        {metrics.map(({ label, value, note, icon: Icon }) => (
          <article className="op-metric-card" key={label}>
            <span className="op-metric-card-icon"><Icon size={18} /></span>
            <span>{label}</span><strong>{value}</strong><small>{note}</small>
          </article>
        ))}
      </div>
      <div className="op-dashboard-grid">
        <section className="op-intelligence-panel">
          <div className="op-section-heading"><div><span className="op-page-kicker">Portfolio</span><h2>Recent contracts</h2></div><Link to="/app/contracts">View all</Link></div>
          <div className="op-contract-list">
            {contracts.slice(0, 6).map((contract) => (
              <Link className="op-contract-card" to={`/app/contracts/${contract.id}`} key={contract.id}>
                <div><h3>{contract.title || contract.filename || "Untitled contract"}</h3><div className="op-contract-card-meta"><span>{contract.contract_type || "Contract type not recorded"}</span><span>{contract.supplier_name || "Counterparty not recorded"}</span><span>Added {new Date(contract.created_at).toLocaleDateString()}</span></div></div>
                <span className={`op-status-badge${contract.status ? "" : " is-neutral"}`}>{contract.status || "Status unavailable"}</span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="op-intelligence-panel">
          <div className="op-section-heading"><div><span className="op-page-kicker">Attention</span><h2>Portfolio intelligence</h2></div></div>
          <div className="op-honest-boundary"><strong>Open a contract for intelligence</strong><p>Risk, obligation, deadline, and evidence APIs are contract-scoped. Operion will not infer portfolio totals by downloading every contract analysis into the browser.</p></div>
          <div className="op-honest-boundary" style={{ marginTop: 12 }}><strong>Intelligence Budget</strong><p>Budget estimates and remaining capacity appear before supported semantic analysis. A portfolio budget endpoint is not currently exposed.</p></div>
        </aside>
      </div>
    </>
  );
}

export default function ProductionDashboard() {
  const { organizationId } = useOrganization();
  return <><header className="op-page-heading"><div><span className="op-page-kicker">Contract intelligence</span><h1>Good morning</h1><p>What in your contract portfolio needs attention?</p></div><div className="op-page-actions"><Link className="op-secondary-action" to="/app/contracts">View contracts</Link><Link className="op-primary-action" to="/app/upload"><Upload size={17} />Upload</Link></div></header><OrganizationGate><DashboardContent organizationId={organizationId} /></OrganizationGate></>;
}
