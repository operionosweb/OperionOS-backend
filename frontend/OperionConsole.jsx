import { useEffect, useState } from "react";
import axios from "axios";

export default function OperionConsole() {
  const [tenantId, setTenantId] = useState("tenant_1");
  const [systemData, setSystemData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);

  // =========================
  // WORKFLOW BUILDER STATE
  // =========================
  const [workflows, setWorkflows] = useState([]);
  const [workflowName, setWorkflowName] = useState("");

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

  // =========================
  // LOAD WORKFLOWS (LOCAL FOR NOW)
  // =========================
  async function loadWorkflows() {
    // placeholder (backend-ready structure)
    const saved = localStorage.getItem(`workflows_${tenantId}`);
    setWorkflows(saved ? JSON.parse(saved) : []);
  }

  // =========================
  // CREATE WORKFLOW
  // =========================
  async function createWorkflow() {
    const newWorkflow = {
      id: Date.now(),
      name: workflowName,
      trigger_type: "FLEET_RISK",
      nodes: [
        { id: "1", type: "trigger", label: "Trigger Event" },
        { id: "2", type: "condition", label: "Condition Check" },
        { id: "3", type: "action", label: "Execute Action" }
      ],
      edges: [
        { from: "1", to: "2" },
        { from: "2", to: "3" }
      ]
    };

    const updated = [...workflows, newWorkflow];

    setWorkflows(updated);
    localStorage.setItem(`workflows_${tenantId}`, JSON.stringify(updated));

    setWorkflowName("");
  }

  useEffect(() => {
    loadHealth();
    loadWorkflows();
  }, [tenantId]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial", background: "#0b0b0b", color: "#fff", minHeight: "100vh" }}>

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

      {/* DECISION LAYER */}
      {systemData && (
        <div style={{ marginTop: 20 }}>
          <h2>🧠 Decision Layer</h2>

          <p><b>Decision:</b> {systemData.decision}</p>
          <p><b>Health Score:</b> {systemData.healthScore}</p>
          <p><b>Load Level:</b> {systemData.load?.loadLevel}</p>
        </div>
      )}

      {/* ========================= */}
      {/* WORKFLOW BUILDER UI */}
      {/* ========================= */}
      <div style={{ marginTop: 40, padding: 20, border: "1px solid #333", borderRadius: 8 }}>
        <h2>🧠 Workflow Automation Builder</h2>

        <div style={{ marginBottom: 10 }}>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name"
            style={{ padding: 8, marginRight: 10 }}
          />

          <button onClick={createWorkflow} style={{ padding: 8 }}>
            Create Workflow
          </button>
        </div>

        {/* WORKFLOW LIST */}
        <div style={{ marginTop: 20 }}>
          {workflows.length === 0 && <p>No workflows created yet.</p>}

          {workflows.map((wf) => (
            <div
              key={wf.id}
              style={{
                marginBottom: 15,
                padding: 10,
                border: "1px solid #444",
                borderRadius: 6
              }}
            >
              <b>⚙️ {wf.name}</b>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {wf.nodes?.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background:
                        n.type === "trigger"
                          ? "#ef4444"
                          : n.type === "condition"
                          ? "#f59e0b"
                          : "#10b981",
                      color: "#fff",
                      fontSize: 12,
                    }}
                  >
                    {n.label}
                  </div>
                ))}
              </div>

              <small style={{ opacity: 0.6 }}>
                edges: {wf.edges?.length || 0}
              </small>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
