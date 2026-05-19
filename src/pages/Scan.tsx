import { useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, ImageUp, Keyboard, X, Minus, Plus } from "lucide-react";
import { getScannerService } from "@/lib/scanner-service";
import { parseScanContent } from "@/lib/scan/parser";
import { db, pruneFreeHistory } from "@/lib/db";
import type { ScanRecord } from "@/lib/scan/types";
import { ResultSheet } from "@/components/ResultSheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { scanFeedback } from "@/lib/feedback";
import { toast } from "sonner";

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export default function ScanScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastResultRef = useRef<{ content: string; at: number } | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [errorType, setErrorType] = useState<string | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  const handleResult = async (content: string, format: ScanRecord["format"]) => {
    // de-dupe within 2.5s
    const now = Date.now();
    if (lastResultRef.current && lastResultRef.current.content === content && now - lastResultRef.current.at < 2500) {
      return;
    }
    lastResultRef.current = { content, at: now };

    const parsed = parseScanContent(content, format);
    const record: ScanRecord = {
      id: newId(),
      content,
      format,
      type: parsed.type,
      parsed: parsed.data,
      scannedAt: now,
    };
    scanFeedback();
    await db.scans.put(record);
    pruneFreeHistory().catch(() => undefined);
    setResult(record);
  };

  useEffect(() => {
    const svc = getScannerService();
    let mounted = true;

    (async () => {
      try {
        if (!videoRef.current) return;
        await svc.start(videoRef.current, ({ content, format }) => {
          if (!mounted) return;
          handleResult(content, format);
        });
        setPermission("granted");
        setErrorType(null);
        setTimeout(() => {
          if (!mounted) return;
          setTorchAvail(svc.isTorchAvailable());
          setZoomCaps(svc.getZoomCapabilities());
        }, 800);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Scanner startup error:", e);
        
        if (msg.includes("UNSECURE_CONTEXT")) setErrorType("UNSECURE");
        else if (msg.includes("PERMISSION_DENIED")) setErrorType("DENIED");
        else if (msg.includes("NO_MEDIA_DEVICES")) setErrorType("NOT_SUPPORTED");
        else setErrorType("FAILED");

        setPermission("denied");
        setError(msg);
      }
    })();

    const onVisibility = async () => {
      if (document.hidden) {
        await svc.stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      svc.stop();
    };
  }, []);

  const toggleTorch = async () => {
    const next = !torch;
    setTorch(next);
    await getScannerService().setTorch(next);
  };

  const handleZoomChange = async (val: number[]) => {
    const newZoom = val[0];
    setZoom(newZoom);
    await getScannerService().setZoom(newZoom);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      pinchStartDistRef.current = dist;
      pinchStartZoomRef.current = zoom;
    }
  };

  const onTouchMove = async (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null && zoomCaps) {
      // Use requestAnimationFrame for smooth zoom updates
      requestAnimationFrame(async () => {
        if (pinchStartDistRef.current === null) return;
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        const factor = dist / pinchStartDistRef.current;
        const nextZoom = Math.min(
          zoomCaps.max,
          Math.max(zoomCaps.min, pinchStartZoomRef.current * factor)
        );
        setZoom(nextZoom);
        await getScannerService().setZoom(nextZoom);
      });
    }
  };

  const onTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await getScannerService().scanFile(file);
    if (!r) {
      toast.error("No code found in image");
    } else {
      await handleResult(r.content, r.format);
    }
    e.target.value = "";
  };

  const submitManual = async () => {
    if (!manualValue.trim()) return;
    setManualOpen(false);
    await handleResult(manualValue.trim(), "UNKNOWN");
    setManualValue("");
  };

  return (
    <div 
      className="relative h-full w-full overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {errorType && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center text-white">
          <div className="mb-4 rounded-full bg-destructive/20 p-4 text-destructive">
            <X className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-bold">
            {errorType === "DENIED" && "Camera access denied"}
            {errorType === "UNSECURE" && "Secure context required"}
            {errorType === "NOT_SUPPORTED" && "Camera not supported"}
            {errorType === "FAILED" && "Failed to start camera"}
          </h2>
          <p className="mb-6 text-sm text-muted-foreground max-w-xs">
            {errorType === "DENIED" && "Please enable camera access in your browser settings to use the scanner."}
            {errorType === "UNSECURE" && "This feature requires an HTTPS connection or localhost to function."}
            {errorType === "NOT_SUPPORTED" && "Your device or browser doesn't seem to support camera access."}
            {errorType === "FAILED" && (error || "An unknown error occurred while starting the camera.")}
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="rounded-full px-8"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Top bar */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          ScanIQ
        </div>
        {torchAvail && (
          <button
            onClick={toggleTorch}
            className={`pointer-events-auto rounded-full p-2.5 backdrop-blur transition-all duration-300 ${
              torch 
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-110" 
                : "bg-black/40 text-white"
            }`}
            aria-label="Toggle flashlight"
          >
            {torch ? <Flashlight className="h-5 w-5 fill-current" /> : <FlashlightOff className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Zoom Slider */}
      {zoomCaps && (
        <div className="pointer-events-none absolute inset-y-0 right-6 z-10 flex flex-col items-center justify-center gap-4">
          <div className="pointer-events-auto flex h-48 flex-col items-center gap-3 rounded-full bg-black/30 p-2.5 backdrop-blur-md">
            <button 
              onClick={() => handleZoomChange([Math.min(zoomCaps.max, zoom + 0.5)])}
              className="text-white/80 transition hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="h-24 w-6 flex-1 flex justify-center">
              <Slider
                orientation="vertical"
                min={zoomCaps.min}
                max={zoomCaps.max}
                step={zoomCaps.step || 0.1}
                value={[zoom]}
                onValueChange={handleZoomChange}
                className="h-full"
              />
            </div>
            <button 
              onClick={() => handleZoomChange([Math.max(zoomCaps.min, zoom - 0.5)])}
              className="text-white/80 transition hover:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <div className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            {zoom.toFixed(1)}x
          </div>
        </div>
      )}

      {/* Reticle */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div className="scan-reticle relative h-64 w-64 max-w-[78vw]">
          <Corner className="-left-1 -top-1" />
          <Corner className="-right-1 -top-1 rotate-90" />
          <Corner className="-bottom-1 -left-1 -rotate-90" />
          <Corner className="-bottom-1 -right-1 rotate-180" />
          <div className="scan-line absolute inset-x-2 top-0 h-0.5 animate-scan-line rounded-full" />
        </div>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 px-6 text-center">
        <p className="mx-auto inline-block rounded-full bg-black/45 px-4 py-1.5 text-xs text-white/90 backdrop-blur">
          Point your camera at a QR or barcode
        </p>
      </div>

      {/* Bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-3 px-6">
        <button
          onClick={() => fileRef.current?.click()}
          className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
        >
          <ImageUp className="h-4 w-4" /> Image
        </button>
        <button
          onClick={() => setManualOpen(true)}
          className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/15"
        >
          <Keyboard className="h-4 w-4" /> Manual
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
      </div>

      {/* Permission state */}
      {permission === "denied" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 p-6 text-center">
          <div className="max-w-sm space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
              <X className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {errorType === "UNSECURE" ? "Security Block" : 
                 errorType === "DENIED" ? "Permission Denied" :
                 errorType === "NOT_SUPPORTED" ? "Not Supported" : "Camera Error"}
              </h2>
              <div className="text-sm text-muted-foreground space-y-3">
                {errorType === "UNSECURE" && (
                  <p>Camera access requires a secure connection (HTTPS or localhost). Please check your URL.</p>
                )}
                {errorType === "DENIED" && (
                  <>
                    <p>You've blocked camera access. To fix this:</p>
                    <ul className="text-xs text-left list-disc list-inside space-y-1 mx-auto max-w-[240px]">
                      <li>Click the <strong>camera/lock icon</strong> in the address bar</li>
                      <li>Select <strong>"Allow"</strong> or <strong>"Reset Permission"</strong></li>
                      <li>Refresh the page</li>
                    </ul>
                  </>
                )}
                {errorType === "NOT_SUPPORTED" && (
                  <p>Your browser or device doesn't seem to support camera scanning.</p>
                )}
                {errorType === "FAILED" && (
                  <p>We couldn't start the camera. It might be in use by another app or unplugged.</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Button size="lg" className="h-12 rounded-2xl" onClick={() => location.reload()}>
                Try again
              </Button>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  Technical Details
                </p>
                <p className="text-[10px] text-muted-foreground/60 break-all px-4">
                  {error || "Unknown error occurred"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && permission !== "denied" && (
        <div className="absolute inset-x-0 top-20 z-20 mx-auto max-w-xs rounded-xl bg-destructive/90 px-4 py-3 text-center text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <ResultSheet scan={result} onClose={() => setResult(null)} />

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter code manually</DialogTitle>
          </DialogHeader>
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Paste a URL or barcode digits"
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
            autoFocus
          />
          <Button onClick={submitManual}>Process</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Corner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary ${className}`}
      aria-hidden
    />
  );
}
