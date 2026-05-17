import { useEffect, useState } from "react";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDecision() {
      try {
        const contractId = "a339bfce-1c19-4fd9-bf05-130ebf1b1a7e";

        // 🚨 PURE DEBUG CALL (NO AUTH)
        const response = await fetch(
          `https://operionos-backend-1.onrender.com/api/contracts/${contractId}/decision`
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Backend error ${response.status}: ${errorText}`
          );
        }

        const data = await response.json();
        setDecision(data.decision);

      } catch (err) {
        console.error("Operion intelligence error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDecision();
  }, []);

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-3xl font-bold">
        Loading Operion Intelligence...
      </div>
    );
  }

  // =========================
  // ERROR
  // =========================
  if (error) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-center p-10 text-xl">
        {error}
      </div>
    );
  }

  // =========================
  // EMPTY STATE
  // =========================
  if (!decision) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        No decision data available
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        <div>
          <h1 className="text-4xl font-bold">
            Operion Dashboard
          </h1>
          <p className="text-neutral-400 mt-2">
            Debug Mode (Backend Test)
          </p>
        </div>

        <div className="bg-neutral-900 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-4">
            Decision Summary
          </h2>

          <pre className="text-green-300 text-sm overflow-auto">
            {JSON.stringify(decision, null, 2)}
          </pre>
        </div>

      </div>
    </div>
  );
}
