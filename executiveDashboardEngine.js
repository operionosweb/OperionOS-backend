import { useEffect, useState } from "react";
import axios from "axios";

export default function OperionExecutiveDashboard() {

  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {

    async function loadDashboard() {

      try {

        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Missing auth token");
        }

        // =========================================
        // IMPORTANT: REPLACE WITH REAL CONTRACT ID
        // =========================================

        const contractId = "YOUR_CONTRACT_ID";

        const url =
          `https://operionos-backend-1.onrender.com/api/contracts/${contractId}/decision`;

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setDecision(response.data.decision);

      } catch (err) {

        console.error(err);

        setError(
          err?.message || "Failed to load dashboard"
        );

      } finally {

        setLoading(false);

      }

    }

    loadDashboard();

  }, []);

  // =========================
  // LOADING STATE
  // =========================

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-2xl">
        Loading Operion Intelligence...
      </div>
    );
  }

  // =========================
  // ERROR STATE
  // =========================

  if (error) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-xl text-center px-6">
        {error}
      </div>
    );
  }

  // =========================
  // MAIN DASHBOARD
  // =========================

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">

      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-4xl font-bold">
              Operion Executive Dashboard
            </h1>

            <p className="text-neutral-400 mt-2">
              AI Aviation Decision Intelligence System
            </p>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-neutral-900 border border-neutral-800">
            LIVE SYSTEM
          </div>

        </div>

        {/* TOP METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm">Health Score</p>
            <h2 className="text-5xl font-bold mt-3">
              {decision?.decision_summary?.overall_health_score ?? 0}
            </h2>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm">Recommended Action</p>
            <h2 className="text-2xl font-bold mt-3">
              {decision?.decision_summary?.recommended_action ?? "-"}
            </h2>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm">Urgency Level</p>
            <h2 className="text-2xl font-bold mt-3">
              {decision?.decision_summary?.urgency_level ?? "-"}
            </h2>
          </div>

        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT SIDE */}
          <div className="xl:col-span-2 space-y-6">

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-4">
                Financial View
              </h2>

              <div className="space-y-3 text-neutral-300">

                <p>
                  Stress Status:{" "}
                  {decision?.financial_view?.stress_status ?? "-"}
                </p>

                <p>
                  Cash Flow Outlook:{" "}
                  {decision?.financial_view?.cash_flow_outlook ?? "-"}
                </p>

                <p>
                  Default Risk:{" "}
                  {decision?.financial_view?.default_risk ?? "-"}
                </p>

              </div>

            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-4">
                Operational View
              </h2>

              <div className="space-y-3 text-neutral-300">

                <p>
                  Transition Readiness:{" "}
                  {decision?.operational_view?.transition_readiness ?? "-"}
                </p>

                <p>
                  Maintenance Pressure:{" "}
                  {decision?.operational_view?.maintenance_pressure ?? "-"}
                </p>

                <p>
                  Fleet Impact:{" "}
                  {decision?.operational_view?.fleet_efficiency_impact ?? "-"}
                </p>

              </div>

            </div>

          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-6">

            <div class
