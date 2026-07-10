import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useTranslation } from "react-i18next";

export function OfflineBanner() {
  const online = useNetworkStatus();
  const { t } = useTranslation();

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-xs font-medium text-warning-foreground shadow-md">
      <WifiOff className="h-3.5 w-3.5" />
      {t("errors.offline")}
    </div>
  );
}
