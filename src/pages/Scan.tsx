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
  Radio,
  RefreshCw,
  SearchCheck,
  UploadCloud,
  FileUp,
  AlertCircle,
  Layers,
  CornerDownLeft,
  X,
} from "lucide-react";
import {
  getScannerService,
  type ZoomCapabilities,
  type ScannerResult,
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

type ScanMode = "camera" | "image" | "paste";

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
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const lastResultRef = useRef<{ content: string; at: number } | null>(null);

  // Core mode state
  const [scanMode, setScanMode] = useState<ScanMode>("camera");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Camera mode state
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCapabilities | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Image mode state
  const [isDragging, setIsDragging] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [multipleCodes, setMultipleCodes] = useState<ScannerResult[] | null>(null);

  // Paste / Enter mode state
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

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

  // Converged investigation entrypoint
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

        // Run modular investigation engine
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
        await db.cases
          .update(c.id, {
            latestRiskLevel: finalRiskOverall,
            latestInvestigationId: inv.id,
            updatedAt: now,
          })
          .catch(() => undefined);

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
        toast.error(
          tRef.current("errors.storageFailed", "Failed to process scan record"),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [t, openInvestigation],
  );

  // Camera Management
  const startCamera = useCallback(async () => {
    if (!mountedRef.current || scanMode !== "camera") return;
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
        setErrorDetail(
          tRef.current(
            "scan.cameraInitFailedHelp",
            "Camera hardware is currently in use by another app.",
          ),
        );
      } else {
        setCameraState("error");
        setErrorDetail(msg);
      }
    }
  }, [handleResult, applyZoom, scanMode]);

  // Lifecycle when mode or result changes
  useEffect(() => {
    mountedRef.current = true;

    if (scanMode === "camera" && !result) {
      startCamera();
    } else {
      getScannerService().stop();
      if (scanMode === "camera" && result) {
        setCameraState("loading");
      }
    }

    const onVisibility = () => {
      if (!mountedRef.current) return;
      if (document.hidden) {
        getScannerService().stop();
        if (scanMode === "camera") setCameraState("loading");
      } else if (scanMode === "camera" && !result) {
        startCamera();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      getScannerService().stop();
    };
  }, [startCamera, retryCount, result, scanMode]);

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

  // Image Processing
  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setImageError("Please select a valid image file (PNG, JPEG, WebP, GIF, SVG, BMP).");
        return;
      }

      setImageFileName(file.name);
      setImageError(null);
      setIsDecodingImage(true);

      try {
        const svc = getScannerService();
        const res = await svc.scanFile(file);

        if (!res) {
          setImageError(
            t(
              "scan.imageDecodeFailed",
              "No readable QR code or barcode found in this image. Ensure the code has high contrast and is not cropped.",
            ),
          );
          toast.error(t("scan.noCodeFound", "No readable code found in image"));
        } else {
          toast.success(t("scan.imageDecodeSuccess", "Barcode detected and decoded"));
          await handleResult(res.content, res.format);
        }
      } catch (err) {
        console.error("[ScanScreen] Image decode error:", err);
        setImageError(
          t("scan.imageScanFailed", "Failed to parse barcode from image file."),
        );
        toast.error(t("scan.imageScanFailed", "Failed to parse barcode from image"));
      } finally {
        setIsDecodingImage(false);
      }
    },
    [t, handleResult],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const handlePasteScreenshot = async () => {
    try {
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], `pasted-image-${Date.now()}.${type.split("/")[1] || "png"}`, {
              type,
            });
            await processImageFile(file);
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }

      if (!foundImage) {
        toast.info("No image found in clipboard. Copy a screenshot or image first.");
      }
    } catch {
      toast.info("Clipboard access restricted. Use Ctrl+V (Cmd+V) on the dropzone instead.");
    }
  };

  // Window-level paste listener when Image or Paste mode is active
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (scanMode === "image") {
        const file = e.clipboardData?.files?.[0];
        if (file && file.type.startsWith("image/")) {
          e.preventDefault();
          processImageFile(file);
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [scanMode, processImageFile]);

  // Paste / Enter form actions
  const handlePasteClipboardText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.info("Clipboard is empty.");
        return;
      }
      setPasteInput(text.trim());
      setPasteError(null);
      toast.success("Payload pasted from clipboard");
    } catch {
      toast.error("Clipboard permission denied. Please paste manually into the field.");
    }
  };

  const handleManualSubmit = async () => {
    const val = pasteInput.trim();
    if (!val) {
      setPasteError(
        t("scan.manualErrorEmpty", "Input content cannot be empty."),
      );
      return;
    }
    if (val.length > 4096) {
      setPasteError(
        t(
          "scan.manualErrorTooLong",
          "Content exceeds the 4096 character limit.",
        ),
      );
      return;
    }
    setPasteError(null);
    await handleResult(val, "UNKNOWN");
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">
      {/* 1. Ethos & Policy Banner with Precise Privacy Statement */}
      <div className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5 sm:mt-0">
            <Radio className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">
                QR & Barcode OSINT Scanner
              </h1>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              >
                {t("scan.inspectionFirst", "Inspection First")}
              </Badge>
            </div>
            <p className="text-xs text-foreground/90 font-medium">
              {t(
                "scan.privacyNotice",
                "Your code is decoded locally before optional intelligence analysis.",
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t(
                "scan.privacySubtitle",
                "Destinations are never automatically visited. Payloads are safely decoded and inspected in sandbox.",
              )}
            </p>
          </div>
        </div>

        {/* Global Local Shield Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/50 text-[11px] text-muted-foreground shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Client-Side Decode</span>
        </div>
      </div>

      {/* 2. Accessible Scan Mode Selector */}
      <div
        role="tablist"
        aria-label={t("scan.modeSelectorAria", "Scan Input Mode")}
        className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border border-border bg-secondary/60 backdrop-blur-sm"
      >
        <button
          role="tab"
          id="tab-camera"
          aria-selected={scanMode === "camera"}
          aria-controls="panel-camera"
          tabIndex={scanMode === "camera" ? 0 : -1}
          onClick={() => setScanMode("camera")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            scanMode === "camera"
              ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40",
          )}
        >
          <Camera className="h-4 w-4 text-primary shrink-0" />
          <span>{t("scan.modeCamera", "Camera")}</span>
        </button>

        <button
          role="tab"
          id="tab-image"
          aria-selected={scanMode === "image"}
          aria-controls="panel-image"
          tabIndex={scanMode === "image" ? 0 : -1}
          onClick={() => setScanMode("image")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            scanMode === "image"
              ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40",
          )}
        >
          <ImageUp className="h-4 w-4 text-primary shrink-0" />
          <span>{t("scan.modeImage", "Image")}</span>
        </button>

        <button
          role="tab"
          id="tab-paste"
          aria-selected={scanMode === "paste"}
          aria-controls="panel-paste"
          tabIndex={scanMode === "paste" ? 0 : -1}
          onClick={() => setScanMode("paste")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            scanMode === "paste"
              ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40",
          )}
        >
          <Keyboard className="h-4 w-4 text-primary shrink-0" />
          <span>{t("scan.modePaste", "Paste / Enter")}</span>
        </button>
      </div>

      {/* 3. MODE PANELS */}

      {/* MODE 1: Camera Viewfinder */}
      {scanMode === "camera" && (
        <div
          role="tabpanel"
          id="panel-camera"
          aria-labelledby="tab-camera"
          className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-[520px] rounded-3xl overflow-hidden bg-black border border-border/80 shadow-card animate-fade-in"
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
                  aria-label={
                    torch
                      ? t("scan.torchOff", "Turn off flashlight")
                      : t("scan.torchOn", "Turn on flashlight")
                  }
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

          {/* Bottom Quick Switchers */}
          {cameraState === "active" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2 px-4">
              <button
                onClick={() => setScanMode("image")}
                className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3.5 text-xs font-medium text-white backdrop-blur border border-white/15 hover:bg-black/90 transition"
              >
                <ImageUp className="h-3.5 w-3.5" />
                <span>Upload Image</span>
              </button>

              <button
                onClick={() => setScanMode("paste")}
                className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3.5 text-xs font-medium text-white backdrop-blur border border-white/15 hover:bg-black/90 transition"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Enter Content</span>
              </button>
            </div>
          )}

          {/* Camera Error & Permission Overlay */}
          <CameraOverlay
            cameraState={cameraState}
            errorDetail={errorDetail}
            retryCamera={retryCamera}
            onFileSelect={() => setScanMode("image")}
            onManualInput={() => setScanMode("paste")}
            onOpenSettings={() => setShowPermissionGuide(true)}
          />
        </div>
      )}

      {/* MODE 2: Image Upload & Drag-and-Drop */}
      {scanMode === "image" && (
        <div
          role="tabpanel"
          id="panel-image"
          aria-labelledby="tab-image"
          className="space-y-4 animate-fade-in"
        >
          <div
            ref={dropzoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative w-full min-h-[340px] sm:min-h-[380px] rounded-3xl border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all bg-card/50 backdrop-blur-sm cursor-pointer group",
              isDragging
                ? "border-primary bg-primary/10 scale-[0.99] shadow-lg ring-4 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-card/80",
            )}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileInputChange}
            />

            {isDecodingImage ? (
              <div className="space-y-3 flex flex-col items-center animate-pulse">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {t("scan.imageDecoding", "Decoding barcode locally…")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {imageFileName ? `Inspecting ${imageFileName}` : "Analyzing optical patterns in sandboxed memory."}
                </p>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center max-w-md">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-foreground border border-border group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary transition-all",
                    isDragging && "scale-110 bg-primary/20 text-primary border-primary",
                  )}
                >
                  <UploadCloud className="h-8 w-8" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-foreground">
                    {t(
                      "scan.imageDropzonePrompt",
                      "Drag & drop an image here, or browse files",
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "scan.imageDropzonePasteHint",
                      "You can also paste a screenshot from your clipboard (Ctrl+V / Cmd+V)",
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-10 px-5 rounded-xl text-xs font-semibold shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current?.click();
                    }}
                  >
                    <FileUp className="h-4 w-4 mr-1.5" />
                    <span>{t("scan.imageBrowse", "Browse Files")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 px-4 rounded-xl text-xs font-medium border-border hover:bg-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteScreenshot();
                    }}
                  >
                    <Clipboard className="h-4 w-4 mr-1.5" />
                    <span>{t("scan.imagePasteAction", "Paste from Clipboard")}</span>
                  </Button>
                </div>

                <div className="pt-3 border-t border-border/60 w-full flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    PNG, JPEG, WebP, GIF, SVG, BMP
                  </Badge>
                  <span>·</span>
                  <span>14 symbologies supported</span>
                </div>
              </div>
            )}
          </div>

          {/* Image Error Alert */}
          {imageError && (
            <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 animate-slide-up">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold">{imageError}</p>
                <p className="text-muted-foreground">
                  {t(
                    "scan.imageDecodeFailedHelp",
                    "Ensure the code is in focus with good contrast, or enter it manually using the Paste / Enter tab.",
                  )}
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    className="h-7 text-[11px] rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    Try Another Image
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScanMode("paste")}
                    className="h-7 text-[11px] rounded-lg text-foreground hover:bg-secondary"
                  >
                    Switch to Paste / Enter
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: Paste / Enter Directly */}
      {scanMode === "paste" && (
        <div
          role="tabpanel"
          id="panel-paste"
          aria-labelledby="tab-paste"
          className="space-y-4 animate-fade-in"
        >
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-primary" />
                  <span>{t("scan.manualTitle", "Enter or Paste Code Content")}</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "scan.manualSubtitle",
                    "Directly inspect URLs, network strings, barcode digits, or arbitrary payloads.",
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePasteClipboardText}
                  className="h-8 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  <span>{t("scan.pasteClipboard", "Paste from Clipboard")}</span>
                </Button>

                {pasteInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPasteInput("");
                      setPasteError(null);
                    }}
                    className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    <span>{t("scan.clear", "Clear")}</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="manual-payload-textarea"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>Code Content / Payload</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {pasteInput.length} / 4096
                </span>
              </label>

              <textarea
                id="manual-payload-textarea"
                rows={5}
                value={pasteInput}
                onChange={(e) => {
                  setPasteInput(e.target.value);
                  if (pasteError) setPasteError(null);
                }}
                placeholder={t(
                  "scan.manualPlaceholder",
                  "e.g. https://suspicious-domain.xyz/auth?token=... or WIFI:S:Office;T:WPA;P:secret;; or 5012345678900",
                )}
                className="w-full rounded-2xl border border-input bg-background/80 p-3.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y leading-relaxed"
                aria-invalid={!!pasteError}
                aria-describedby={pasteError ? "paste-error-msg" : undefined}
              />

              {pasteError && (
                <p
                  id="paste-error-msg"
                  className="text-xs text-destructive flex items-center gap-1.5 pl-1 animate-pulse"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{pasteError}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/80">Supports:</span>
                <Badge variant="secondary" className="text-[10px]">URLs</Badge>
                <Badge variant="secondary" className="text-[10px]">Wi-Fi</Badge>
                <Badge variant="secondary" className="text-[10px]">vCard</Badge>
                <Badge variant="secondary" className="text-[10px]">Crypto</Badge>
                <Badge variant="secondary" className="text-[10px]">GS1 Digits</Badge>
                <Badge variant="secondary" className="text-[10px]">Raw Text</Badge>
              </div>

              <Button
                type="button"
                onClick={handleManualSubmit}
                disabled={isProcessing}
                className="h-10 px-6 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <SearchCheck className="h-4 w-4" />
                    <span>{t("scan.manualSubmit", "Inspect & Investigate")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Multiple Codes Selection Dialog */}
      {multipleCodes && multipleCodes.length > 0 && (
        <Dialog open={true} onOpenChange={() => setMultipleCodes(null)}>
          <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span>{t("scan.multipleCodesFound", "Multiple Codes Detected")}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {t(
                  "scan.multipleCodesSubtitle",
                  "Select which code artifact you want to investigate:",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2 max-h-60 overflow-y-auto pr-1">
              {multipleCodes.map((code, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setMultipleCodes(null);
                    handleResult(code.content, code.format);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary hover:border-primary/40 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {code.format}
                    </Badge>
                    <p className="text-xs font-mono text-foreground truncate">
                      {code.content}
                    </p>
                  </div>
                  <CornerDownLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 5. Inspection Result Preview Drawer / Modal */}
      <ResultSheet
        scan={result}
        onClose={() => setResult(null)}
        onInvestigate={() =>
          result?.investigationId && openInvestigation(result.investigationId)
        }
      />

      {/* 6. Permission Guide Dialog */}
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
