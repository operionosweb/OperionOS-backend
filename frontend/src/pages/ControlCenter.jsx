import React, { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

const API =
  "https://operionos-backend-1.onrender.com/api/control-center";

export default function ControlCenter() {

  const [fleet, setFleet] = useState([]);
  const [health, setHealth] = useState(null);

  async function loadData() {

    try {

      const token = localStorage.getItem("sb-token");

      const res = await fetch(API, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const json = await res.json();

      setFleet(json.fleet || []);
      setHealth(json.health || null);

    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pieData = health
    ? [
        {
          name: "Healthy",
          value: health.distribution.healthy
        },
        {
          name: "Warning",
          value: health.distribution.warning
        },
        {
          name: "Critical",
          value: health.distribution.critical
        }
      ]
    : [];

  return (
    <div
      style={{
        padding: 24,
        background: "#0b1020",
        minHeight: "100vh",
        color: "white"
      }}
    >

      <h1 style={{
        fontSize: 32,
        marginBottom: 20
      }}>
        ✈ Operion Executive Control Center
      </h1>

      {/* KPI ROW */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
          marginBottom: 30
        }}
      >

        <Card
          title="Operational Readiness"
          value={`${health?.readiness || 0}%`}
        />

        <Card
          title="Average Fleet Risk"
          value={`${health?.avgRisk || 0}%`}
        />

        <Card
          title="Fleet Size"
          value={fleet.length}
        />

        <Card
          title="Critical Aircraft"
          value={health?.distribution?.critical || 0}
        />

      </div>

      {/* CHARTS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 30
        }}
      >

        {/* PIE */}

        <div style={panelStyle}>

          <h3>Fleet Risk Distribution</h3>

          <ResponsiveContainer width="100%" height={300}>

            <PieChart>

              <Pie
                data={pieData}
                dataKey="value"
                outerRadius={100}
                label
              >
                <Cell fill="#22c55e" />
                <Cell fill="#facc15" />
                <Cell fill="#ef4444" />
              </Pie>

              <Tooltip />

            </PieChart>

          </ResponsiveContainer>

        </div>

        {/* BAR */}

        <div style={panelStyle}>

          <h3>Aircraft Risk Levels</h3>

          <ResponsiveContainer width="100%" height={300}>

            <BarChart data={fleet}>

              <XAxis dataKey="tail" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />

              <Bar dataKey="risk" fill="#3b82f6" />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </div>

      {/* AIRCRAFT TABLE */}

      <div style={panelStyle}>

        <h3>Fleet Overview</h3>

        {fleet.map((a) => (

          <div
            key={a.id}
            style={{
              padding: 14,
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between"
            }}
          >

            <div>
              <strong>{a.tail}</strong>
              <div>{a.model}</div>
            </div>

            <div>
              <div>
                Risk:
                <strong
                  style={{
                    color:
                      a.risk > 70
                        ? "#ef4444"
                        : a.risk > 40
                        ? "#facc15"
                        : "#22c55e"
                  }}
                >
                  {" "} {a.risk.toFixed(1)}%
                </strong>
              </div>

              <div>{a.status}</div>
            </div>

          </div>

        ))}

      </div>

    </div>
  );
}

/* ===============================
   CARD COMPONENT
=============================== */

function Card({ title, value }) {

  return (
    <div
      style={{
        background: "#111827",
        padding: 20,
        borderRadius: 14,
        border: "1px solid #1f2937"
      }}
    >

      <div
        style={{
          color: "#94a3b8",
          marginBottom: 10
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 32,
          fontWeight: "bold"
        }}
      >
        {value}
      </div>

    </div>
  );
}

const panelStyle = {
  background: "#111827",
  padding: 20,
  borderRadius: 14,
  border: "1px solid #1f2937"
};
