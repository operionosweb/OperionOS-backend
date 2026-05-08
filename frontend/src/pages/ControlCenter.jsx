import { useEffect, useRef, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  const stateRef = useRef({});

  const fetchData = async () => {

    try {

      const res = await fetch(API);
      const json = await res.json();

      const enriched = json?.aircraftRankings?.map((a, i) => {

        const id = a.aircraft.id;

        const baseLat = 41.3851;
        const baseLng = 2.1734;

        if (!stateRef.current[id]) {
          stateRef.current[id] = {
            lat: baseLat + i * 0.3,
            lng: baseLng + i * 0.25
          };
        }

        // small movement simulation
        stateRef.current[id].lat += (Math.random() - 0.5) * 0.01;
        stateRef.current[id].lng += (Math.random() - 0.5) * 0.01;

        /* ===============================
           CORE RISK MODEL (SIMULATED AI)
        =============================== */

        const flightHours = a.metrics.totalHours;
        const baseRisk = a.metrics.riskScore;

        // degradation logic (key concept: aging + usage)
        const wearFactor = flightHours * 0.02;

        // anomaly detection simulation
        const randomNoise = Math.random() * 10;

        const failureProbability =
          Math.min(
            100,
            baseRisk * 0.6 +
            wearFactor +
            randomNoise
          );

        /* ===============================
           MAINTENANCE DECISION ENGINE
        =============================== */

        let recommendation = "Continue Operations";

        if (failureProbability > 75) {
          recommendation = "IMMEDIATE INSPECTION REQUIRED";
        } else if (failureProbability > 50) {
          recommendation = "Schedule Maintenance (7 days)";
        } else if (failureProbability > 30) {
          recommendation = "Monitor Closely";
        }

        /* ===============================
           COST PRESSURE MODEL
        =============================== */

        const costPressure =
          flightHours * 12 +
          failureProbability * 8;

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: baseRisk,
          hours: flightHours,

          position: stateRef.current[id],

          failureProbability,
          costPressure,
          recommendation
        };

      }) || [];

      setData(enriched);
      setLastUpdated(new Date());
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchData();

    const interval = setInterval(fetchData, 15000);

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        Initializing Predictive Maintenance Engine...
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
            Predictive Maintenance Intelligence Layer
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● AI ACTIVE
        </div>

      </div>

      <div style={styles.updated}>
        Last analysis: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          INTELLIGENCE TABLE
      =============================== */}

      <div style={styles.tableContainer}>

        <h2 style={styles.section}>
          Fleet Health Prediction Engine
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Risk Score</th>
              <th>Failure %</th>
              <th>Cost Pressure</th>
              <th>Recommendation</th>
            </tr>
          </thead>

          <tbody>

            {data.map((ac) => {

              let color = "#22c55e";

              if (ac.failureProbability > 75)
                color = "#ef4444";
              else if (ac.failureProbability > 50)
                color = "#f59e0b";

              return (
                <tr key={ac.id}>

                  <td>{ac.tail}</td>

                  <td>
                    <span style={styles.badge}>
                      {Math.round(ac.risk)}
                    </span>
                  </td>

                  <td style={{ color }}>
                    {Math.round(ac.failureProbability)}%
                  </td>

                  <td>
                    €{Math.round(ac.costPressure).toLocaleString()}
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
    background: "#a855f7",
    color: "#081018",
    padding: "8px 14px",
    borderRadius: "999px",
    fontWeight: "bold"
  },

  updated: {
    marginTop: "10px",
    color: "#94a3b8"
  },

  tableContainer: {
    marginTop: "30px",
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
    background: "#1f2937",
    color: "white",
    fontWeight: "bold"
  }

};
