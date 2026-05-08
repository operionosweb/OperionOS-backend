import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Auth from "./pages/Auth";
import ControlCenter from "./pages/ControlCenter";
import Copilot from "./pages/Copilot";

function App() {

  return (
    <Router>

      <Routes>

        {/* AUTH ENTRY */}
        <Route path="/auth" element={<Auth />} />

        {/* MAIN APP */}
        <Route path="/" element={<ControlCenter />} />
        <Route path="/control-center" element={<ControlCenter />} />
        <Route path="/copilot" element={<Copilot />} />

      </Routes>

    </Router>
  );
}

export default App;
