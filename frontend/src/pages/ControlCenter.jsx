import { useEffect, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  const fetchData = async () => {
    try {
      const res = await fetch(API);
      const json = await res.json();

      setData(json);
      setLastUpdated(new Date());
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {

    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 20000);

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        Loading Operion Live Operations Map...
      </div>
    );
  }

  /* ===============================
     MOCK MAP DATA (READY FOR GPS LATER)
  =============================== */

  const mockMapData = data?.aircraftRankings?.map((a, i) => {

    const baseLat = 41.3;   // Barcelona-ish
    const baseLng = 2.1;

    return {
      id: i,
      name: a.aircraft.tail_number,
      lat: baseLat + (Math.random() - 0.5) * 2,
      lng: baseLng + (Math.random() - 0.5) * 2,
      risk: a.metrics.riskScore
    };

  }) || [];

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            OPERION CONTROL CENTER
          </h1>

          <p style={styles.subtitle}>
            Live Operations & Fleet Intelligence
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● LIVE
        </div>

      </div>

      {/* LAST UPDATE */}
      <div style={styles.updated}>
        Last update: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          MAP SECTION
      =============================== */}

      <div style={styles.mapContainer}>

        <h2 style={styles.section}>
          Live Fleet Map (Operational View)
        </h2>

        <div style={styles.map}>

          {mockMapData.map((aircraft) => {

            let color = "#22c55e";

            if (aircraft.risk > 70) {
              color = "#ef4444";
            } else if (aircraft.risk > 40) {
              color = "#f59e0b";
            }

            return (
              <div
                key={aircraft.id}
                style={{
                  ...styles.marker,
                  top: `${50 + aircraft.lat * 2}%`,
                  left: `${50 + aircraft.lng * 2}%`,
                  background: color
                }}
                title={`${aircraft.name} (${Math.round(aircraft.risk)})`}
              >
                ✈
              </div>
            );
          })}

        </div>

      </div>

      {/* ===============================
          FLEET TABLE (KEEP EXISTING DATA LOGIC)
      =============================== */}

      <div style={styles.tableContainer}>

        <h2 style={styles.section}>
          Fleet Risk Overview
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

            {data?.aircraftRankings?.map((a, i) => {

              const risk = a.metrics.riskScore;

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
                    {Math.round(a.metrics.totalHours)}
                  </td>

                  <td>
                    €
                    {Math.round(
                      a.metrics.projected30DayCost
                    ).toLocaleString()}
                  </td>

                  <td>{status}</td>

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
    color: "#94a3b8"
  },

  mapContainer: {
    marginTop: "30px"
  },

  map: {
    marginTop: "15px",
    height: "400px",
    background: "#0f172a",
    borderRadius: "16px",
    position: "relative",
    overflow: "hidden",
    border: "1px solid #1f2937"
  },

  marker: {
    position: "absolute",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "black",
    fontWeight: "bold",
    transform: "translate(-50%, -50%)",
    cursor: "pointer"
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
