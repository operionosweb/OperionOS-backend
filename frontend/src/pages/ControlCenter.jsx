import { useEffect, useRef, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  // store animated positions
  const positionsRef = useRef({});

  const fetchData = async () => {

    try {

      const res = await fetch(API);
      const json = await res.json();

      // initialize or update aircraft state
      const enriched = json?.aircraftRankings?.map((a, i) => {

        const id = a.aircraft.id;

        const baseLat = 41.3851;
        const baseLng = 2.1734;

        // initialize stable position once
        if (!positionsRef.current[id]) {
          positionsRef.current[id] = {
            lat: baseLat + (i * 0.3),
            lng: baseLng + (i * 0.4)
          };
        }

        // simulate movement drift (future ADS-B replacement point)
        const driftLat = (Math.random() - 0.5) * 0.01;
        const driftLng = (Math.random() - 0.5) * 0.01;

        positionsRef.current[id].lat += driftLat;
        positionsRef.current[id].lng += driftLng;

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: a.metrics.riskScore,
          hours: a.metrics.totalHours,
          lat: positionsRef.current[id].lat,
          lng: positionsRef.current[id].lng,
          route: {
            from: "BCN",
            to: "MAD"
          }
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

    const interval = setInterval(() => {
      fetchData();
    }, 15000); // faster for "live feel"

    return () => clearInterval(interval);

  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        Initializing Flight Tracking Layer...
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
            Live Flight Tracking Architecture Layer
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● TRACKING ACTIVE
        </div>

      </div>

      {/* LAST UPDATE */}
      <div style={styles.updated}>
        Last sync: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          FLIGHT MAP
      =============================== */}

      <div style={styles.mapContainer}>

        <h2 style={styles.section}>
          Live Aircraft Movement Layer
        </h2>

        <div style={styles.map}>

          <div style={styles.grid} />

          {data.map((ac) => {

            let color = "#22c55e";

            if (ac.risk > 70) color = "#ef4444";
            else if (ac.risk > 40) color = "#f59e0b";

            return (
              <div
                key={ac.id}
                style={{
                  ...styles.marker,
                  top: `${50 + ac.lat * 1.8}%`,
                  left: `${50 + ac.lng * 1.8}%`,
                  background: color
                }}
                title={`${ac.tail} → ${ac.route.to}`}
              >
                ✈
              </div>
            );
          })}

        </div>

      </div>

      {/* ===============================
          FLIGHT TABLE
      =============================== */}

      <div style={styles.tableContainer}>

        <h2 style={styles.section}>
          Flight Intelligence Feed
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Model</th>
              <th>Route</th>
              <th>Risk</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {data.map((ac) => {

              let status = "STABLE";

              if (ac.risk > 70) status = "CRITICAL FLIGHT";
              else if (ac.risk > 40) status = "MONITOR";

              return (
                <tr key={ac.id}>

                  <td>{ac.tail}</td>
                  <td>{ac.model}</td>

                  <td>
                    {ac.route.from} → {ac.route.to}
                  </td>

                  <td>
                    <span style={{
                      ...styles.badge,
                      background:
                        ac.risk > 70
                          ? "#ef4444"
                          : ac.risk > 40
                          ? "#f59e0b"
                          : "#22c55e"
                    }}>
                      {Math.round(ac.risk)}
                    </span>
                  </td>

                  <td>{Math.round(ac.hours)}</td>

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
