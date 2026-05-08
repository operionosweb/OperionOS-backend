import React, { useEffect, useState } from "react";

export default function Copilot() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  async function loadCopilot() {

    try {

      const res = await fetch(
        "https://operionos-backend-1.onrender.com/api/ai/copilot"
      );

      const json = await res.json();

      const copilot = json.copilot;

      setData(copilot);

      /* ===============================
         ALERT ENGINE (FRONTEND LAYER)
      =============================== */

      const newAlerts = [];

      if (copilot.operationalMode === "EMERGENCY") {
        newAlerts.push({
          level: "CRITICAL",
          message: "Emergency mode active — immediate action required"
        });
      }

      if (copilot.metrics.criticalCount > 0) {
        newAlerts.push({
          level: "HIGH",
          message: `${copilot.metrics.criticalCount} critical aircraft detected`
        });
      }

      if (copilot.metrics.averageRisk > 60) {
        newAlerts.push({
          level: "WARNING",
          message: "Fleet risk above safe threshold"
        });
      }

      setAlerts(newAlerts);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {

    loadCopilot();

    /* ===============================
       AUTO REFRESH (REAL-TIME SIM)
    =============================== */

    const interval = setInterval(() => {
      loadCopilot();
    }, 15000); // every 15 seconds

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading Copilot...</div>;
  }

  if (!data) {
    return <div style={{ padding: 20 }}>Failed to load Copilot</div>;
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>

      {/* HEADER */}
      <h2>🧠 Operion AI Copilot</h2>

      <p>
        Mode: <b>{data.operationalMode}</b>
      </p>

      <p>
        Decision: <b>{data.priorityDecision}</b>
      </p>

      {/* ALERTS PANEL */}
      <hr />

      <h3>🚨 Live Alerts</h3>

      {alerts.length === 0 ? (
        <p>No active alerts</p>
      ) : (
        <ul>
          {alerts.map((a, i) => (
            <li key={i}>
              <b>[{a.level}]</b> {a.message}
            </li>
          ))}
        </ul>
      )}

      {/* SUMMARY */}
      <hr />

      <h3>📊 Executive Summary</h3>
      <p>{data.executiveSummary}</p>

      {/* METRICS */}
      <hr />

      <h3>📈 Fleet Metrics</h3>

      <ul>
        <li>Average Risk: {data.metrics.averageRisk}</li>
        <li>Critical Aircraft: {data.metrics.criticalCount}</li>
        <li>High Risk: {data.metrics.highCount}</li>
      </ul>

      {/* TOP RISKS */}
      <hr />

      <h3>🚨 Critical Aircraft</h3>

      {data.topRisks.length === 0 ? (
        <p>No critical aircraft</p>
      ) : (
        <ul>
          {data.topRisks.map((a) => (
            <li key={a.id}>
              {a.tail} — Risk {Math.round(a.failure)}
            </li>
          ))}
        </ul>
      )}

      {/* PREDICTIONS */}
      <hr />

      <h3>🔮 Predictions</h3>

      <ul>
        {data.predictedFailures.map((p, i) => (
          <li key={i}>
            {p.aircraft} → {p.prediction}
          </li>
        ))}
      </ul>

      {/* ACTIONS */}
      <hr />

      <h3>🛠 Recommended Actions</h3>

      <ul>
        {data.recommendedActions.map((a, i) => (
          <li key={i}>
            {a.type} ({a.priority})
          </li>
        ))}
      </ul>

    </div>
  );
}
