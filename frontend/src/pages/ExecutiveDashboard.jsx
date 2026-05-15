import { useEffect, useState } from "react";
import axios from "axios";

export default function OperionExecutiveDashboard() {

  const [loading, setLoading] = useState(true);

  const [decision, setDecision] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {

    async function loadDashboard() {

      try {

        // ====================================
        // AUTH TOKEN
        // ====================================

        const token =
          localStorage.getItem("token");

        // ====================================
        // IMPORTANT:
        // REPLACE THIS WITH REAL CONTRACT ID
        // ====================================

        const contractId =
          "YOUR_CONTRACT_ID";

        // ====================================
        // BACKEND API CALL
        // ====================================

        const response =
          await axios.get(
            `https://operionos-backend-1.onrender.com/api/contracts/${contractId}/decision`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

        setDecision(
          response.data.decision
        );

      } catch (err) {

        console.error(err);

        setError(
          "Failed to load Operion dashboard"
        );

      } finally {

        setLoading(false);

      }

    }

    loadDashboard();

  }, []);

  // ====================================
  // LOADING STATE
  // ====================================

  if (loading) {

    return (

      <div className="min-h-screen bg-black text-white flex items-center justify-center text-3xl font-semibold">

        Loading Operion Decision OS...

      </div>

    );

  }

  // ====================================
  // ERROR STATE
  // ====================================

  if (error) {

    return (

      <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-2xl">

        {error}

      </div>

    );

  }

  // ====================================
  // MAIN UI
  // ====================================

  return (

    <div className="min-h-screen bg-neutral-950 text-white p-6">

      <div className="max-w-7xl mx-auto space-y-8">

        {/* ====================================
            HEADER
        ==================================== */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>

            <h1 className="text-4xl font-bold tracking-tight">
              Operion Executive Dashboard
            </h1>

            <p className="text-neutral-400 mt-2 text-lg">
              Unified Aviation Decision Intelligence System
            </p>

          </div>

          <div className="flex gap-3">

            <button className="px-5 py-3 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition">

              Generate CFO Report

            </button>

            <button className="px-5 py-3 rounded-2xl border border-neutral-700 hover:bg-neutral-900 transition">

              Stress Test Scenario

            </button>

          </div>

        </div>

        {/* ====================================
            TOP METRICS
        ==================================== */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* HEALTH SCORE */}

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">

            <p className="text-neutral-400 text-sm uppercase tracking-wide">
              Overall Health Score
            </p>

            <h2 className="text-5xl font-bold mt-4">

              {
                decision?.decision_summary
                  ?.overall_health_score || 0
              }

            </h2>

          </div>

          {/* ACTION */}

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">

            <p className="text-neutral-400 text-sm uppercase tracking-wide">
              Recommended Action
            </p>

            <h2 className="text-3xl font-bold mt-4">

              {
                decision?.decision_summary
                  ?.recommended_action
              }

            </h2>

          </div>

          {/* URGENCY */}

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">

            <p className="text-neutral-400 text-sm uppercase tracking-wide">
              Urgency Level
            </p>

            <h2 className="text-3xl font-bold mt-4">

              {
                decision?.decision_summary
                  ?.urgency_level
              }

            </h2>

          </div>

        </div>
