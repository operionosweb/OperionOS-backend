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
        Loading Operion Geo Intelligence...
      </div>
    );
  }

  /* ===============================
     GEO MODEL (READY FOR REAL ADS-B LATER)
  =============================== */

  const aircraftGeo = data?.aircraftRankings?.map((a, i) => {

    // Base coordinate (Barcelona region default hub)
    const baseLat = 41.3851;
    const baseLng = 2.1734;

    // Deterministic pseudo spread (stable layout)
    const offsetLat = ((i + 1) * 0.37) % 2 - 1;
    const offsetLng = ((i + 1) * 0.51) % 2 - 1;

    return {
      id: i,
      name: a.aircraft.tail_number,
      model: a.aircraft.model,
      lat: baseLat + offsetLat,
      lng: baseLng + offsetLng,
      risk: a.metrics.riskScore,
      hours: a.metrics.totalHours
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
            Geo-Aware Fleet Intelligence System
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● LIVE GEO
        </div>

      </div>

      {/* UPDATE */}
      <div style={styles.updated}>
        Last update: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          GEO MAP
      =============================== */}

      <div style={styles.mapContainer}>

        <h2 style={styles.section}>
          Aircraft Geo Map (Operational Layer)
        </h2>

        <div style={styles.map}>

          {/* GRID BACKGROUND */}
          <div style={styles.grid} />

          {aircraftGeo.map((ac) => {

            let color = "#22c55e";

            if (ac.risk > 70) color = "#ef4444";
            else if (ac.risk > 40) color = "#f59e0b";

            return (
              <div
                key={ac.id}
                style={{
                  ...styles.marker,
                  top: `${50 + ac.lat * 2}%`,
                  left: `${50 + ac.lng * 2}%`,
                  background: color
                }}
                title={`${ac.name} | Risk ${Math.round(ac.risk)}`}
              >
                ✈
              </div>
            );
          })}

        </div>

      </div>

      {/* ===============================
          TABLE
      =============================== */}

      <div style={styles.tableContainer}>

        <h2 style={styles.section}>
          Fleet Intelligence
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Model</th>
              <th>Risk</th>
              <th>Hours</th>
              <th>Geo Status</th>
            </tr>
          </thead>

          <tbody>

            {aircraftGeo.map((a) => {

              let status = "STABLE";

              if (a.risk > 70) status = "CRITICAL ZONE";
              else if (a.risk > 40) status = "ELEVATED";

              return (
                <tr key={a.id}>

                  <td>{a.name}</td>
                  <td>{a.model}</td>

                  <td>
                    <span style={{
                      ...styles.badge,
                      background:
                        a.risk > 70
                          ? "#ef4444"
                          : a.risk > 40
                          ? "#f59e0b"
                          : "#22c55e"
                    }}>
                      {Math.round(a.risk)}
                    </span>
                  </td>

                  <td>{Math.round(a.hours)}</td>

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
    background: "#3b82f6",
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
    height: "420px",
    marginTop: "15px",
    background: "#0f172a",
    borderRadius: "16px",
    position: "relative",
    overflow: "hidden",
    border: "1px solid #1f2937"
  },

  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
    backgroundSize: "40px 40px"
  },

  marker: {
    position: "absolute",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "translate(-50%, -50%)",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#000"
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
