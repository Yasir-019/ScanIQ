import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });
import { useSettings } from "./lib/settings";

// Apply persisted theme before first paint
const applyTheme = () => {
  const theme = useSettings.getState().theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
};
applyTheme();
useSettings.subscribe(applyTheme);

createRoot(document.getElementById("root")!).render(<App />);
