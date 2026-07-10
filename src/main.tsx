import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { useSettings } from "./lib/settings";
import { initInstallPrompt } from "./hooks/use-install-prompt";

// Global error handlers — prevent unhandled crashes
window.addEventListener("error", (e) => {
  console.error("[Global error]", e.error ?? e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[Unhandled rejection]", e.reason);
});

// Apply persisted theme before first paint
const applyTheme = () => {
  const theme = useSettings.getState().theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
};
applyTheme();
useSettings.subscribe(applyTheme);

// Initialize PWA install prompt
initInstallPrompt();

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered:", registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour

        // Handle updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available — notify user
                console.log("[SW] New version available");
                // Dispatch custom event for UI to handle
                window.dispatchEvent(new CustomEvent("sw-update-available"));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("[SW] Registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
