import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppSettings {
  onboarded: boolean;
  sound: boolean;
  vibrate: boolean;
  autoOpenUrls: boolean;
  theme: "dark" | "light";
  isPro: boolean;
  proExpiry?: number;
}

interface SettingsState extends AppSettings {
  set: (patch: Partial<AppSettings>) => void;
  completeOnboarding: () => void;
  upgradeToPro: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      sound: true,
      vibrate: true,
      autoOpenUrls: false,
      theme: "dark",
      isPro: false,
      set: (patch) => set(patch),
      completeOnboarding: () => set({ onboarded: true }),
      upgradeToPro: () => set({ isPro: true }),
    }),
    { name: "scaniq-settings" },
  ),
);
