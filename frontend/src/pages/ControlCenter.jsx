import { useEffect, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  useEffect(() => {

    fetch(API)
      .then((res) => res.json())
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Control Center error:", err);
        setLoading(false);
      });

  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>
          Loading Operion Control Center...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.errorText}>
          Failed to load Control Center
        </div>
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
            Aviation Operational Intelligence Platform
          </p>
        </div>

        <div style={styles.statusBox}>
          LIVE SYSTEM
        </div>

      </div>

      {/* TOP METRICS */}
      <div style={styles.metricsGrid}>

        {/* Fleet Health */}
        <div style={styles.metricCard}>

          <div style={styles.metricLabel}>
            Fleet Health Score
          </div>

          <div style={styles.metricValue}>
            {Math.round(
              data.fleetHealthScore || 0
            )}
          </div>

        </div>

        {/* Fleet Cost */}
        <div style={styles.metricCard}>

          <div style={styles.metricLabel}>
            Projected 30 Day Cost
          </div>

          <div style={styles.metricValue}>
            €
            {Math.round(
              data.projectedFleet30DayCost || 0
            ).toLocaleString()}
          </div>

        </div>

        {/* Aircraft Count */}
        <div style={styles.metricCard}>

          <div style={styles.metricLabel}>
            Total Aircraft
          </div>

          <div style={styles.metricValue}>
            {data.aircraftRankings?.length || 0}
          </div>

        </div>

      </div>

      {/* AIRCRAFT TABLE */}
      <div style={styles.tableContainer}>

        <div style={styles.sectionHeader}>
          Aircraft Risk Rankings
        </div>

        <table style={styles.table}>

          <thead>

            <tr style={styles.tableHeaderRow}>

              <th style={styles.th}>Tail Number</th>

              <th style={styles.th}>Aircraft</th>

              <th style={styles.th}>Risk Score</th>

              <th style={styles.th}>Flight Hours</th>

              <th style={styles.th}>30 Day Forecast</th>

              <th style={styles.th}>Recommendation</th>

            </tr>

          </thead>

          <tbody>

            {data.aircraftRankings?.map(
              (item, index) => {

                const risk =
                  item.metrics?.riskScore || 0;

                let riskColor = "#22c55e";

                if (risk > 70) {
                  riskColor = "#ef4444";
                } else if (risk > 40) {
                  riskColor = "#f59e0b";
                }

                return (
                  <tr
                    key={index}
                    style={styles.tableRow}
                  >

                    <td style={styles.td}>
                      {item.aircraft?.tail_number}
                    </td>

                    <td style={styles.td}>
                      {item.aircraft?.model}
                    </td>

                    <td style={styles.td}>

                      <span
                        style={{
                          ...styles.riskBadge,
                          background: riskColor
                        }}
                      >
                        {Math.round(risk)}
                      </span>

                    </td>

                    <td style={styles.td}>
                      {Math.round(
                        item.metrics?.totalHours || 0
                      )}
                    </td>

                    <td style={styles.td}>
                      €
                      {Math.round(
                        item.metrics
                          ?.projected30DayCost || 0
                      ).toLocaleString()}
                    </td>

                    <td style={styles.td}>
                      {item.recommendation}
                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </table>

      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        Operion OS • Aviation Intelligence Platform
      </div>

    </div>
  );
}

/* =========================================
   STYLES
========================================= */

const styles = {

  page: {
    minHeight: "100vh",
    background: "#081018",
    color: "#ffffff",
    padding: "40px",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif"
  },

  loadingContainer: {
    minHeight: "100vh",
    background: "#081018",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },

  loadingText: {
    color: "#ffffff",
    fontSize: "24px"
  },

  errorText: {
    color: "#ef4444",
    fontSize: "24px"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "40px",
    flexWrap: "wrap",
    gap: "20px"
  },

  title: {
    fontSize: "42px",
    fontWeight: "700",
    margin: 0
  },

  subtitle: {
    color: "#94a3b8",
    marginTop: "10px",
    fontSize: "16px"
  },

  statusBox: {
    background: "#22c55e",
    color: "#081018",
    padding: "10px 18px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "14px"
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    marginBottom: "40px"
  },

  metricCard: {
    background: "#111827",
    borderRadius: "18px",
    padding: "28px",
    border: "1px solid #1f2937"
  },

  metricLabel: {
    color: "#94a3b8",
    marginBottom: "14px",
    fontSize: "15px"
  },

  metricValue: {
    fontSize: "38px",
    fontWeight: "700"
  },

  tableContainer: {
    background: "#111827",
    borderRadius: "20px",
    padding: "24px",
    overflowX: "auto",
    border: "1px solid #1f2937"
  },

  sectionHeader: {
    fontSize: "22px",
    fontWeight: "700",
    marginBottom: "24px"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse"
  },

  tableHeaderRow: {
    background: "#1f2937"
  },

  th: {
    textAlign: "left",
    padding: "16px",
    fontSize: "14px",
    color: "#cbd5e1"
  },

  td: {
    padding: "16px",
    borderBottom: "1px solid #1f2937",
    fontSize: "14px"
  },

  tableRow: {
    transition: "0.2s"
  },

  riskBadge: {
    padding: "6px 14px",
    borderRadius: "999px",
    color: "#ffffff",
    fontWeight: "700",
    display: "inline-block",
    minWidth: "50px",
    textAlign: "center"
  },

  footer: {
    marginTop: "40px",
    color: "#64748b",
    textAlign: "center",
    fontSize: "14px"
  }

};
