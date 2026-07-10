import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppSettings {
  onboarded: boolean;
  sound: boolean;
  vibrate: boolean;
  autoOpenUrls: boolean;
  autoCopyText: boolean;
  autoConnectWifi: boolean;
  theme: "dark" | "light";
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
      set: (patch) => set(patch),
      completeOnboarding: () => set({ onboarded: true }),
    }),
    { name: "scaniq-settings" },
  ),
);
