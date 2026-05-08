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

        // base positions
        const baseLat = 41.3851;
        const baseLng = 2.1734;

        if (!stateRef.current[id]) {
          stateRef.current[id] = {
            lat: baseLat + i * 0.3,
            lng: baseLng + i * 0.2
          };
        }

        // movement simulation
        stateRef.current[id].lat += (Math.random() - 0.5) * 0.01;
        stateRef.current[id].lng += (Math.random() - 0.5) * 0.01;

        /* ===============================
           WEATHER MODEL (SIMULATED)
        =============================== */

        const windStrength = Math.random() * 100;

        const stormZone =
          windStrength > 70 ? "STORM" :
          windStrength > 40 ? "WINDY" :
          "CLEAR";

        const weatherImpactFactor =
          windStrength > 70 ? 1.25 :
          windStrength > 40 ? 1.10 :
          1.0;

        /* ===============================
           ETA MODEL WITH WEATHER IMPACT
        =============================== */

        const baseETA = 45;
        const eta = Math.round(
          baseETA * weatherImpactFactor +
          a.metrics.riskScore / 10
        );

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: a.metrics.riskScore,
          hours: a.metrics.totalHours,

          position: stateRef.current[id],

          weather: {
            wind: windStrength,
            zone: stormZone,
            impact: weatherImpactFactor
          },

          eta
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
        Initializing Weather Intelligence Layer...
      </div>
    );
  }

  /* ===============================
     WEATHER OVERLAY ZONES
  =============================== */

  const weatherZones = [
    { x: 60, y: 40, type: "STORM" },
    { x: 30, y: 70, type: "WIND" },
    { x: 80, y: 60, type: "CLEAN" }
  ];

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            OPERION CONTROL CENTER
          </h1>

          <p style={styles.subtitle}>
            Weather-Aware Flight Intelligence System
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● WEATHER ACTIVE
        </div>

      </div>

      <div style={styles.updated}>
        Last sync: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          MAP WITH WEATHER LAYERS
      =============================== */}

      <div style={styles.mapContainer}>

        <h2 style={styles.section}>
          Airspace & Weather Intelligence Layer
        </h2>

        <div style={styles.map}>

          <div style={styles.grid} />

          {/* WEATHER ZONES */}
          {weatherZones.map((z, i) => {

            let color = "rgba(34,197,94,0.15)";

            if (z.type === "STORM")
              color = "rgba(239,68,68,0.25)";
            else if (z.type === "WIND")
              color = "rgba(245,158,11,0.20)";

            return (
              <div
                key={i}
                style={{
                  ...styles.weatherZone,
                  top: `${z.y}%`,
                  left: `${z.x}%`,
                  background: color
                }}
              />
            );

          })}

          {/* AIRCRAFT */}
          {data.map((ac) => {

            let color = "#22c55e";

            if (ac.risk > 70) color = "#ef4444";
            else if (ac.risk > 40) color = "#f59e0b";

            return (
              <div
                key={ac.id}
                style={{
                  ...styles.marker,
                  top: `${50 + ac.position.lat * 1.5}%`,
                  left: `${50 + ac.position.lng * 1.5}%`,
                  background: color
                }}
                title={`${ac.tail} | ETA ${ac.eta} min`}
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
          Weather Impact Flight Feed
        </h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Weather</th>
              <th>Risk</th>
              <th>ETA</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {data.map((ac) => {

              let status = "STABLE";

              if (ac.weather.zone === "STORM")
                status = "DIVERSION RISK";
              else if (ac.risk > 70)
                status = "CRITICAL";

              return (
                <tr key={ac.id}>

                  <td>{ac.tail}</td>

                  <td>{ac.weather.zone}</td>

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
    background: "#06b6d4",
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

  weatherZone: {
    position: "absolute",
    width: "160px",
    height: "160px",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    filter: "blur(6px)"
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
