import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Flashlight,
  FlashlightOff,
  ImageUp,
  Keyboard,
  Camera,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Clipboard,
  Cpu,
  Radio,
  FileCode2,
  RefreshCw,
  SearchCheck,
  CheckCircle2,
} from "lucide-react";
import {
  getScannerService,
  type ZoomCapabilities,
} from "@/lib/scanner-service";
import { parseScanContent } from "@/lib/scan/parser";
import { db, saveNewCaseForScan, pruneCases } from "@/lib/db";
import type { InvestigationCase, ScanRecord } from "@/lib/scan/types";
import { investigationEngine } from "@/lib/investigation";
import { ResultSheet } from "@/components/ResultSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { scanFeedback } from "@/lib/feedback";
import { toast } from "sonner";
import { usePinchToZoom } from "@/hooks/use-pinch-to-zoom";
import { CameraOverlay } from "@/components/CameraOverlay";
import { telemetry } from "@/lib/telemetry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const newId = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

type CameraState =
  | "loading"
  | "active"
  | "denied"
  | "denied-permanent"
  | "unavailable"
  | "error";

export default function ScanScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastResultRef = useRef<{ content: string; at: number } | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCapabilities | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [manualError, setManualError] = useState("");
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    zoom,
    applyZoom,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = usePinchToZoom(zoomCaps);

  const mountedRef = useRef(true);
  const tRef = useRef(t);
  tRef.current = t;

  const openInvestigation = useCallback(
    (invId: string) => {
      navigate(`/investigation/${invId}`);
    },
    [navigate],
  );

  const handleResult = useCallback(
    async (content: string, format: ScanRecord["format"]) => {
      const now = Date.now();
      if (
        lastResultRef.current &&
        lastResultRef.current.content === content &&
        now - lastResultRef.current.at < 2500
      ) {
        return;
      }
      lastResultRef.current = { content, at: now };

      setIsProcessing(true);
      try {
        const parsed = parseScanContent(content, format);
        telemetry.trackEvent("scan_completed", { format, type: parsed.type });
        const record: ScanRecord = {
          id: newId(),
          content,
          format,
          type: parsed.type,
          parsed: parsed.data,
          safetyStatus: "unchecked",
          scannedAt: now,
        };

        let c: InvestigationCase;
        try {
          c = await saveNewCaseForScan(record);
        } catch {
          c = {
            id: `case-${newId()}`,
            createdAt: now,
            updatedAt: now,
          };
          record.caseId = c.id;
          await db.cases.put(c).catch(() => undefined);
          await db.scans.put(record).catch(() => undefined);
        }

        // Run full modular investigation engine
        const { report: inv } = await investigationEngine.runInvestigation(record, c.id);
        await db.investigations.put(inv).catch(() => undefined);

        const finalRiskOverall = inv.finalRisk.overall;
        const safetyStatus: ScanRecord["safetyStatus"] =
          finalRiskOverall === "critical" || finalRiskOverall === "high"
            ? "malicious"
            : finalRiskOverall === "medium" || finalRiskOverall === "low"
              ? "suspicious"
              : finalRiskOverall === "benign"
                ? "safe"
                : "unchecked";

        record.safetyStatus = safetyStatus;
        record.investigationId = inv.id;
        await db.scans.put(record).catch(() => undefined);
        await db.cases.update(c.id, {
          latestRiskLevel: finalRiskOverall,
          latestInvestigationId: inv.id,
          updatedAt: now,
        }).catch(() => undefined);

        pruneCases().catch(() => undefined);

        scanFeedback();
        setResult(record);

        if (safetyStatus === "malicious" || safetyStatus === "suspicious") {
          toast(
            safetyStatus === "malicious"
              ? t("scan.riskCritical", "Threat detected — open investigation")
              : t("scan.riskSuspicious", "Suspicious payload — review findings"),
            {
              icon: <ShieldAlert className="h-4 w-4" />,
              action: {
                label: t("scan.openInvestigation", "Investigate"),
                onClick: () => openInvestigation(inv.id),
              },
            },
          );
        }
      } catch (e) {
        console.error("[ScanScreen] handleResult error:", e);
        toast.error(tRef.current("errors.storageFailed", "Failed to process scan record"));
      } finally {
        setIsProcessing(false);
      }
    },
    [t, openInvestigation],
  );

  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return;
    const svc = getScannerService();
    svc.stop();
    setCameraState("loading");
    setErrorDetail(null);

    try {
      try {
        const permStatus = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (permStatus.state === "denied") {
          setCameraState("denied-permanent");
          return;
        }
      } catch {
        /* permissions API not supported */
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((d) => d.kind === "videoinput");
        if (!hasCamera) {
          setCameraState("unavailable");
          return;
        }
      } catch {
        /* enumerateDevices not supported */
      }

      if (!videoRef.current || !mountedRef.current) {
        setCameraState("error");
        setErrorDetail("Video element not ready");
        return;
      }

      await svc.start(videoRef.current, ({ content, format }) => {
        handleResult(content, format);
      });

      if (!mountedRef.current) {
        svc.stop();
        return;
      }
      setCameraState("active");

      setTimeout(() => {
        if (!mountedRef.current) return;
        setTorchAvail(svc.isTorchAvailable());
        const caps = svc.getZoomCapabilities();
        setZoomCaps(caps);
        if (caps) applyZoom(caps.min);
      }, 600);
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ScanScreen] Camera start error:", msg);
      telemetry.trackEvent("camera_failed", { error: msg });

      if (/permission|denied|NotAllowed/i.test(msg)) {
        try {
          const permStatus = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          setCameraState(
            permStatus.state === "denied" ? "denied-permanent" : "denied",
          );
        } catch {
          setCameraState("denied");
        }
      } else if (/NotFound|DevicesNotFound/i.test(msg)) {
        setCameraState("unavailable");
      } else if (
        /NotReadable|TrackStartError|AbortError|could not start/i.test(msg)
      ) {
        setCameraState("error");
        setErrorDetail(tRef.current("scan.cameraInitFailedHelp", "Camera hardware is currently in use by another app."));
      } else {
        setCameraState("error");
        setErrorDetail(msg);
      }
    }
  }, [handleResult, applyZoom]);

  useEffect(() => {
    mountedRef.current = true;

    if (result) {
      getScannerService().stop();
      setCameraState("loading");
    } else {
      startCamera();
    }

    const onVisibility = () => {
      if (!mountedRef.current) return;
      if (document.hidden) {
        getScannerService().stop();
        setCameraState("loading");
      } else if (!result) {
        startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      getScannerService().stop();
    };
  }, [startCamera, retryCount, result]);

  const retryCamera = () => setRetryCount((c) => c + 1);

  const toggleTorch = async () => {
    try {
      const next = !torch;
      setTorch(next);
      await getScannerService().setTorch(next);
    } catch {
      toast.error(t("errors.unexpected", "Failed to toggle flashlight"));
    }
  };

  const handleManualValueChange = (val: string) => {
    setManualValue(val);
    if (val.length > 4096) {
      setManualError(
        t("scan.manualErrorTooLong", "Content exceeds the 4096 character limit."),
      );
    } else {
      setManualError("");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const toastId = toast.loading("Decoding barcode image safely...");
      const r = await getScannerService().scanFile(file);
      toast.dismiss(toastId);
      if (!r) toast.error(t("scan.noCodeFound", "No readable QR code or barcode found in image."));
      else await handleResult(r.content, r.format);
    } catch {
      toast.error(t("scan.imageScanFailed", "Failed to parse barcode from image."));
    }
    e.target.value = "";
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.info("Clipboard is empty.");
        return;
      }
      toast.success("Payload pasted from clipboard");
      await handleResult(text.trim(), "UNKNOWN");
    } catch {
      toast.error("Clipboard access denied. Use manual input instead.");
      setManualOpen(true);
    }
  };

  const submitManual = async () => {
    const val = manualValue.trim();
    if (!val) {
      setManualError(
        t("scan.manualErrorEmpty", "Code content cannot be empty."),
      );
      return;
    }
    if (val.length > 4096) {
      setManualError(
        t("scan.manualErrorTooLong", "Content exceeds the 4096 character limit."),
      );
      return;
    }
    setManualError("");
    setManualOpen(false);
    await handleResult(val, "UNKNOWN");
    setManualValue("");
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Ethos & Policy Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>QR & Barcode OSINT Scanner</span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                Inspection First
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Destinations are never automatically visited. Payloads are safely decoded and inspected in sandbox.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePasteClipboard}
            className="h-8 rounded-xl text-xs flex items-center gap-1.5"
          >
            <Clipboard className="h-3.5 w-3.5" />
            <span>Paste Payload</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setManualOpen(true)}
            className="h-8 rounded-xl text-xs flex items-center gap-1.5"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span>Manual Input</span>
          </Button>
        </div>
      </div>

      {/* Main Viewfinder Card */}
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-[520px] rounded-3xl overflow-hidden bg-black border border-border/80 shadow-card"
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
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <Camera className="h-10 w-10 animate-pulse text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Initializing Optical Scanner…
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Acquiring local camera stream with client-side frame processing.
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <RefreshCw className="h-9 w-9 animate-spin text-primary" />
              <p className="text-sm font-bold text-foreground">
                Synthesizing Payload Intelligence…
              </p>
              <p className="text-xs text-muted-foreground">
                Running local heuristics, domain parsing, and provider orchestration.
              </p>
            </div>
          </div>
        )}

        {cameraState === "active" && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur border border-white/10">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sensor Active</span>
            </div>

            {torchAvail && (
              <button
                onClick={toggleTorch}
                aria-pressed={torch}
                aria-label={torch ? t("scan.torchOff", "Turn off flashlight") : t("scan.torchOn", "Turn on flashlight")}
                className={`pointer-events-auto rounded-full p-2.5 backdrop-blur transition border ${
                  torch
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                    : "bg-black/60 text-white border-white/15 hover:bg-black/80"
                }`}
              >
                {torch ? (
                  <Flashlight className="h-4 w-4" />
                ) : (
                  <FlashlightOff className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Viewfinder Reticle */}
        {cameraState === "active" && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div
              className="scan-reticle relative h-56 w-56 sm:h-64 sm:w-64 max-w-[75vw]"
              role="region"
              aria-live="polite"
              aria-label="QR and Barcode scan target viewfinder."
            >
              <Corner className="-left-1 -top-1" />
              <Corner className="-right-1 -top-1 rotate-90" />
              <Corner className="-bottom-1 -left-1 -rotate-90" />
              <Corner className="-bottom-1 -right-1 rotate-180" />
              <div className="scan-line absolute inset-x-2 top-0 h-0.5 animate-scan-line rounded-full" />
            </div>
          </div>
        )}

        {/* Zoom Slider */}
        {cameraState === "active" && zoomCaps && (
          <div
            className="pointer-events-auto absolute inset-x-0 bottom-16 z-10 mx-auto flex max-w-xs items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur border border-white/10"
            style={{ width: "min(78vw, 20rem)" }}
          >
            <span className="w-8 text-center text-xs font-semibold tabular-nums text-white">
              {zoom.toFixed(1)}x
            </span>
            <Slider
              value={[zoom]}
              min={zoomCaps.min}
              max={zoomCaps.max}
              step={zoomCaps.step}
              onValueChange={(v) => applyZoom(v[0])}
              className="flex-1"
              aria-label="Camera Zoom"
            />
            <span className="w-8 text-right text-xs text-white/60 tabular-nums">
              {zoomCaps.max.toFixed(1)}x
            </span>
          </div>
        )}

        {/* Bottom Fast Action Row */}
        {cameraState === "active" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2 px-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="pointer-events-auto flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-medium text-white backdrop-blur border border-white/15 hover:bg-black/90 transition"
            >
              <ImageUp className="h-3.5 w-3.5" />
              <span>Scan Image File</span>
            </button>

            <button
              onClick={() => setManualOpen(true)}
              className="pointer-events-auto flex h-10 items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-medium text-white backdrop-blur border border-white/15 hover:bg-black/90 transition"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span>Manual Entry</span>
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFile}
        />

        <CameraOverlay
          cameraState={cameraState}
          errorDetail={errorDetail}
          retryCamera={retryCamera}
          onFileSelect={() => fileRef.current?.click()}
          onManualInput={() => setManualOpen(true)}
          onOpenSettings={() => setShowPermissionGuide(true)}
        />
      </div>

      {/* Inspection Preview Drawer */}
      <ResultSheet
        scan={result}
        onClose={() => setResult(null)}
        onInvestigate={() => result?.investigationId && openInvestigation(result.investigationId)}
      />

      {/* Manual Input Dialog */}
      <Dialog
        open={manualOpen}
        onOpenChange={(open) => {
          setManualOpen(open);
          if (!open) setManualError("");
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <span>Manual Payload Inspection</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Paste or type any raw QR/barcode content, URL, Wi-Fi configuration, or cryptic string.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <textarea
              value={manualValue}
              onChange={(e) => handleManualValueChange(e.target.value)}
              placeholder="e.g. https://suspicious-domain.xyz/auth?token=... or WIFI:S:Office;T:WPA;P:secret;;"
              rows={4}
              autoFocus
              className="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            {manualError && (
              <p className="pl-1 animate-pulse text-[11px] text-destructive">
                {manualError}
              </p>
            )}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>Supports URLs, Wi-Fi, vCard, Cryptocurrency, raw hex/text</span>
              <span>{manualValue.length} / 4096</span>
            </div>
          </div>
          <Button onClick={submitManual} className="h-10 rounded-xl text-xs font-semibold">
            Inspect Payload
          </Button>
        </DialogContent>
      </Dialog>

      {/* Permission Guide Dialog */}
      <Dialog open={showPermissionGuide} onOpenChange={setShowPermissionGuide}>
        <DialogContent className="max-w-sm rounded-2xl border border-border bg-card p-5 text-center shadow-2xl">
          <DialogHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Settings className="h-6 w-6" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Camera Access Permissions
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enable camera permissions to scan physical QR and 1D/2D barcodes directly.
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 max-h-60 space-y-3 overflow-y-auto pr-1 text-left text-xs text-muted-foreground">
            <div>
              <strong className="text-foreground">
                🌐 Web Browsers (Chrome, Edge, Firefox, Safari):
              </strong>
              <ol className="mt-1 list-decimal space-y-1 pl-2 text-[11px] list-inside">
                <li>Click the lock icon 🔒 next to the address bar.</li>
                <li>Set Camera permission to <b>Allow</b>.</li>
                <li>Reload this webpage.</li>
              </ol>
            </div>
          </div>

          <Button
            onClick={() => {
              setShowPermissionGuide(false);
              retryCamera();
            }}
            className="h-10 w-full rounded-xl text-xs font-semibold"
          >
            Retry Camera Access
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Corner = memo(function Corner({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`absolute h-6 w-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-primary ${className}`}
      aria-hidden
    />
  );
});
