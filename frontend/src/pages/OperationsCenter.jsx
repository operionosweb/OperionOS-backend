import React, { useEffect, useState } from "react";

import {
  Calendar,
  momentLocalizer
} from "react-big-calendar";

import moment from "moment";

import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer =
  momentLocalizer(moment);

const API =
  "https://operionos-backend-1.onrender.com";

export default function OperationsCenter() {

  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {

    try {

      const token =
        localStorage.getItem("sb-token");

      /* ===============================
         LOAD MAINTENANCE SCHEDULE
      =============================== */

      const scheduleRes =
        await fetch(
          `${API}/api/maintenance/schedule`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      const scheduleJson =
        await scheduleRes.json();

      const mappedEvents =
        (scheduleJson.schedule || []).map((s) => ({

          title:
            `${s.maintenance_type} • €${s.estimated_cost}`,

          start:
            new Date(s.predicted_due_date),

          end:
            new Date(s.predicted_due_date)

        }));

      setEvents(mappedEvents);

      /* ===============================
         MOCK ALERTS
      =============================== */

      setAlerts([
        {
          severity: "HIGH",
          message:
            "Aircraft OH-LWA approaching heavy maintenance threshold."
        },
        {
          severity: "MEDIUM",
          message:
            "Weather risk elevated for Northern Europe routes."
        },
        {
          severity: "LOW",
          message:
            "2 preventive inspections scheduled this week."
        }
      ]);

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);

    }

  }

  useEffect(() => {

    loadData();

  }, []);

  if (loading) {

    return (

      <div
        style={{
          background: "#0b1020",
          minHeight: "100vh",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24
        }}
      >

        Loading Operations Center...

      </div>

    );

  }

  return (

    <div
      style={{
        background: "#0b1020",
        minHeight: "100vh",
        color: "white",
        padding: 24
      }}
    >

      {/* ===============================
         HEADER
      =============================== */}

      <div
        style={{
          marginBottom: 30
        }}
      >

        <h1
          style={{
            fontSize: 36,
            marginBottom: 10
          }}
        >
          ✈ Operion Operations Control Center
        </h1>

        <div
          style={{
            opacity: 0.7
          }}
        >
          Real-time fleet operations intelligence
        </div>

      </div>

      {/* ===============================
         ALERT CENTER
      =============================== */}

      <div
        style={{
          marginBottom: 30
        }}
      >

        <h2
          style={{
            marginBottom: 15
          }}
        >
          🚨 Operational Alerts
        </h2>

        {alerts.map((a, idx) => (

          <div
            key={idx}
            style={{

              background:
                a.severity === "HIGH"
                  ? "#7f1d1d"
                  : a.severity === "MEDIUM"
                  ? "#78350f"
                  : "#1e3a8a",

              padding: 16,
              borderRadius: 12,
              marginBottom: 12

            }}
          >

            <div
              style={{
                fontWeight: "bold",
                marginBottom: 6
              }}
            >
              {a.severity}
            </div>

            <div>
              {a.message}
            </div>

          </div>

        ))}

      </div>

      {/* ===============================
         CALENDAR
      =============================== */}

      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 20,
          height: 700,
          color: "black"
        }}
      >

        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
        />

      </div>

    </div>

  );
}
