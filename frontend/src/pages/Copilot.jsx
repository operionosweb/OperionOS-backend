import React, { useEffect, useState } from "react";

export default function Copilot() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadCopilot() {

    try {

      const res = await fetch(
        "https://operionos-backend-1.onrender.com/api/ai/copilot"
      );

      const json = await res.json();

      setData(json.copilot);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCopilot();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        Loading Copilot...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        Failed to load Copilot data
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>

      {/* HEADER */}
      <h2>🧠 Operion AI Copilot</h2>

      <p>
        Mode: <b>{data.operationalMode}</b>
      </p>

      <p>
        Decision: <b>{data.priorityDecision}</b>
      </p>

      <hr />

      {/* SUMMARY */}
      <h3>📊 Executive Summary</h3>
      <p>{data.executiveSummary}</p>

      <hr />

      {/* METRICS */}
      <h3>📈 Fleet Metrics</h3>

      <ul>
        <li>Average Risk: {data.metrics.averageRisk}</li>
        <li>Critical Aircraft: {data.metrics.criticalCount}</li>
        <li>High Risk: {data.metrics.highCount}</li>
      </ul>

      <hr />

      {/* TOP RISKS */}
      <h3>🚨 Top Critical Aircraft</h3>

      {data.topRisks.length === 0 ? (
        <p>No critical aircraft</p>
      ) : (
        <ul>
          {data.topRisks.map((a) => (
            <li key={a.id}>
              {a.tail} — Risk: {Math.round(a.failure)}
            </li>
          ))}
        </ul>
      )}

      <hr />

      {/* PREDICTIONS */}
      <h3>🔮 Predicted Failures</h3>

      <ul>
        {data.predictedFailures.map((p, i) => (
          <li key={i}>
            {p.aircraft} → {p.prediction} ({p.probability}%)
          </li>
        ))}
      </ul>

      <hr />

      {/* ACTIONS */}
      <h3>🛠 Recommended Actions</h3>

      <ul>
        {data.recommendedActions.map((a, i) => (
          <li key={i}>
            {a.type} — Priority: {a.priority}
          </li>
        ))}
      </ul>

    </div>
  );
}
