import { useEffect, useState } from "react";

export default function App() {

  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {

    async function loadDecision() {

      try {

        const contractId =
          "a339bfce-1c19-4fd9-bf05-130ebf1b1a7e";

        const response = await fetch(
          `https://operionos-backend-1.onrender.com/api/contracts/${contractId}/decision`
        );

        if (!response.ok) {
          throw new Error("Failed to load Operion intelligence");
        }

        const data = await response.json();

        setDecision(data.decision);

      } catch (err) {

        console.error(err);

        setError(err.message);

      } finally {

        setLoading(false);

      }

    }

    loadDecision();

  }, []);

  // ====================================
  // LOADING
  // ====================================

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-3xl font-bold">
        Loading Operion Intelligence...
      </div>
    );
  }

  // ====================================
  // ERROR
  // ====================================

  if (error) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-center p-10 text-xl">
        {error}
      </div>
    );
  }

  // ====================================
  // FALLBACK
  // ====================================

  if (!decision) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        No decision data available
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">

      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-5xl font-bold tracking-tight">
              Operion Executive Dashboard
            </h1>

            <p className="text-neutral-400 mt-3 text-lg">
              Aviation Decision Intelligence Platform
            </p>
          </div>

          <div className="px-5 py-3 rounded-2xl bg-green-500/20 border border-green-500/40 text-green-300 font-semibold">
            LIVE AI CONNECTED
          </div>

        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm uppercase">
              Health Score
            </p>

            <h2 className="text-6xl font-bold mt-4">
              {decision?.decision_summary?.overall_health_score || 0}
            </h2>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm uppercase">
              Recommended Action
            </p>

            <h2 className="text-3xl font-bold mt-4">
              {decision?.decision_summary?.recommended_action || "-"}
            </h2>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
            <p className="text-neutral-400 text-sm uppercase">
              Urgency Level
            </p>

            <h2 className="text-3xl font-bold mt-4">
              {decision?.decision_summary?.urgency_level || "-"}
            </h2>
          </div>

        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT */}
          <div className="xl:col-span-2 space-y-6">

            {/* FINANCIAL */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-6">
                Financial Analysis
              </h2>

              <div className="space-y-4 text-neutral-300">

                <div>
                  <span className="text-neutral-500">
                    Stress Status:
                  </span>{" "}
                  {decision?.financial_view?.stress_status || "-"}
                </div>

                <div>
                  <span className="text-neutral-500">
                    Cash Flow Outlook:
                  </span>{" "}
                  {decision?.financial_view?.cash_flow_outlook || "-"}
                </div>

                <div>
                  <span className="text-neutral-500">
                    Default Risk:
                  </span>{" "}
                  {decision?.financial_view?.default_risk || "-"}
                </div>

              </div>

            </div>

            {/* OPERATIONAL */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-6">
                Operational Analysis
              </h2>

              <div className="space-y-4 text-neutral-300">

                <div>
                  <span className="text-neutral-500">
                    Transition Readiness:
                  </span>{" "}
                  {decision?.operational_view?.transition_readiness || "-"}
                </div>

                <div>
                  <span className="text-neutral-500">
                    Maintenance Pressure:
                  </span>{" "}
                  {decision?.operational_view?.maintenance_pressure || "-"}
                </div>

                <div>
                  <span className="text-neutral-500">
                    Fleet Efficiency Impact:
                  </span>{" "}
                  {decision?.operational_view?.fleet_efficiency_impact || "-"}
                </div>

              </div>

            </div>

          </div>

          {/* RIGHT */}
          <div className="space-y-6">

            {/* RISK DRIVERS */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-5">
                Key Risk Drivers
              </h2>

              <div className="space-y-3">

                {decision?.key_risk_drivers?.map((risk, idx) => (
                  <div
                    key={idx}
                    className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-neutral-300"
                  >
                    {risk}
                  </div>
                ))}

              </div>

            </div>

            {/* CFO COPILOT */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">

              <h2 className="text-2xl font-bold mb-5">
                CFO Copilot
              </h2>

              <p className="text-neutral-300 leading-relaxed">
                {decision?.what_would_i_do_as_cfo || "-"}
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
