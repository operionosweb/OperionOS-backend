import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Search, Upload } from "lucide-react";
import OrganizationGate from "../components/demo/OrganizationGate";
import { EmptyState, ErrorState } from "../components/ui/States";
import { useOrganization } from "../context/OrganizationContext";
import { listContracts } from "../lib/contractsApi";

function Portfolio({ organizationId }) {
  const [state, setState] = useState("loading");
  const [contracts, setContracts] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listContracts(organizationId).then((result) => {
      if (cancelled) return;
      setContracts(result?.contracts || []);
      setState("ready");
    }).catch((requestError) => {
      if (cancelled) return;
      setError(requestError.message || "Contracts could not be loaded.");
      setState("error");
    });
    return () => { cancelled = true; };
  }, [organizationId]);

  const statuses = useMemo(() => [...new Set(contracts.map((contract) => contract.status).filter(Boolean))], [contracts]);
  const types = useMemo(() => [...new Set(contracts.map((contract) => contract.contract_type).filter(Boolean))], [contracts]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contracts.filter((contract) => {
      const searchable = [contract.title, contract.filename, contract.supplier_name, contract.contract_type].filter(Boolean).join(" ").toLowerCase();
      return (!needle || searchable.includes(needle)) && (status === "all" || contract.status === status) && (type === "all" || contract.contract_type === type);
    });
  }, [contracts, query, status, type]);

  if (state === "loading") return <div className="op-contract-list" role="status" aria-label="Loading contracts">{[1, 2, 3].map((item) => <div className="op-skeleton" key={item} />)}</div>;
  if (state === "error") return <ErrorState message={error} />;
  if (!contracts.length) return <EmptyState title="No contracts yet" description="Upload your first PDF or DOCX contract to begin deterministic processing." action={<Link to="/app/upload" className="op-primary-action"><Upload size={17} />Upload contract</Link>} />;

  return <><div className="op-filter-bar"><label className="op-filter-field" style={{ display: "flex", alignItems: "center", gap: 8 }}><Search size={17} color="var(--op-color-text-muted)" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contracts, counterparties, or types" style={{ width: "100%", border: 0, outline: 0, background: "transparent", font: "inherit" }} /></label><select className="op-filter-field" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><select className="op-filter-field" value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by contract type"><option value="all">All contract types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></div>{!visible.length ? <EmptyState title="No matching contracts" description="Adjust the search or filters to return to your portfolio." /> : <div className="op-contract-list">{visible.map((contract) => <article className="op-contract-card" key={contract.id}><div><div className="op-card-heading" style={{ marginBottom: 7 }}><div><span className="op-page-kicker">{contract.contract_type || "Contract"}</span><h3>{contract.title || contract.filename || "Untitled contract"}</h3></div><span className={`op-status-badge${contract.status ? "" : " is-neutral"}`}>{contract.status || "Status unavailable"}</span></div><div className="op-contract-card-meta"><span>{contract.supplier_name || "Counterparty not recorded"}</span><span>Added {new Date(contract.created_at).toLocaleDateString()}</span>{contract.risk_score != null && <span>Recorded risk score: {contract.risk_score}</span>}</div></div><Link to={`/app/contracts/${contract.id}`} className="op-secondary-action">Open workspace <ArrowRight size={16} /></Link></article>)}</div>}</>;
}

export default function ProductionContracts() {
  const { organizationId } = useOrganization();
  return <><header className="op-page-heading"><div><span className="op-page-kicker">Contract portfolio</span><h1>Contracts</h1><p>Understand the agreements that govern your aviation operations.</p></div><div className="op-page-actions"><Link to="/app/upload" className="op-primary-action"><Upload size={17} />Upload contract</Link></div></header><OrganizationGate><Portfolio organizationId={organizationId} /></OrganizationGate></>;
}
