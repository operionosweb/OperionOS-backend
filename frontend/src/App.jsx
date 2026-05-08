import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ControlCenter from "./pages/ControlCenter";
import Copilot from "./pages/Copilot";

export default function App() {

  return (
    <AuthProvider>

      <Router>

        <Routes>

          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route path="/" element={<ControlCenter />} />
          <Route path="/control-center" element={<ControlCenter />} />
          <Route path="/copilot" element={<Copilot />} />

        </Routes>

      </Router>

    </AuthProvider>
  );
}
