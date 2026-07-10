import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

export function InstallBanner() {
  const { t } = useTranslation();
  const { isInstallable, promptInstall, dismiss } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-lg backdrop-blur-sm">
        {/* App Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5 text-white"
          >
            <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {t("install.title", "Install ScanIQ")}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {t("install.description", "Add to home screen for quick access")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={promptInstall}
            className="h-8 px-3 text-xs font-medium"
          >
            {t("install.button", "Install")}
          </Button>
          <button
            onClick={dismiss}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={t("install.dismiss", "Dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
