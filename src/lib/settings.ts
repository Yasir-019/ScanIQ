import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppSettings {
  onboarded: boolean;
  sound: boolean;
  vibrate: boolean;
  /** Opt-in automations. All default to off: nothing acts on an untrusted code. */
  autoOpenUrls: boolean;
  autoCopyText: boolean;
  autoConnectWifi: boolean;
  theme: "dark" | "light";
  /** Diagnostics are off by default — privacy-first. */
  telemetryEnabled: boolean;
  /** Allow opt-in online enrichment providers (none enabled by default). */
  onlineEnrichment: boolean;
}

interface SettingsState extends AppSettings {
  set: (patch: Partial<AppSettings>) => void;
  completeOnboarding: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      sound: true,
      vibrate: true,
      autoOpenUrls: false,
      autoCopyText: false,
      autoConnectWifi: false,
      theme: "dark",
      telemetryEnabled: false,
      onlineEnrichment: false,
      set: (patch) => set(patch),
      completeOnboarding: () => set({ onboarded: true }),
    }),
    { name: "scaniq-settings" },
  ),
);
