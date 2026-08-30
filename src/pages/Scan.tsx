import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Flashlight,
  FlashlightOff,
  ImageUp,
  Keyboard,
  Camera,
  CameraOff,
  Settings,
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
  Play,
  Trash2,
} from "lucide-react";
import {
  getScannerService,
  type ZoomCapabilities,
  type ScannerResult,
} from "@/lib/scanner-service";
import { parseScanContent } from "@/lib/scan/parser";
import { db, saveNewCaseForScan, pruneCases } from "@/lib/db";
import type { InvestigationCase, ScanRecord, InvestigationReport } from "@/lib/scan/types";
import type { InvestigationFinding } from "@/lib/investigation/types";
import { investigationEngine } from "@/lib/investigation";
import { ResultSheet } from "@/components/ResultSheet";
import { ScanAnalysisResult } from "@/components/investigation/ScanAnalysisResult";
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

type ScanMode = "image" | "camera" | "paste";

type CameraState =
  | "ready"
  | "loading"
  | "active"
  | "stopped"
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
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const tRef = useRef(t);
  tRef.current = t;

  // 1. Core mode state — Default is IMAGE mode (privacy-first, no camera permission)
  const [scanMode, setScanMode] = useState<ScanMode>("image");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    scan: ScanRecord;
    report: InvestigationReport;
    findings: InvestigationFinding[];
    caseId?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 2. Camera mode state — Default state is "ready" (explicit user action required to start)
  const [cameraState, setCameraState] = useState<CameraState>("ready");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCapabilities | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [, setRetryCount] = useState(0);

  // 3. Image mode state
  const [isDragging, setIsDragging] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageFileMeta, setImageFileMeta] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [multipleCodes, setMultipleCodes] = useState<ScannerResult[] | null>(null);

  // 4. Paste / Enter mode state
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const {
    zoom,
    applyZoom,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = usePinchToZoom(zoomCaps);

  // Cleanup object URLs when preview changes or unmounts
  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupPreviewUrl();
    };
  }, [cleanupPreviewUrl]);

  // Navigate to full investigation dossier
  const openInvestigation = useCallback(
    (investigationId: string) => {
      navigate(`/investigation/${investigationId}`);
    },
    [navigate],
  );

  // Unified Downstream Pipeline: Decode -> Local Inspection -> Case Creation -> Threat Analysis
  const handleResult = useCallback(
    async (content: string, format: ScanRecord["format"] = "QR_CODE") => {
      const now = Date.now();
      if (
        lastResultRef.current &&
        lastResultRef.current.content === content &&
        now - lastResultRef.current.at < 2500
      ) {
        return;
      }
      lastResultRef.current = { content, at: now };

      // Pause camera if running
      getScannerService().stop();
      if (scanMode === "camera") {
        setCameraState("stopped");
      }

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
        const { report: inv, findings } = await investigationEngine.runInvestigation(record, c.id);
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
        setAnalysisResult({
          scan: record,
          report: inv,
          findings,
          caseId: c.id,
        });

        if (safetyStatus === "malicious" || safetyStatus === "suspicious") {
          toast.warning(
            tRef.current(
              "scan.threatDetected",
              "Inspection flagged indicators — review investigation dossier",
            ),
          );
        } else {
          toast.success(
            tRef.current(
              "scan.investigationReady",
              "Artifact inspected and case dossier initialized",
            ),
          );
        }
      } catch (err) {
        console.error("[ScanScreen] Processing error:", err);
        toast.error(
          tRef.current(
            "scan.analysisFailed",
            "Failed to complete investigation pipeline",
          ),
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [scanMode],
  );

  // Explicit Camera Start Handler
  const startCamera = useCallback(async () => {
    if (!mountedRef.current) return;
    const svc = getScannerService();
    svc.stop();
    setCameraState("loading");
    setErrorDetail(null);

    try {
      // Check permissions if supported
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const permStatus = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (permStatus.state === "denied") {
            setCameraState("denied-permanent");
            return;
          }
        }
      } catch {
        /* permissions API query not supported in some browsers */
      }

      // Check device availability
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasCamera = devices.some((d) => d.kind === "videoinput");
          if (!hasCamera && devices.length > 0) {
            setCameraState("unavailable");
            return;
          }
        }
      } catch {
        /* enumerateDevices not supported */
      }

      if (!videoRef.current || !mountedRef.current) {
        setCameraState("error");
        setErrorDetail("Video preview element not ready");
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
      }, 500);
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
            "Camera hardware is currently in use by another application.",
          ),
        );
      } else {
        setCameraState("error");
        setErrorDetail(msg);
      }
    }
  }, [handleResult, applyZoom]);

  // Explicit Camera Stop Handler
  const stopCamera = useCallback(() => {
    getScannerService().stop();
    setTorch(false);
    setTorchAvail(false);
    setZoomCaps(null);
    setCameraState("stopped");
  }, []);

  // Mode switching & Component unmount lifecycle
  useEffect(() => {
    mountedRef.current = true;

    // When switching away from camera, ensure tracks are stopped
    if (scanMode !== "camera") {
      getScannerService().stop();
      setCameraState("ready");
    }

    const onVisibility = () => {
      if (!mountedRef.current) return;
      if (document.hidden) {
        getScannerService().stop();
        if (scanMode === "camera" && cameraState === "active") {
          setCameraState("ready");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      getScannerService().stop();
    };
  }, [scanMode, cameraState]);

  const retryCamera = () => {
    setRetryCount((c) => c + 1);
    startCamera();
  };

  const toggleTorch = async () => {
    try {
      const next = !torch;
      setTorch(next);
      await getScannerService().setTorch(next);
    } catch {
      toast.error(t("errors.unexpected", "Failed to toggle flashlight"));
    }
  };

  // Image File Processing
  const processImageFile = useCallback(
    async (file: File) => {
      if (!file || !file.type.startsWith("image/")) {
        setImageError(
          t(
            "scan.imageInvalidType",
            "Please select a valid image file (PNG, JPEG, WebP, GIF, SVG, BMP).",
          ),
        );
        toast.error(t("scan.imageInvalidType", "Invalid file format"));
        return;
      }

      cleanupPreviewUrl();
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setImagePreviewUrl(previewUrl);
      setImageFileMeta({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setIsDecodingImage(true);
      setImageError(null);

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
          toast.success(
            t("scan.imageDecodeSuccess", "Barcode detected and decoded"),
          );
          await handleResult(res.content, res.format);
        }
      } catch (err) {
        console.error("[ScanScreen] Image decode error:", err);
        setImageError(
          t(
            "scan.imageScanFailed",
            "Failed to parse barcode from image file.",
          ),
        );
        toast.error(
          t("scan.imageScanFailed", "Failed to parse barcode from image"),
        );
      } finally {
        setIsDecodingImage(false);
      }
    },
    [t, handleResult, cleanupPreviewUrl],
  );

  const handleClearImage = useCallback(() => {
    cleanupPreviewUrl();
    setImagePreviewUrl(null);
    setImageFileMeta(null);
    setImageError(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }, [cleanupPreviewUrl]);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processImageFile(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processImageFile(file);
    }
  };

  // Clipboard Paste Support (Image & Text)
  const handlePasteScreenshot = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted-screenshot.png", {
            type: imageType,
          });
          await processImageFile(file);
          return;
        }
      }
      toast.info(
        t(
          "scan.clipboardNoImage",
          "No image found in clipboard. Please copy an image or take a screenshot first.",
        ),
      );
    } catch {
      toast.error(
        t(
          "scan.clipboardPermissionDenied",
          "Clipboard permission denied. Please use the file picker or drag-and-drop.",
        ),
      );
    }
  };

  // Global window paste listener for quick screenshot drops
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          setScanMode("image");
          await processImageFile(file);
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [processImageFile]);

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
      toast.error(
        "Clipboard permission denied. Please paste manually into the field.",
      );
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
      {analysisResult ? (
        <ScanAnalysisResult
          scan={analysisResult.scan}
          report={analysisResult.report}
          findings={analysisResult.findings}
          caseId={analysisResult.caseId}
          onScanAnother={() => {
            setAnalysisResult(null);
            setResult(null);
            handleClearImage();
          }}
        />
      ) : (
        <>
          {/* 1. Policy & Privacy Banner */}
          <div className="p-3.5 sm:p-4 rounded-3xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5 sm:mt-0">
            <Radio className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-foreground">
                QR & Barcode OSINT Workspace
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

        {/* Client-Side Decode Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/50 text-[11px] text-muted-foreground shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Client-Side Decode</span>
        </div>
      </div>

      {/* 2. Accessible Scan Mode Selector — IMAGE is Default */}
      <div
        role="tablist"
        aria-label={t("scan.modeSelectorAria", "Scan Input Mode")}
        className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border border-border bg-secondary/60 backdrop-blur-sm"
      >
        {/* TAB 1: Image (DEFAULT) */}
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
          <span className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
            Default
          </span>
        </button>

        {/* TAB 2: Camera (Explicit Action Required) */}
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

        {/* TAB 3: Paste / Enter */}
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

      {/* ========================================================================= */}
      {/* MODE 1: Image Upload & Drag-and-Drop (PRIMARY DEFAULT WORKFLOW)           */}
      {/* ========================================================================= */}
      {scanMode === "image" && (
        <div
          role="tabpanel"
          id="panel-image"
          aria-labelledby="tab-image"
          className="space-y-4 animate-fade-in"
        >
          {/* Dropzone Card */}
          <div
            ref={dropzoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative w-full min-h-[360px] sm:min-h-[400px] rounded-3xl border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all bg-card/60 backdrop-blur-sm cursor-pointer group",
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
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30 shadow-md">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {t("scan.imageDecoding", "Decoding barcode locally…")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {imageFileMeta?.name
                    ? `Inspecting ${imageFileMeta.name} in client-side memory`
                    : "Analyzing optical symbology in client memory without external network calls."}
                </p>
              </div>
            ) : imagePreviewUrl ? (
              /* Selected Image Preview State */
              <div
                className="space-y-4 flex flex-col items-center max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative rounded-2xl overflow-hidden border border-border bg-secondary/30 shadow-md max-h-56 max-w-xs group/img">
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded QR or Barcode Preview"
                    className="w-full h-auto max-h-56 object-contain rounded-2xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={() => fileRef.current?.click()}
                    >
                      <FileUp className="h-3.5 w-3.5 mr-1" />
                      <span>Change</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={handleClearImage}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span>Remove</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-foreground truncate max-w-xs">
                      {imageFileMeta?.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {imageFileMeta?.size
                        ? `${(imageFileMeta.size / 1024).toFixed(1)} KB`
                        : "Image"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click "Select another image" or drop a new file to inspect.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 rounded-xl text-xs font-semibold border-border hover:bg-secondary"
                    onClick={() => fileRef.current?.click()}
                  >
                    <FileUp className="h-3.5 w-3.5 mr-1.5" />
                    <span>Select Another Image</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleClearImage}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    <span>Clear</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty / Initial State */
              <div className="space-y-4 flex flex-col items-center max-w-md">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-foreground border border-border group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm",
                    isDragging &&
                      "scale-110 bg-primary/20 text-primary border-primary",
                  )}
                >
                  <UploadCloud className="h-8 w-8" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
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

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-10 px-5 rounded-xl text-xs font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
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
                    <span>
                      {t("scan.imagePasteAction", "Paste from Clipboard")}
                    </span>
                  </Button>
                </div>

                <div className="pt-3 border-t border-border/60 w-full flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    PNG, JPEG, WebP, GIF, SVG, BMP
                  </Badge>
                  <span>·</span>
                  <span>14 barcode symbologies supported</span>
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

      {/* ========================================================================= */}
      {/* MODE 2: Camera Viewfinder (EXPLICIT USER-INITIATED OPTICAL SCANNER)        */}
      {/* ========================================================================= */}
      {scanMode === "camera" && (
        <div
          role="tabpanel"
          id="panel-camera"
          aria-labelledby="tab-camera"
          className="space-y-4 animate-fade-in"
        >
          {cameraState === "ready" || cameraState === "stopped" ? (
            /* Explicit Camera Launch Panel — No automatic stream on load */
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-card text-center flex flex-col items-center justify-center space-y-4 min-h-[360px]">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30 shadow-sm">
                <Camera className="h-8 w-8" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Live Optical QR & Barcode Scanner
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scan physical QR codes and 1D/2D barcodes using your device camera. Video frames are decoded locally in real-time and are never uploaded.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Button
                  onClick={startCamera}
                  size="default"
                  className="h-11 px-6 rounded-2xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Camera</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setScanMode("image")}
                  size="default"
                  className="h-11 px-5 rounded-2xl text-xs font-medium border-border hover:bg-secondary"
                >
                  <ImageUp className="h-4 w-4 mr-1.5" />
                  <span>Or Upload Image Instead</span>
                </Button>
              </div>

              <div className="pt-4 border-t border-border/40 w-full max-w-sm flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Camera stream runs strictly in local memory</span>
              </div>
            </div>
          ) : (
            /* Live Camera Viewfinder Surface */
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

              {/* Initializing / Loading Stream Spinner */}
              {cameraState === "loading" && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 text-center p-6">
                    <Camera className="h-10 w-10 animate-pulse text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      Initializing Camera Sensor…
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Requesting camera access for real-time local decoding.
                    </p>
                  </div>
                </div>
              )}

              {/* Intelligence Synthesis Overlay */}
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

              {/* Top Viewfinder Bar with Controls */}
              {cameraState === "active" && (
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pointer-events-none">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur border border-white/10">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Sensor Active</span>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-2">
                    {torchAvail && (
                      <button
                        onClick={toggleTorch}
                        aria-pressed={torch}
                        aria-label={
                          torch
                            ? t("scan.torchOff", "Turn off flashlight")
                            : t("scan.torchOn", "Turn on flashlight")
                        }
                        className={`rounded-full p-2.5 backdrop-blur transition border ${
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

                    <Button
                      onClick={stopCamera}
                      variant="destructive"
                      size="sm"
                      className="h-8 px-3 rounded-full text-xs font-medium gap-1.5 shadow-md"
                    >
                      <CameraOff className="h-3.5 w-3.5" />
                      <span>Stop Camera</span>
                    </Button>
                  </div>
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
                    onClick={() => {
                      stopCamera();
                      setScanMode("image");
                    }}
                    className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3.5 text-xs font-medium text-white backdrop-blur border border-white/15 hover:bg-black/90 transition"
                  >
                    <ImageUp className="h-3.5 w-3.5" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    onClick={() => {
                      stopCamera();
                      setScanMode("paste");
                    }}
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
                onFileSelect={() => {
                  stopCamera();
                  setScanMode("image");
                }}
                onManualInput={() => {
                  stopCamera();
                  setScanMode("paste");
                }}
                onOpenSettings={() => setShowPermissionGuide(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: Paste / Enter Directly                                            */}
      {/* ========================================================================= */}
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
                className="h-10 px-6 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
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
      </>
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
                <li>Click "Retry Camera Access" below.</li>
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
