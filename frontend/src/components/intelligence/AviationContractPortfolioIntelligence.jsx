import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAviationContractPortfolioIntelligence } from "../../lib/contractsApi";
import AviationPredictiveContractRisk from "./AviationPredictiveContractRisk";

function workspacePath(contract, clauseId = null) {
  const query = contract.analysisRunId
    ? `?analysisRunId=${encodeURIComponent(contract.analysisRunId)}`
    : "";
  const anchor = clauseId ? `#clause-${encodeURIComponent(clauseId)}` : "#clauses";
  return `/app/contracts/${encodeURIComponent(contract.id)}${query}${anchor}`;
}

function renderAmounts(items) {
  if (!items?.length) return "No supported amount";
  return items.map(({ currency, amount }) => `${currency} ${Number(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(" · ");
}

function EvidenceList({ evidence }) {
  if (!evidence?.length) return null;
  return (
    <ul className="op-body-sm">
      {evidence.map((item, index) => (
        <li key={`${item.evidenceId}-${index}`}>
          {item.evidenceType || "Source"} · {item.sourceLocator || (item.pageNumber ? `page ${item.pageNumber}` : "source location unavailable")}
          {item.excerpt ? ` — “${item.excerpt}”` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function AviationContractPortfolioIntelligence({ organizationId }) {
  const [state, setState] = useState("loading");
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError("");
    getAviationContractPortfolioIntelligence(organizationId)
      .then((response) => {
        if (cancelled) return;
        if (!response?.portfolio || !Array.isArray(response.portfolio.contracts)) {
          throw new Error("Aviation portfolio intelligence returned an invalid response.");
        }
        setPortfolio({
          ...response.portfolio,
          predictiveRisk: response.predictiveRisk || null,
        });
        setState("ready");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || "Aviation portfolio intelligence is unavailable.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadToken]);

  return (
    <section className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-5)" }} aria-label="Aviation contract portfolio intelligence">
      <p className="op-kicker">Aviation contract portfolio intelligence</p>
      <h2 className="op-heading-md">Connected aircraft exposure and deadlines</h2>
      <p className="op-body-sm">
        Evidence-backed, read-time analysis of confirmed aviation profiles with completed analyses. This is not a complete contract inventory, a risk score, or a legal determination.
      </p>
      {state === "loading" && <p className="op-body-sm" role="status">Reviewing organization-scoped aviation evidence…</p>}
      {state === "error" && (
        <div role="alert">
          <p className="op-body-sm" style={{ color: "var(--op-signal-risk)" }}>{error}</p>
          <button type="button" className="op-btn op-btn-secondary" onClick={() => setReloadToken((value) => value + 1)}>Retry</button>
        </div>
      )}
      {state === "ready" && portfolio && (
        <>
          <div className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
            <p className="op-body-sm">
              {portfolio.contracts.length} supported aviation contract(s) · {portfolio.aircraft.length} aircraft link group(s) · {portfolio.relationships.confirmedSharedAircraft.length} confirmed shared-aircraft relationship(s)
            </p>
            <p className="op-body-sm">{portfolio.coverage.contractsWithoutConfirmedAircraftLinks} included contract(s) do not have a current-version verified aircraft link.</p>
            <p className="op-body-sm">Current estimates by currency: {renderAmounts(portfolio.financialExposure.currentByCurrency)}</p>
            <p className="op-body-sm">Projected estimates by currency: {renderAmounts(portfolio.financialExposure.projectedByCurrency)}</p>
            <p className="op-body-sm">Counterparty identity: unresolved — similar names are not merged. Cross-contract obligation dependencies are not inferred.</p>
            {(portfolio.coverage.runsTruncated || portfolio.coverage.relationshipsTruncated) && (
              <p className="op-body-sm" role="status">Portfolio retrieval reached a safety limit; this result is incomplete.</p>
            )}
          </div>
          <AviationPredictiveContractRisk assessment={portfolio.predictiveRisk} />

          {portfolio.prioritizedFindings.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Evidence-backed review priorities · no opaque score</p>
              {portfolio.prioritizedFindings.map((item) => {
                const contract = portfolio.contracts.find((candidate) => candidate.id === item.contractId);
                return (
                  <article key={item.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                    <p className="op-body-sm"><strong>{item.priority.replaceAll("_", " ")}:</strong> {item.explanation}</p>
                    <p className="op-body-sm">{item.contractTitle} · {item.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency} · {item.kind} · {item.unit.replaceAll("_", " ")} · clause {portfolio.financialExposure.findings.find((finding) => finding.id === item.id)?.clauseNumber || item.clauseId}</p>
                    {contract && <Link className="op-btn op-btn-quiet" to={workspacePath(contract, item.clauseId)}>Open supporting contract and clause</Link>}
                    <EvidenceList evidence={item.evidence} />
                  </article>
                );
              })}
            </section>
          )}

          {portfolio.aircraft.filter((item) => item.confirmedContractIds.length > 1 || item.status !== "confirmed").length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Aircraft relationships · verified, potential, and unresolved kept separate</p>
              {portfolio.aircraft
                .filter((item) => item.confirmedContractIds.length > 1 || item.status !== "confirmed")
                .map((aircraft) => (
                  <article key={aircraft.aircraftId} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                    <p className="op-body-sm"><strong>{aircraft.registration || aircraft.serialNumber || aircraft.aircraftType || "Aircraft identity unavailable"}</strong> · {aircraft.status}</p>
                    <p className="op-body-sm">Current exposure: {renderAmounts(aircraft.currentExposureByCurrency)} · projected: {renderAmounts(aircraft.projectedExposureByCurrency)}</p>
                    {aircraft.contracts.map((contract, index) => (
                      <p className="op-body-sm" key={`${contract.contractId}-${index}`}>
                        <Link to={workspacePath({ id: contract.contractId, analysisRunId: contract.analysisRunId })}>{contract.contractTitle}</Link>
                        {" · "}{contract.contractType || "aviation contract"} · {contract.relationshipType || "aircraft relationship"} · {contract.relationshipStatus}
                        {contract.evidence?.pageNumber ? ` · page ${contract.evidence.pageNumber}` : ""}
                      </p>
                    ))}
                    <EvidenceList evidence={aircraft.contracts.flatMap((item) => item.evidence ? [{
                      ...item.evidence,
                      evidenceType: `Aircraft relationship (${item.relationshipStatus})`,
                    }] : [])} />
                  </article>
                ))}
            </section>
          )}

          {portfolio.deadlineClusters.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Verified deadline clusters · timing is not dependency</p>
              {portfolio.deadlineClusters.map((cluster) => (
                <article key={`${cluster.date}-${cluster.contractIds.join(":")}`} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <p className="op-body-sm"><strong>{cluster.date}</strong> · {cluster.contracts.length} contracts · {cluster.explanation}</p>
                  {cluster.contracts.map((contract) => (
                    <p className="op-body-sm" key={contract.id}>
                      <Link to={workspacePath(contract)}>{contract.title}</Link>
                    </p>
                  ))}
                  {cluster.deadlines.map((deadline) => {
                    const contract = portfolio.contracts.find((item) => item.id === deadline.contractId);
                    return (
                      <div key={deadline.deadlineId}>
                        {contract && deadline.clauseId && (
                          <Link className="op-btn op-btn-quiet" to={workspacePath(contract, deadline.clauseId)}>
                            Open verified deadline clause · {contract.title}
                          </Link>
                        )}
                        <EvidenceList evidence={deadline.evidence} />
                      </div>
                    );
                  })}
                </article>
              ))}
            </section>
          )}

          {portfolio.recommendations.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Portfolio actions · human review required</p>
              {portfolio.recommendations.map((item) => (
                <article key={item.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <p className="op-body-sm"><strong>{item.title}</strong></p>
                  <p className="op-body-sm">{item.finding}</p>
                  <p className="op-body-sm">Action to consider: {item.action}</p>
                  <p className="op-body-sm">Potential consequence: {item.potentialConsequence}</p>
                  <p className="op-body-sm">Uncertainty: {item.uncertainty}</p>
                  {item.contractIds.map((id) => {
                    const contract = portfolio.contracts.find((candidate) => candidate.id === id);
                    return contract ? <p className="op-body-sm" key={id}><Link to={workspacePath(contract)}>{contract.title}</Link></p> : null;
                  })}
                  <EvidenceList evidence={item.supportingEvidence} />
                </article>
              ))}
            </section>
          )}

          {portfolio.status === "no_verified_aviation_analysis" && (
            <p className="op-body-sm">No supported confirmed aviation contract profile with a completed analysis is currently available for this organization.</p>
          )}
          <details style={{ marginTop: "var(--op-space-3)" }}>
            <summary className="op-body-sm">Coverage and limitations</summary>
            <p className="op-body-sm">{portfolio.coverage.limitation}</p>
            {portfolio.limitations.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
          </details>
          <button type="button" className="op-btn op-btn-secondary" style={{ marginTop: "var(--op-space-3)" }} onClick={() => setReloadToken((value) => value + 1)}>Refresh portfolio evidence</button>
        </>
      )}
    </section>
  );
}
