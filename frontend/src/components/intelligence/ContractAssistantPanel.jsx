import React, { useState } from "react";

import { askContractAssistant } from "../../lib/contractsApi";
import Button from "../ui/Button";
import EvidencePanel from "./EvidencePanel";

const EXAMPLES = [
  "What happens if we return the aircraft late?",
  "Who is responsible for maintenance?",
  "What notice period applies before termination?",
];

export default function ContractAssistantPanel({ analysisRunId, organizationId }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event?.preventDefault();
    if (!analysisRunId || question.trim().length < 3) return;
    setState("loading");
    setError("");
    try {
      const response = await askContractAssistant(analysisRunId, organizationId, question.trim());
      setResult(response?.assistant || null);
      setState("ready");
    } catch (requestError) {
      setError(requestError.message || "The contract assistant could not answer this question.");
      setState("error");
    }
  }

  function openFinding(finding) {
    const element = document.getElementById(`${finding.type}-${finding.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="op-surface-plane-primary" style={{ padding: "var(--op-space-5)" }}>
      <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>Contract assistant</p>
      <h2 className="op-heading-md" style={{ marginBottom: "var(--op-space-3)" }}>Ask this contract</h2>
      <p className="op-body-sm" style={{ marginBottom: "var(--op-space-4)" }}>
        Answers are limited to this analysis run and require supporting contract evidence.
      </p>

      {!analysisRunId ? (
        <p className="op-body-sm">Run clause analysis before asking contract-specific questions.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)", marginBottom: "var(--op-space-4)" }}>
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="op-badge" onClick={() => setQuestion(example)}>{example}</button>
            ))}
          </div>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--op-space-3)", alignItems: "end" }}>
            <label className="op-body-sm">
              Question
              <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about a term, obligation, deadline, or risk" style={{ width: "100%", marginTop: "var(--op-space-2)" }} />
            </label>
            <Button type="submit" disabled={state === "loading" || question.trim().length < 3}>
              {state === "loading" ? "Checking evidence..." : "Ask"}
            </Button>
          </form>
        </>
      )}

      {state === "error" && <p className="op-body-sm" style={{ color: "var(--op-signal-risk)", marginTop: "var(--op-space-4)" }}>{error}</p>}
      {result && (
        <div className="op-surface-inspector" aria-live="polite" style={{ padding: "var(--op-space-4)", marginTop: "var(--op-space-4)" }}>
          <p className="op-kicker" style={{ marginBottom: "var(--op-space-2)" }}>{result.established ? "Evidence-backed answer" : "Not established"}</p>
          <p className="op-body" style={{ marginBottom: "var(--op-space-4)" }}>{result.answer}</p>
          {result.findings?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--op-space-2)", marginBottom: "var(--op-space-4)" }}>
              {result.findings.map((finding) => (
                <button key={`${finding.type}-${finding.id}`} type="button" className="op-badge" onClick={() => openFinding(finding)}>
                  {finding.type}: {finding.label}
                </button>
              ))}
            </div>
          )}
          <EvidencePanel findingLabel="Assistant answer" evidence={result.evidence || []} />
        </div>
      )}
    </section>
  );
}
