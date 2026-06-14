import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "leaflet/dist/leaflet.css";

// Force service worker to activate immediately when a new version is waiting
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          newSW.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }
      });
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
