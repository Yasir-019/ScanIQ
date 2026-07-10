import { create } from "zustand";

interface InstallPromptState {
  promptEvent: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  isDismissed: boolean;
  setPromptEvent: (event: BeforeInstallPromptEvent) => void;
  promptInstall: () => Promise<boolean>;
  dismiss: () => void;
  markInstalled: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Check if app is already installed
const isStandalone = () => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const useInstallPrompt = create<InstallPromptState>()((set, get) => ({
  promptEvent: null,
  isInstallable: false,
  isInstalled: isStandalone(),
  isDismissed: sessionStorage.getItem("scaniq-install-dismissed") === "true",

  setPromptEvent: (event) => {
    if (get().isInstalled || get().isDismissed) return;
    set({ promptEvent: event, isInstallable: true });
  },

  promptInstall: async () => {
    const { promptEvent } = get();
    if (!promptEvent) return false;

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "accepted") {
        set({ isInstallable: false, promptEvent: null });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  dismiss: () => {
    sessionStorage.setItem("scaniq-install-dismissed", "true");
    set({ isDismissed: true, isInstallable: false });
  },

  markInstalled: () => {
    set({ isInstalled: true, isInstallable: false, promptEvent: null });
  },
}));

// Initialize install prompt listener
export function initInstallPrompt() {
  // Listen for beforeinstallprompt event
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPrompt.getState().setPromptEvent(event as BeforeInstallPromptEvent);
  });

  // Listen for app installed event
  window.addEventListener("appinstalled", () => {
    useInstallPrompt.getState().markInstalled();
  });

  // Listen for display mode changes
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (event) => {
    if (event.matches) {
      useInstallPrompt.getState().markInstalled();
    }
  });
}
