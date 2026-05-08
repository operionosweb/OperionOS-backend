import { useEffect, useRef, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const API =
    "https://operionos-backend-1.onrender.com/api/control-center";

  const positionStore = useRef({});

  const fetchData = async () => {

    try {

      const res = await fetch(API);
      const json = await res.json();

      const enriched = json?.aircraftRankings?.map((a, i) => {

        const id = a.aircraft.id;

        // base hub
        const baseLat = 41.3851;
        const baseLng = 2.1734;

        if (!positionStore.current[id]) {
          positionStore.current[id] = {
            lat: baseLat + i * 0.4,
            lng: baseLng + i * 0.3
          };
        }

        // movement simulation
        positionStore.current[id].lat += (Math.random() - 0.5) * 0.01;
        positionStore.current[id].lng += (Math.random() - 0.5) * 0.01;

        const from = { lat: 41.3851, lng: 2.1734 }; // BCN
        const to = { lat: 40.4168, lng: -3.7038 };  // MAD

        // fake ETA model (future hook)
        const etaMinutes = 45 + Math.round(a.metrics.riskScore / 10);

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: a.metrics.riskScore,
          hours: a.metrics.totalHours,

          position: positionStore.current[id],

          route: {
            from,
            to
          },

          eta: etaMinutes
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
        Initializing Flight Route System...
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
            Live Flight Route Intelligence System
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● ROUTES ACTIVE
        </div>

      </div>

      <div style={styles.updated}>
        Last sync: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          MAP WITH ROUTES
      =============================== */}

      <div style={styles.mapContainer}>

        <h2 style={styles.section}>
          Flight Routes (Origin → Destination)
        </h2>

        <div style={styles.map}>

          <div style={styles.grid} />

          {/* ROUTE LINES */}
          {data.map((ac) => {

            const x1 = 50 + ac.route.from.lng;
            const y1 = 50 + ac.route.from.lat;
            const x2 = 50 + ac.route.to.lng;
            const y2 = 50 + ac.route.to.lat;

            return (
              <svg
                key={ac.id}
                style={styles.svg}
              >

                <line
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="2"
                />

              </svg>
            );

          })}

          {/* AIRCRAFT MARKERS */}
          {data.map((ac) => {

            let color = "#22c55e";

            if (ac.risk > 70) color = "#ef4444";
            else if (ac.risk > 40) color = "#f59e0b";

            const pos = ac.position;

            return (
              <div
                key={ac.id}
                style={{
                  ...styles.marker,
                  top: `${50 + pos.lat * 1.5}%`,
                  left: `${50 + pos.lng * 1.5}%`,
                  background: color
                }}
                title={`${ac.tail} ETA ${ac.eta} min`}
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
          Flight Intelligence Feed
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Route</th>
              <th>Risk</th>
              <th>ETA</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {data.map((ac) => {

              let status = "STABLE";

              if (ac.risk > 70) status = "CRITICAL";
              else if (ac.risk > 40) status = "MONITOR";

              return (
                <tr key={ac.id}>

                  <td>{ac.tail}</td>

                  <td>BCN → MAD</td>

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

                  <td>{ac.eta} min</td>

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

  svg: {
    position: "absolute",
    width: "100%",
    height: "100%"
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
