import { useEffect, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  const fetchData = async () => {
    try {
      const res = await fetch(API);
      const json = await res.json();

      setData(json);
      setLastUpdated(new Date());
      setError(null);
      setLoading(false);

    } catch (err) {
      setError("Failed to fetch live data");
      setLoading(false);
    }
  };

  useEffect(() => {

    // Initial load
    fetchData();

    // LIVE MODE: refresh every 20 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 20000);

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading Operion Live Control Center...
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loading}>
        {error}
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            OPERION CONTROL CENTER
          </h1>

          <p style={styles.subtitle}>
            Live Aviation Operations Intelligence
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● LIVE
        </div>

      </div>

      {/* LAST UPDATED */}
      <div style={styles.updated}>
        Last updated:{" "}
        {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ALERT STRIP */}
      {data?.aircraftRankings?.some(
        a => a.metrics.riskScore > 70
      ) && (
        <div style={styles.alert}>
          ⚠ HIGH RISK AIRCRAFT DETECTED
        </div>
      )}

      {/* METRICS */}
      <div style={styles.metricsGrid}>

        <div style={styles.card}>
          <div style={styles.label}>
            Fleet Health
          </div>

          <div style={styles.value}>
            {Math.round(
              data?.fleetHealthScore || 0
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>
            30 Day Cost
          </div>

          <div style={styles.value}>
            €
            {Math.round(
              data?.projectedFleet30DayCost || 0
            ).toLocaleString()}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.label}>
            Aircraft
          </div>

          <div style={styles.value}>
            {data?.aircraftRankings?.length || 0}
          </div>
        </div>

      </div>

      {/* TABLE */}
      <div style={styles.tableContainer}>

        <h2 style={styles.section}>
          Fleet Risk Ranking (Live)
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Tail</th>
              <th>Model</th>
              <th>Risk</th>
              <th>Hours</th>
              <th>Forecast</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {data?.aircraftRankings?.map(
              (a, i) => {

                const risk =
                  a.metrics.riskScore;

                let color = "#22c55e";
                let status = "OK";

                if (risk > 70) {
                  color = "#ef4444";
                  status = "CRITICAL";
                } else if (risk > 40) {
                  color = "#f59e0b";
                  status = "WATCH";
                }

                return (
                  <tr key={i}>

                    <td>{a.aircraft.tail_number}</td>

                    <td>{a.aircraft.model}</td>

                    <td>
                      <span
                        style={{
                          ...styles.badge,
                          background: color
                        }}
                      >
                        {Math.round(risk)}
                      </span>
                    </td>

                    <td>
                      {Math.round(
                        a.metrics.totalHours
                      )}
                    </td>

                    <td>
                      €
                      {Math.round(
                        a.metrics
                          .projected30DayCost
                      ).toLocaleString()}
                    </td>

                    <td>{status}</td>

                  </tr>
                );
              }
            )}

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
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  title: {
    fontSize: "40px",
    margin: 0
  },

  subtitle: {
    color: "#94a3b8"
  },

  liveBadge: {
    background: "#22c55e",
    color: "#081018",
    padding: "8px 14px",
    borderRadius: "999px",
    fontWeight: "bold"
  },

  updated: {
    marginTop: "10px",
    color: "#94a3b8",
    fontSize: "14px"
  },

  alert: {
    marginTop: "20px",
    padding: "12px",
    background: "#ef4444",
    borderRadius: "10px",
    fontWeight: "bold"
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
    marginTop: "30px"
  },

  card: {
    background: "#111827",
    padding: "20px",
    borderRadius: "16px"
  },

  label: {
    color: "#94a3b8"
  },

  value: {
    fontSize: "32px",
    marginTop: "10px",
    fontWeight: "bold"
  },

  tableContainer: {
    marginTop: "40px",
    background: "#111827",
    padding: "20px",
    borderRadius: "16px"
  },

  section: {
    marginBottom: "20px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse"
  },

  badge: {
    padding: "6px 12px",
    borderRadius: "999px",
    color: "white",
    fontWeight: "bold"
  }

};
