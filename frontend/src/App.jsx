import { useEffect, useState } from "react";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDecision() {
      try {
        const contractId = "a339bfce-1c19-4fd9-bf05-130ebf1b1a7e";

        const token = localStorage.getItem("token");

        const response = await fetch(
          `https://operionos-backend-1.onrender.com/api/contracts/${contractId}/decision`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` })
            }
          }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-3xl font-bold">
        Loading Operion Intelligence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-center p-10 text-xl">
        {error}
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        No decision data available
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6">
      <h1 className="text-4xl font-bold">
        Operion Executive Dashboard
      </h1>
    </div>
  );
}
