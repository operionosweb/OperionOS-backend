import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ControlCenter from "./pages/ControlCenter";
import Copilot from "./pages/Copilot";

export default function App() {

  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  async function checkOnboarding() {

    try {

      const token = localStorage.getItem("sb-token");

      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(
        "https://operionos-backend-1.onrender.com/api/onboarding/status",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const json = await res.json();

      setNeedsOnboarding(json.needsOnboarding);
      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    checkOnboarding();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading Operion...</div>;
  }

  return (
    <Router>

      <Routes>

        {/* AUTH */}
        <Route path="/auth" element={<Auth />} />

        {/* ONBOARDING FLOW */}
        {needsOnboarding ? (
          <Route path="*" element={<Onboarding />} />
        ) : (
          <>
            <Route path="/" element={<ControlCenter />} />
            <Route path="/control-center" element={<ControlCenter />} />
            <Route path="/copilot" element={<Copilot />} />
          </>
        )}

      </Routes>

    </Router>
  );
}
