import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { clearPreResetSaves } from "./storage";

clearPreResetSaves(location.hostname);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
