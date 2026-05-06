import { useEffect, useState } from "react";
import axios from "axios";

export default function OperionConsole() {
  const [tenantId, setTenantId] = useState("tenant_1");
  const [systemData, setSystemData] = useState(null);
  const [actions, setActions] = useState([]);

  const API_BASE = "https://operionos-backend-1.onrender.com";

  async function runSystem() {
    const res = await axios.post(`${API_BASE}/execute/${tenantId}`);
    setSystemData(res.data);

    await axios.post(`${API_BASE}/workflow/${tenantId}/run`, res.data);

    loadActions();
  }

  async function loadActions() {
    const res = await axios.get(`${API_BASE}/actions/${tenantId}`);
    setActions(res.data);
  }

  async function approveAction(id) {
    await axios.post(`${API_BASE}/actions/${tenantId}/${id}/approve`);
    loadActions();
  }

  async function rejectAction(id) {
    await axios.post(`${API_BASE}/actions/${tenantId}/${id}/reject`);
    loadActions();
  }

  useEffect(() => {
    loadActions();
  }, [tenantId]);

  return (
    <div style={{ padding: 20 }}>
      <h1>🧭 Operion Action Engine</h1>

      <button onClick={runSystem}>Run System</button>

      <h2>🧠 Suggested Actions</h2>

      {actions.map(a => (
        <div key={a.id} style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
          <b>{a.workflow}</b>
          <p>{a.suggestedAction}</p>
          <p>Status: {a.status}</p>

          {a.status === "PENDING_APPROVAL" && (
            <>
              <button onClick={() => approveAction(a.id)}>Approve</button>
              <button onClick={() => rejectAction(a.id)}>Reject</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
