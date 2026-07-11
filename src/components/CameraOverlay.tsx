import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CameraOff, AlertTriangle, RotateCcw, Keyboard, ImageUp, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraOverlayProps {
  cameraState: string;
  errorDetail: string | null;
  retryCamera: () => void;
  onFileSelect: () => void;
  onManualInput: () => void;
  onOpenSettings: () => void;
}

export const CameraOverlay = memo(function CameraOverlay({
  cameraState,
  errorDetail,
  retryCamera,
  onFileSelect,
  onManualInput,
  onOpenSettings,
}: CameraOverlayProps) {
  const { t } = useTranslation();

  if (cameraState === "active" || cameraState === "loading") return null;

  const overlayConfig: Record<string, {
    icon: React.ReactNode;
    title: string;
    help: string;
    showRetry: boolean;
    showSettings?: boolean;
  }> = {
    denied: {
      icon: <X className="mx-auto h-10 w-10 text-destructive animate-bounce" />,
      title: t("scan.cameraBlocked"),
      help: t("scan.cameraBlockedHelp"),
      showRetry: true,
    },
    "denied-permanent": {
      icon: <CameraOff className="mx-auto h-10 w-10 text-destructive animate-pulse" />,
      title: t("scan.cameraBlocked"),
      help: t("scan.cameraBlockedPermanent"),
      showRetry: true,
      showSettings: true,
    },
    unavailable: {
      icon: <Camera className="mx-auto h-10 w-10 text-muted-foreground" />,
      title: t("scan.cameraUnavailable"),
      help: t("scan.cameraUnavailableHelp"),
      showRetry: false,
    },
    error: {
      icon: <AlertTriangle className="mx-auto h-10 w-10 text-warning" />,
      title: t("scan.cameraInitFailed"),
      help: errorDetail || t("scan.cameraInitFailedHelp"),
      showRetry: true,
    },
  };

  const cfg = overlayConfig[cameraState];
  if (!cfg) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-6">
      <div className="max-w-sm space-y-3 text-center animate-slide-up">
        {cfg.icon}
        <h2 className="text-xl font-semibold text-foreground">{cfg.title}</h2>
        <p className="text-sm text-muted-foreground">{cfg.help}</p>
        <div className="flex flex-col items-center gap-2 pt-1 w-full">
          {cfg.showRetry && (
            <Button onClick={retryCamera} className="w-full h-11 rounded-2xl">
              <RotateCcw className="mr-2 h-4 w-4" /> {t("scan.retryCamera")}
            </Button>
          )}
          {cfg.showSettings && (
            <Button
              onClick={onOpenSettings}
              variant="outline"
              className="w-full mt-1 border-destructive/20 text-destructive hover:bg-destructive/5 h-11 rounded-2xl"
            >
              <Settings className="mr-2 h-4 w-4" /> {t("scan.openSettings")}
            </Button>
          )}
          <div className="flex gap-2 pt-2 justify-center w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={onFileSelect}
              className="pointer-events-auto rounded-full bg-secondary/80 text-foreground hover:bg-secondary h-11 px-4 text-xs flex-1"
            >
              <ImageUp className="mr-1.5 h-4 w-4" /> {t("scan.imageButton")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onManualInput}
              className="pointer-events-auto rounded-full bg-secondary/80 text-foreground hover:bg-secondary h-11 px-4 text-xs flex-1"
            >
              <Keyboard className="mr-1.5 h-4 w-4" /> {t("scan.manualButton")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
