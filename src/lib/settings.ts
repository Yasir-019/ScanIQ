import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultSourceToggles } from "@/lib/osint/sources";

export interface AppSettings {
  onboarded: boolean;
  sound: boolean;
  vibrate: boolean;
  theme: "dark" | "light";
  telemetryEnabled: boolean;
  defaultOpenDestinations: boolean;
  confirmBeforeOpenDestinations: boolean;
  autoStartCamera: boolean;
  caseLanguage: string;
  sourceToggles: Record<string, boolean>;
  apiKeys: Record<string, string>;
  externalLookupsOptedIn: boolean;
  caseRetentionDays: number;
  investigatorName?: string;
  investigatorHandle?: string;
}

interface SettingsState extends AppSettings {
  set: (patch: Partial<AppSettings>) => void;
  completeOnboarding: () => void;
  toggleSource: (sourceId: string, value: boolean) => void;
  setApiKey: (keyId: string, value: string) => void;
  resetSourceToggles: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      onboarded: false,
      sound: true,
      vibrate: true,
      theme: "dark",
      telemetryEnabled: false,
      defaultOpenDestinations: false,
      confirmBeforeOpenDestinations: true,
      autoStartCamera: false,
      caseLanguage: "en",
      sourceToggles: defaultSourceToggles(),
      apiKeys: {},
      externalLookupsOptedIn: false,
      caseRetentionDays: 90,
      set: (patch) => set(patch),
      completeOnboarding: () => set({ onboarded: true }),
      toggleSource: (sourceId, value) =>
        set((s) => ({ sourceToggles: { ...s.sourceToggles, [sourceId]: value } })),
      setApiKey: (keyId, value) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [keyId]: value } })),
      resetSourceToggles: () => set({ sourceToggles: defaultSourceToggles() }),
    }),
    { name: "scaniq-settings" },
  ),
);
