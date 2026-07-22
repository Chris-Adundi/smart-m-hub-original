import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

const rootElement = document.getElementById("root");

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
    <PwaInstallPrompt />
  </React.StrictMode>
);

window.dispatchEvent(new Event("smart-m-hub:ready"));

if ("serviceWorker" in navigator && (window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname))) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then((registration) => {
      if (registration.waiting) window.dispatchEvent(new Event("smart-m-hub:update-ready"));
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event("smart-m-hub:update-ready"));
          }
        });
      });
    }).catch(() => {});
  });
}
