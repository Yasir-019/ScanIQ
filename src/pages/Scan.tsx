import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { Flashlight, FlashlightOff, ImageUp, Keyboard, X, Camera, CameraOff, RotateCcw, AlertTriangle, Settings } from "lucide-react";
import { getScannerService, type ZoomCapabilities } from "@/lib/scanner-service";
import { parseScanContent } from "@/lib/scan/parser";
import { db, pruneFreeHistory } from "@/lib/db";
import type { ScanRecord } from "@/lib/scan/types";
import { analyzeUrlSafety } from "@/lib/url-safety";
import { useSettings } from "@/lib/settings";
import { useActionStats } from "@/lib/action-stats";
import { ResultSheet } from "@/components/ResultSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { scanFeedback } from "@/lib/feedback";
import { toast } from "sonner";

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

type CameraState = "loading" | "active" | "denied" | "denied-permanent" | "unavailable" | "error";

export default function ScanScreen() {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastResultRef = useRef<{ content: string; at: number } | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCapabilities | null>(null);
  const [zoom, setZoom] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState("");
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Pinch tracking refs
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const rafRef = useRef<number | null>(null);
  const pendingZoomRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Stable ref for translation function
  const tRef = useRef(t);
  tRef.current = t;

  const handleResult = useCallback(async (content: string, format: ScanRecord["format"]) => {
    const now = Date.now();
    if (lastResultRef.current && lastResultRef.current.content === content && now - lastResultRef.current.at < 2500) {
      return;
    }
    lastResultRef.current = { content, at: now };

    try {
      const parsed = parseScanContent(content, format);
      const safetyStatus = parsed.type === "url" ? analyzeUrlSafety(content).level : undefined;
      const record: ScanRecord = {
        id: newId(),
        content,
        format,
        type: parsed.type,
        parsed: parsed.data,
        safetyStatus: safetyStatus || "unchecked",
        scannedAt: now,
      };
      scanFeedback();
      await db.scans.put(record);
      pruneFreeHistory().catch(() => undefined);
      setResult(record);

      // Auto-actions based on settings
      const settings = useSettings.getState();
      const actionStats = useActionStats.getState();

      if (parsed.type === "text" && settings.autoCopyText) {
        try {
          await navigator.clipboard.writeText(content);
          toast.success(tRef.current("result.autoCopied"));
          actionStats.record("copy");
        } catch { /* clipboard unavailable */ }
      }

      if (parsed.type === "wifi" && settings.autoConnectWifi && parsed.data.password) {
        try {
          await navigator.clipboard.writeText(parsed.data.password);
          toast.success(tRef.current("result.autoWifiCopied"));
          actionStats.record("copy_password");
        } catch { /* clipboard unavailable */ }
      }

      if (parsed.type === "url" && settings.autoOpenUrls && safetyStatus === "safe") {
        window.open(content, "_blank", "noopener,noreferrer");
        actionStats.record("open_url");
      }
    } catch (e) {
      console.error("[ScanScreen] handleResult error:", e);
      toast.error(tRef.current("errors.storageFailed"));
    }
  }, []); // Stable — uses tRef

  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return;
    const svc = getScannerService();

    // Stop existing session first to avoid play() race
    svc.stop();

    setCameraState("loading");
    setErrorDetail(null);

    try {
      // Check permission status first (where supported)
      try {
        const permStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (permStatus.state === "denied") {
          setCameraState("denied-permanent");
          return;
        }
      } catch {
        // permissions API not supported, proceed
      }

      // Check if any camera device exists
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((d) => d.kind === "videoinput");
        if (!hasCamera) {
          setCameraState("unavailable");
          return;
        }
      } catch {
        // enumerateDevices not supported, proceed
      }

      if (!videoRef.current || !mountedRef.current) {
        setCameraState("error");
        setErrorDetail("Video element not ready");
        return;
      }

      await svc.start(videoRef.current, ({ content, format }) => {
        handleResult(content, format);
      });

      if (!mountedRef.current) { svc.stop(); return; }
      setCameraState("active");

      setTimeout(() => {
        if (!mountedRef.current) return;
        setTorchAvail(svc.isTorchAvailable());
        const caps = svc.getZoomCapabilities();
        setZoomCaps(caps);
        if (caps) setZoom(caps.min);
      }, 600);
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ScanScreen] Camera start error:", msg);

      if (/permission|denied|NotAllowed/i.test(msg)) {
        try {
          const permStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
          setCameraState(permStatus.state === "denied" ? "denied-permanent" : "denied");
        } catch {
          setCameraState("denied");
        }
      } else if (/NotFound|DevicesNotFound/i.test(msg)) {
        setCameraState("unavailable");
      } else if (/NotReadable|TrackStartError|AbortError|could not start/i.test(msg)) {
        setCameraState("error");
        setErrorDetail(tRef.current("scan.cameraInitFailedHelp"));
      } else {
        setCameraState("error");
        setErrorDetail(msg);
      }
    }
  }, [handleResult]); // Stable — handleResult is stable

  useEffect(() => {
    mountedRef.current = true;

    startCamera();

    const onVisibility = () => {
      if (!mountedRef.current) return;
      if (document.hidden) {
        getScannerService().stop();
        setCameraState("loading");
      } else {
        startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      getScannerService().stop();
    };
  }, [startCamera, retryCount]);

  const retryCamera = () => {
    setRetryCount((c) => c + 1);
  };

  const toggleTorch = async () => {
    try {
      const next = !torch;
      setTorch(next);
      await getScannerService().setTorch(next);
    } catch {
      toast.error(t("errors.unexpected"));
    }
  };

  const applyZoom = (next: number) => {
    if (!zoomCaps) return;
    const clamped = Math.max(zoomCaps.min, Math.min(zoomCaps.max, next));
    setZoom(clamped);
    pendingZoomRef.current = clamped;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const v = pendingZoomRef.current;
        if (v != null) getScannerService().setZoom(v);
      });
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomCaps) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinchStartDistRef.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartZoomRef.current = zoom;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current && zoomCaps) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchStartDistRef.current;
      applyZoom(pinchStartZoomRef.current * ratio);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStartDistRef.current = null;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await getScannerService().scanFile(file);
      if (!r) {
        toast.error(t("scan.noCodeFound"));
      } else {
        await handleResult(r.content, r.format);
      }
    } catch {
      toast.error(t("scan.imageScanFailed"));
    }
    e.target.value = "";
  };

  const submitManual = async () => {
    const val = manualValue.trim();
    if (!val) {
      setManualError(t("scan.manualErrorEmpty", "Code content cannot be empty."));
      return;
    }
    if (val.length > 2048) {
      setManualError(t("scan.manualErrorTooLong", "Content exceeds the 2048 character limit."));
      return;
    }
    setManualError("");
    setManualOpen(false);
    await handleResult(val, "UNKNOWN");
    setManualValue("");
  };

  const handleManualValueChange = (val: string) => {
    setManualValue(val);
    if (val.length > 2048) {
      setManualError(t("scan.manualErrorTooLong", "Content exceeds the 2048 character limit."));
    } else {
      setManualError("");
    }
  };

  const renderCameraOverlay = () => {
    if (cameraState === "active" || cameraState === "loading") return null;

    const overlayConfig: Record<string, {
      icon: React.ReactNode;
      title: string;
      help: string;
      showRetry: boolean;
      showSettings?: boolean;
    }> = {
      denied: {
        icon: <X className="mx-auto h-10 w-10 text-destructive" />,
        title: t("scan.cameraBlocked"),
        help: t("scan.cameraBlockedHelp"),
        showRetry: true,
      },
      "denied-permanent": {
        icon: <CameraOff className="mx-auto h-10 w-10 text-destructive" />,
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
        <div className="max-w-sm space-y-3 text-center">
          {cfg.icon}
          <h2 className="text-xl font-semibold">{cfg.title}</h2>
          <p className="text-sm text-muted-foreground">{cfg.help}</p>
          <div className="flex flex-col items-center gap-2 pt-1">
            {cfg.showRetry && (
              <Button onClick={retryCamera} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" /> {t("scan.retryCamera")}
              </Button>
            )}
            {cfg.showSettings && (
              <Button onClick={() => setShowPermissionGuide(true)} variant="outline" className="w-full mt-1 border-destructive/20 text-destructive hover:bg-destructive/5">
                <Settings className="mr-2 h-4 w-4" /> {t("scan.openSettings")}
              </Button>
            )}
            <div className="flex gap-2 pt-2 justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImageUp className="mr-1 h-4 w-4" /> {t("scan.imageButton")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setManualOpen(true)}
              >
                <Keyboard className="mr-1 h-4 w-4" /> {t("scan.manualButton")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: zoomCaps ? "none" : "auto" }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {cameraState === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3">
            <Camera className="h-10 w-10 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        </div>
      )}

      {cameraState === "active" && (
        <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
          <div className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            {t("scan.topBadge")}
          </div>
          {torchAvail && (
            <button
              onClick={toggleTorch}
              aria-pressed={torch}
              aria-label={torch ? t("scan.torchOff") : t("scan.torchOn")}
              className={`pointer-events-auto rounded-full p-2.5 backdrop-blur transition ${
                torch
                  ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.55)]"
                  : "bg-black/40 text-white"
              }`}
            >
              {torch ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}

      {cameraState === "active" && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <div className="scan-reticle relative h-64 w-64 max-w-[78vw]">
            <Corner className="-left-1 -top-1" />
            <Corner className="-right-1 -top-1 rotate-90" />
            <Corner className="-bottom-1 -left-1 -rotate-90" />
            <Corner className="-bottom-1 -right-1 rotate-180" />
            <div className="scan-line absolute inset-x-2 top-0 h-0.5 animate-scan-line rounded-full" />
          </div>
        </div>
      )}

      {cameraState === "active" && zoomCaps && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-24 z-10 mx-auto flex max-w-xs items-center gap-3 rounded-full bg-black/45 px-4 py-2 backdrop-blur"
             style={{ width: "min(78vw, 22rem)" }}>
          <span className="w-9 text-center text-xs font-semibold tabular-nums text-white">
            {zoom.toFixed(1)}x
          </span>
          <Slider
            value={[zoom]}
            min={zoomCaps.min}
            max={zoomCaps.max}
            step={zoomCaps.step}
            onValueChange={(v) => applyZoom(v[0])}
            className="flex-1"
          />
          <span className="w-9 text-right text-xs text-white/60 tabular-nums">
            {zoomCaps.max.toFixed(1)}x
          </span>
        </div>
      )}

      {cameraState === "active" && !zoomCaps && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 px-6 text-center">
          <p className="mx-auto inline-block rounded-full bg-black/45 px-4 py-1.5 text-xs text-white/90 backdrop-blur">
            {t("scan.hint")}
          </p>
        </div>
      )}

      {cameraState === "active" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-3 px-6">
          <button
            onClick={() => fileRef.current?.click()}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
          >
            <ImageUp className="h-4 w-4" /> {t("scan.imageButton")}
          </button>
          <button
            onClick={() => setManualOpen(true)}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
          >
            <Keyboard className="h-4 w-4" /> {t("scan.manualButton")}
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {renderCameraOverlay()}

      <ResultSheet scan={result} onClose={() => setResult(null)} />

      <Dialog open={manualOpen} onOpenChange={(open) => { setManualOpen(open); if (!open) setManualError(""); }}>
        <DialogContent className="max-w-xs rounded-3xl border border-border bg-card p-5 shadow-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t("scan.manualTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={manualValue}
              onChange={(e) => handleManualValueChange(e.target.value)}
              placeholder={t("scan.manualPlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
              autoFocus
              className="rounded-2xl"
            />
            {manualError && (
              <p className="text-[11px] text-destructive pl-1 animate-pulse">{manualError}</p>
            )}
            <p className="text-[10px] text-muted-foreground text-right pr-1">
              {manualValue.length} / 2048
            </p>
          </div>
          <Button onClick={submitManual} className="rounded-2xl h-11">{t("scan.manualSubmit")}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionGuide} onOpenChange={setShowPermissionGuide}>
        <DialogContent className="max-w-xs rounded-3xl border border-border bg-card p-5 text-center shadow-lg">
          <DialogHeader className="items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Settings className="h-7 w-7" />
            </div>
            <DialogTitle className="text-lg text-foreground">Camera Permissions</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              How to enable camera access for ScanIQ:
            </DialogDescription>
          </DialogHeader>

          <div className="text-left text-xs text-muted-foreground space-y-3 my-2 max-h-60 overflow-y-auto pr-1">
            <div>
              <strong className="text-foreground">🌐 Mobile Browsers (Chrome/Safari):</strong>
              <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px]">
                <li>Tap the lock icon 🔒 (or site settings menu) next to the web address bar.</li>
                <li>Tap <strong className="text-foreground">Site Settings</strong> or Permissions.</li>
                <li>Toggle Camera permission to <strong className="text-foreground">Allow</strong>.</li>
                <li>Refresh this webpage.</li>
              </ol>
            </div>
            <div>
              <strong className="text-foreground">📱 Android Installed App (TWA):</strong>
              <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-[11px]">
                <li>Open your Android phone <strong className="text-foreground">Settings &gt; Apps</strong>.</li>
                <li>Select <strong className="text-foreground">ScanIQ</strong> in your application list.</li>
                <li>Tap <strong className="text-foreground">Permissions</strong> &gt; Toggle <strong className="text-foreground">Camera</strong> on.</li>
              </ol>
            </div>
          </div>

          <Button
            onClick={() => {
              setShowPermissionGuide(false);
              retryCamera();
            }}
            className="w-full h-11 rounded-2xl text-xs"
          >
            I've Enabled It (Retry Camera)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Corner = memo(function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary ${className}`}
      aria-hidden
    />
  );
});
