import { BrowserRouter, Routes, Route } from "react-router-dom";

import ControlCenter from "./pages/ControlCenter";

function Home() {
  return (
    <div
      style={{
        background: "#081018",
        minHeight: "100vh",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "Arial"
      }}
    >
      <h1>OPERION OS</h1>

      <p>
        Aviation Operational Intelligence Platform
      </p>
    </div>
  );
}

function App() {

  return (
    <BrowserRouter>

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* CONTROL CENTER */}
        <Route
          path="/control-center"
          element={<ControlCenter />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;
