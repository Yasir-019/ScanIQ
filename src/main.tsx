import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { useSettings } from "./lib/settings";

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

createRoot(document.getElementById("root")!).render(<App />);
