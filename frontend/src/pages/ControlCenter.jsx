import { useEffect, useRef, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  const stateRef = useRef({});

  const fetchData = async () => {

    try {

      const res = await fetch(API);
      const json = await res.json();

      let newAlerts = [];

      const enriched = json?.aircraftRankings?.map((a, i) => {

        const id = a.aircraft.id;

        const baseLat = 41.3851;
        const baseLng = 2.1734;

        if (!stateRef.current[id]) {
          stateRef.current[id] = {
            lat: baseLat + i * 0.25,
            lng: baseLng + i * 0.2
          };
        }

        // movement simulation
        stateRef.current[id].lat += (Math.random() - 0.5) * 0.01;
        stateRef.current[id].lng += (Math.random() - 0.5) * 0.01;

        const flightHours = a.metrics.totalHours;
        const baseRisk = a.metrics.riskScore;

        const failureProbability =
          baseRisk * 0.6 +
          flightHours * 0.02 +
          Math.random() * 8;

        let recommendation = "OK TO OPERATE";
        let alertLevel = "normal";

        if (failureProbability > 75) {
          recommendation = "IMMEDIATE MAINTENANCE REQUIRED";
          alertLevel = "critical";
        } else if (failureProbability > 50) {
          recommendation = "SCHEDULE MAINTENANCE";
          alertLevel = "warning";
        }

        // create alerts
        if (alertLevel !== "normal") {
          newAlerts.push({
            id,
            tail: a.aircraft.tail_number,
            level: alertLevel,
            message: recommendation,
            score: failureProbability
          });
        }

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: baseRisk,
          hours: flightHours,
          failureProbability,
          recommendation,
          alertLevel,
          position: stateRef.current[id]
        };

      }) || [];

      setData(enriched);
      setAlerts(newAlerts);
      setLastUpdated(new Date());
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchData();

    const interval = setInterval(fetchData, 12000);

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        Initializing Decision Engine v1...
      </div>
    );
  }

  /* ===============================
     EXECUTIVE SUMMARY LOGIC
  =============================== */

  const criticalCount =
    alerts.filter(a => a.level === "critical").length;

  const warningCount =
    alerts.filter(a => a.level === "warning").length;

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            OPERION CONTROL CENTER
          </h1>

          <p style={styles.subtitle}>
            Decision Intelligence & Fleet Action System
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● DECISION ENGINE ACTIVE
        </div>

      </div>

      <div style={styles.updated}>
        Last decision cycle: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          EXECUTIVE PANEL
      =============================== */}

      <div style={styles.summary}>

        <div style={styles.card}>
          <h3>Critical Alerts</h3>
          <p style={{ color: "#ef4444", fontSize: "24px" }}>
            {criticalCount}
          </p>
        </div>

        <div style={styles.card}>
          <h3>Warnings</h3>
          <p style={{ color: "#f59e0b", fontSize: "24px" }}>
            {warningCount}
          </p>
        </div>

        <div style={styles.card}>
          <h3>Total Aircraft</h3>
          <p style={{ fontSize: "24px" }}>
            {data.length}
          </p>
        </div>

      </div>

      {/* ===============================
          ALERT STREAM
      =============================== */}

      <div style={styles.alertBox}>

        <h2>Live Alert Stream</h2>

        {alerts.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>
            No active alerts — fleet stable
          </p>
        ) : (
          alerts.map((a) => (

            <div
              key={a.id}
              style={{
                ...styles.alert,
                borderLeft:
                  a.level === "critical"
                    ? "4px solid #ef4444"
                    : "4px solid #f59e0b"
              }}
            >
              <strong>{a.tail}</strong> — {a.message}
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Risk Score: {Math.round(a.score)}
              </div>
            </div>

          ))
        )}

      </div>

      {/* ===============================
          FLEET TABLE
      =============================== */}

      <div style={styles.tableContainer}>

        <h2>Fleet Decision Queue</h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Failure %</th>
              <th>Risk</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            {data
              .sort((a, b) => b.failureProbability - a.failureProbability)
              .map((ac) => {

                let color = "#22c55e";

                if (ac.failureProbability > 75) color = "#ef4444";
                else if (ac.failureProbability > 50) color = "#f59e0b";

                return (
                  <tr key={ac.id}>

                    <td>{ac.tail}</td>

                    <td style={{ color }}>
                      {Math.round(ac.failureProbability)}%
                    </td>

                    <td>
                      {Math.round(ac.risk)}
                    </td>

                    <td>{ac.recommendation}</td>

                  </tr>
                );

              })}

          </tbody>

        </table>

      </div>

    </div>
  );
}

/* ===============================
   STYLES
=============================== */

const styles = {

  page: {
    minHeight: "100vh",
    background: "#081018",
    color: "white",
    padding: "40px",
    fontFamily: "Arial"
  },

  loading: {
    minHeight: "100vh",
    background: "#081018",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white"
  },

  header: {
    display: "flex",
    justifyContent: "space-between"
  },

  title: {
    fontSize: "40px",
    margin: 0
  },

  subtitle: {
    color: "#94a3b8"
  },

  liveBadge: {
    background: "#ef4444",
    color: "#081018",
    padding: "8px 14px",
    borderRadius: "999px",
    fontWeight: "bold"
  },

  updated: {
    marginTop: "10px",
    color: "#94a3b8"
  },

  summary: {
    display: "flex",
    gap: "20px",
    marginTop: "30px"
  },

  card: {
    flex: 1,
    background: "#111827",
    padding: "20px",
    borderRadius: "12px"
  },

  alertBox: {
    marginTop: "30px",
    background: "#111827",
    padding: "20px",
    borderRadius: "12px"
  },

  alert: {
    background: "#0f172a",
    padding: "12px",
    marginTop: "10px",
    borderRadius: "8px"
  },

  tableContainer: {
    marginTop: "30px",
    background: "#111827",
    padding: "20px",
    borderRadius: "12px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse"
  }

};
