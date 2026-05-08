import React from "react";

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

/* ===============================
   PAGES
=============================== */

import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ControlCenter from "./pages/ControlCenter";
import OperationsCenter from "./pages/OperationsCenter";

/* ===============================
   APP
=============================== */

export default function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ===============================
            PUBLIC
        =============================== */}

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        {/* ===============================
            CORE PLATFORM
        =============================== */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/control-center"
          element={<ControlCenter />}
        />

        <Route
          path="/operations-center"
          element={<OperationsCenter />}
        />

      </Routes>

    </BrowserRouter>

  );

}
