import { useEffect, useState } from "react";
import axios from "axios";

export default function OperionConsole() {
  const [tenantId, setTenantId] = useState("tenant_1");
  const [systemData, setSystemData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = "https://operionos-backend-1.onrender.com";

  // =========================
  // RUN SYSTEM EXECUTION
  // =========================
  async function runSystem() {
    setLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE}/execute/${tenantId}`
      );

      setSystemData(res.data);
    } catch (err) {
      console.error("Execution error:", err);
    }

    setLoading(false);
  }

  // =========================
  // LOAD HEALTH DATA
  // =========================
  async function loadHealth() {
    try {
      const res = await axios.get(
        `${API_BASE}/control/${tenantId}/health`
      );

      setHealthData(res.data);
    } catch (err) {
      console.error("Health error:", err);
    }
  }

  useEffect(() => {
    loadHealth();
  }, [tenantId]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>

      <h1>🧭 Operion Control Center</h1>

      {/* TENANT CONTROL */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Tenant ID"
          style={{ padding: 8, width: 200 }}
        />

        <button onClick={runSystem} style={{ marginLeft: 10, padding: 8 }}>
          {loading ? "Running..." : "Run System"}
        </button>

        <button onClick={loadHealth} style={{ marginLeft: 10, padding: 8 }}>
          Refresh Health
        </button>
      </div>

      {/* EXECUTION OUTPUT */}
      <div style={{ marginTop: 20 }}>
        <h2>⚙️ Latest Execution</h2>

        {systemData ? (
          <pre style={{ background: "#111", color: "#0f0", padding: 10 }}>
            {JSON.stringify(systemData, null, 2)}
          </pre>
        ) : (
          <p>No execution yet.</p>
        )}
      </div>

      {/* SYSTEM HEALTH */}
      <div style={{ marginTop: 20 }}>
        <h2>📊 System Health</h2>

        {healthData ? (
          <pre style={{ background: "#222", color: "#fff", padding: 10 }}>
            {JSON.stringify(healthData, null, 2)}
          </pre>
        ) : (
          <p>No health data.</p>
        )}
      </div>

      {/* INTERPRETATION LAYER */}
      {systemData && (
        <div style={{ marginTop: 20 }}>
          <h2>🧠 Decision Layer</h2>

          <p><b>Decision:</b> {systemData.decision}</p>
          <p><b>Health Score:</b> {systemData.healthScore}</p>
          <p><b>Load Level:</b> {systemData.load?.loadLevel}</p>
        </div>
      )}

    </div>
  );
}
