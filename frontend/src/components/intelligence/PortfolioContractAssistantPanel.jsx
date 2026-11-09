import React, { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../ui/Button";
import { askPortfolioContractAssistant } from "../../lib/contractsApi";

const EXAMPLES = [
  "What are our aircraft redelivery obligations?",
  "Which leases contain maintenance reserve or rent escalation terms?",
  "What lease risks have an existing recommendation for review?",
];

const FINDING_LABELS = {
  clause: "Extracted contract text (unverified)",
  obligation: "Extracted obligation (unverified)",
  deadline: "Existing deadline intelligence",
  risk: "Existing risk assessment (not a confirmed breach)",
};

const CITATION_LABELS = {
  indexed_contract_passage: "Indexed source passage",
  structured_intelligence: "Structured intelligence evidence",
  financial_evidence: "Financial evidence",
  recommendation_evidence: "Recommendation evidence",
  aircraft_relationship_evidence: "Aircraft relationship evidence",
};

function sourceWorkspacePath(citation) {
  const contractPath = `/app/contracts/${citation.contract.id}`;
  if (!citation.analysisRunId) return contractPath;
  const anchor = citation.clause?.id ? `#clause-${citation.clause.id}` : "#clauses";
  return `${contractPath}?analysisRunId=${encodeURIComponent(citation.analysisRunId)}${anchor}`;
}

export default function PortfolioContractAssistantPanel({ organizationId }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (question.trim().length < 3) return;
    setState("loading");
    setError("");
    setResult(null);
    try {
      const response = await askPortfolioContractAssistant(organizationId, question.trim());
      if (!response?.assistant || typeof response.assistant.answer !== "string") {
        throw new Error("Portfolio contract retrieval returned an invalid response.");
      }
      setResult(response.assistant);
      setState("ready");
    } catch (requestError) {
      setError(requestError.message || "Portfolio contract retrieval could not be completed.");
      setState("error");
    }
  }

  return (
    <section className="op-surface" style={{ padding: "var(--op-space-4)", marginBottom: "var(--op-space-4)" }}>
      <p className="op-kicker">Portfolio contract intelligence</p>
      <h3 className="op-heading-sm">Ask across accessible indexed contracts</h3>
      <p className="op-body-sm">
        Answers use deterministic summaries of existing indexed and structured intelligence from completed analyses in this organization. Results are not a complete portfolio inventory or legal determination, and no controlling contract version is selected.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)", margin: "var(--op-space-3) 0" }}>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="op-badge" onClick={() => setQuestion(example)}>{example}</button>
        ))}
      </div>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--op-space-3)", alignItems: "end" }}>
        <label className="op-body-sm">
          Portfolio question
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={3}
            maxLength={500}
            placeholder="Ask about terms across your aviation contracts"
            style={{ width: "100%", marginTop: "var(--op-space-2)" }}
          />
        </label>
        <Button type="submit" disabled={state === "loading" || question.trim().length < 3}>
          {state === "loading" ? "Reviewing evidence…" : "Ask portfolio"}
        </Button>
      </form>
      {state === "error" && <p className="op-body-sm" role="alert" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-3)" }}>{error}</p>}
      {result && (
        <div className="op-surface-inspector" aria-live="polite" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-4)" }}>
          <p className="op-kicker">
            {result.answerType === "deterministic_structured_answer" ? "Deterministic evidence-grounded answer" : "Retrieved evidence; no structured answer established"}
          </p>
          <p className="op-body">{result.answer}</p>
          {result.structuredAnswers?.map((item, index) => (
            <section key={`${item.contract.id}-${item.version.id}-${index}`} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-3)" }}>
              <p className="op-body-sm"><strong>{item.contract.title}</strong>{" · "}version {item.version.number}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)", margin: "var(--op-space-2) 0" }}>
                {item.findingTypes.map((type) => <span className="op-badge" key={type}>{FINDING_LABELS[type] || "Derived intelligence"}</span>)}
              </div>
              <p className="op-body-sm">{item.answer}</p>
            </section>
          ))}
          {result.financialFindings?.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Existing financial intelligence</p>
              {result.financialFindings.map((item, index) => (
                <article key={`${item.contract.id}-${item.version.id}-${item.category}-${index}`} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <p className="op-body-sm"><strong>{item.contract.title}</strong>{" · "}version {item.version.number}{" · "}{item.description}</p>
                  <p className="op-body-sm">{item.resultLabel || "Amount not quantified"}</p>
                  {item.calculation && <p className="op-body-sm">{item.calculation}</p>}
                  {item.calculationLimitations?.map((limitation) => <p className="op-body-sm" key={limitation}>{limitation}</p>)}
                </article>
              ))}
            </section>
          )}
          {result.recommendations?.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Existing recommended actions · human review required</p>
              {result.recommendations.map((item, index) => (
                <article key={`${item.contract.id}-${item.version.id}-${index}`} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
                  <p className="op-body-sm"><strong>{item.contract.title}</strong>{" · "}version {item.version.number}{" · "}{item.urgency} priority · {item.status}</p>
                  <p className="op-body-sm">{item.action}</p>
                  {item.rationale && <p className="op-body-sm">{item.rationale}</p>}
                  {item.ownerRole && <p className="op-body-sm">Suggested owner: {item.ownerRole}</p>}
                </article>
              ))}
            </section>
          )}
          {result.aircraftRelationships?.length > 0 && (
            <section style={{ marginTop: "var(--op-space-4)" }}>
              <p className="op-kicker">Existing aircraft relationships</p>
              {result.aircraftRelationships.map((item, index) => (
                <p className="op-body-sm" key={`${item.contract.id}-${item.version.id}-${index}`}>
                  {item.contract.title} (version {item.version.number}): {item.registration || item.serialNumber || item.aircraftType || "Aircraft"} · {item.relationshipType}
                </p>
              ))}
            </section>
          )}
          {result.citations?.map((citation) => (
            <article key={citation.id} className="op-surface-plane-secondary" style={{ padding: "var(--op-space-3)", marginTop: "var(--op-space-2)" }}>
              <p className="op-body-sm">
                <strong>{citation.contract.title}</strong>
                {" · "}version {citation.version.number}
                {citation.clause?.number ? ` · clause ${citation.clause.number}` : ""}
                {citation.clause?.title ? ` · ${citation.clause.title}` : ""}
                {citation.source.locator ? ` · ${citation.source.locator}` : ""}
                {" · "}{CITATION_LABELS[citation.type] || "Source evidence"}
              </p>
              <blockquote className="op-body-sm" style={{ margin: "var(--op-space-2) 0" }}>“{citation.source.excerpt}”</blockquote>
              <p className="op-body-sm">Source reference: {citation.source.id || citation.id}</p>
              <Link className="op-btn op-btn-quiet" to={sourceWorkspacePath(citation)}>
                Open contract workspace ↗
              </Link>
            </article>
          ))}
          {result.uncertainty?.length > 0 && (
            <div style={{ marginTop: "var(--op-space-3)" }}>
              <p className="op-kicker">Coverage and limitations</p>
              {result.uncertainty.map((item) => <p className="op-body-sm" key={item}>{item}</p>)}
              <p className="op-body-sm">
                Retrieved passages: {result.coverage?.returnedPassages ?? 0}
                {" · "}contracts represented: {result.coverage?.returnedContracts ?? 0}
                {" · "}coverage {result.coverage?.completeness || "unknown"}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
