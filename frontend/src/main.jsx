import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/production.css";
import "./styles/demo.css";
import "./styles/assistant.css";
import "./styles/aviation-map.css";
import "./styles/aviation-map-v2.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
