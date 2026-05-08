import { useEffect, useRef, useState } from "react";

export default function ControlCenter() {

  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState([]);
  const [summary, setSummary] = useState("");
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
            lng: baseLng + i * 0.2
          };
        }

        stateRef.current[id].lat += (Math.random() - 0.5) * 0.01;
        stateRef.current[id].lng += (Math.random() - 0.5) * 0.01;

        const failure =
          a.metrics.riskScore * 0.6 +
          a.metrics.totalHours * 0.02 +
          Math.random() * 5;

        return {
          id,
          tail: a.aircraft.tail_number,
          model: a.aircraft.model,
          risk: a.metrics.riskScore,
          hours: a.metrics.totalHours,
          failure,
          position: stateRef.current[id]
        };

      }) || [];

      setData(enriched);
      setView(enriched);
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

  /* ===============================
     COMMAND ENGINE
  =============================== */

  const runCommand = (input) => {

    const cmd = input.toLowerCase();

    let result = data;

    if (cmd.includes("high risk")) {
      result = data.filter(d => d.failure > 60);
      setSummary("Showing high-risk aircraft requiring attention.");
    }

    else if (cmd.includes("critical")) {
      result = data.filter(d => d.failure > 75);
      setSummary("Critical aircraft only — immediate action required.");
    }

    else if (cmd.includes("low risk")) {
      result = data.filter(d => d.failure < 40);
      setSummary("Low-risk operational fleet.");
    }

    else if (cmd.includes("all")) {
      result = data;
      setSummary("Full fleet view restored.");
    }

    else if (cmd.includes("summary")) {

      const avg =
        data.reduce((acc, d) => acc + d.failure, 0) / data.length;

      setSummary(
        `Fleet average failure probability is ${Math.round(avg)}%.`
      );

      result = data;
    }

    setView(result);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        Initializing AI Command Center...
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            OPERION COMMAND CENTER
          </h1>

          <p style={styles.subtitle}>
            AI Operational Control Interface
          </p>
        </div>

        <div style={styles.liveBadge}>
          ● COMMAND ACTIVE
        </div>

      </div>

      <div style={styles.updated}>
        Last update: {lastUpdated?.toLocaleTimeString()}
      </div>

      {/* ===============================
          COMMAND INPUT
      =============================== */}

      <div style={styles.commandBox}>

        <input
          style={styles.input}
          placeholder="Type command: high risk / critical / summary / all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          style={styles.button}
          onClick={() => runCommand(query)}
        >
          Run Command
        </button>

      </div>

      {summary && (
        <div style={styles.summary}>
          {summary}
        </div>
      )}

      {/* ===============================
          FLEET VIEW
      =============================== */}

      <div style={styles.tableContainer}>

        <h2>Command Output - Fleet View</h2>

        <table style={styles.table}>

          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Risk</th>
              <th>Failure</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>

            {view
              .sort((a, b) => b.failure - a.failure)
              .map((ac) => {

                let status = "OK";

                if (ac.failure > 75) status = "CRITICAL";
                else if (ac.failure > 50) status = "WARNING";

                return (
                  <tr key={ac.id}>

                    <td>{ac.tail}</td>

                    <td>{Math.round(ac.risk)}</td>

                    <td>
                      {Math.round(ac.failure)}%
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

  commandBox: {
    display: "flex",
    gap: "10px",
    marginTop: "30px"
  },

  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "8px",
    border: "none"
  },

  button: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "white",
    cursor: "pointer"
  },

  summary: {
    marginTop: "15px",
    color: "#94a3b8"
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
