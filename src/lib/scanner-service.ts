import type { ScanFormat } from "./scan/types";

export interface ScannerResult {
  content: string;
  format: ScanFormat;
}

export interface ScannerService {
  start(video: HTMLVideoElement, onResult: (r: ScannerResult) => void): Promise<void>;
  stop(): Promise<void>;
  setTorch(on: boolean): Promise<void>;
  setZoom(value: number): Promise<void>;
  scanFile(file: File): Promise<ScannerResult | null>;
  isTorchAvailable(): boolean;
  getZoomCapabilities(): { min: number; max: number; step: number } | null;
}

const formatMap: Record<string, ScanFormat> = {
  QR_CODE: "QR_CODE",
  EAN_13: "EAN_13",
  EAN_8: "EAN_8",
  UPC_A: "UPC_A",
  UPC_E: "UPC_E",
  CODE_128: "CODE_128",
  CODE_39: "CODE_39",
  CODE_93: "CODE_93",
  ITF: "ITF",
  DATA_MATRIX: "DATA_MATRIX",
  PDF_417: "PDF_417",
  AZTEC: "AZTEC",
};

const toFormat = (raw: string | undefined): ScanFormat => (raw && formatMap[raw]) || "UNKNOWN";

class ZxingScannerService implements ScannerService {
  private reader: import("@zxing/browser").BrowserMultiFormatReader | null = null;
  private controls: { stop: () => void } | null = null;
  private currentTrack: MediaStreamTrack | null = null;
  private torchAvailable = false;

  private async ensureReader() {
    if (!this.reader) {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417,
        BarcodeFormat.AZTEC,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      this.reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
    }
    return this.reader;
  }

  async start(video: HTMLVideoElement, onResult: (r: ScannerResult) => void) {
    if (!window.isSecureContext) {
      throw new Error("UNSECURE_CONTEXT: Camera access is restricted to secure origins (HTTPS or localhost).");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("NO_MEDIA_DEVICES: Your browser does not support camera access.");
    }

    // Stop any existing tracks before starting new ones
    await this.stop();

    // 1. Preflight: Explicitly request permission with simple constraints first
    try {
      console.log("Preflight: Requesting camera permission...");
      const preflightStream = await navigator.mediaDevices.getUserMedia({ video: true });
      preflightStream.getTracks().forEach(t => t.stop());
      console.log("Preflight: Permission granted.");
    } catch (e) {
      const err = e as Error;
      console.error("Preflight: Permission failed:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.name === "NotReadableError") {
        throw new Error("PERMISSION_DENIED: User or browser blocked camera access.");
      }
      throw new Error(`PREFLIGHT_FAILED: ${err.message}`);
    }

    const reader = await this.ensureReader();

    // 2. Start actual scanning with ideal constraints
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { 
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
    };

    try {
      console.log("Attempting to start reader with constraints:", constraints);
      this.controls = await reader.decodeFromConstraints(constraints, video, (result) => {
        if (result) {
          onResult({
            content: result.getText(),
            format: toFormat(result.getBarcodeFormat ? result.getBarcodeFormat().toString() : undefined),
          });
        }
      });
    } catch (e) {
      const err = e as Error;
      console.warn("Advanced constraints failed, trying basic video...", err);
      try {
        this.controls = await reader.decodeFromConstraints({ video: true }, video, (result) => {
          if (result) {
            onResult({
              content: result.getText(),
              format: toFormat(result.getBarcodeFormat ? result.getBarcodeFormat().toString() : undefined),
            });
          }
        });
      } catch (e2) {
        const err2 = e2 as Error;
        console.error("Fallback camera start failed:", err2);
        throw new Error(`CAMERA_START_FAILED: ${err2.message || "Unknown error"}`);
      }
    }

    // Wait for stream to settle, then probe capabilities
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const stream = video.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0] || null;
    this.currentTrack = track;
    
    if (track) {
      console.log("Camera track active:", track.label);
      const caps = track.getCapabilities() as { torch?: boolean; zoom?: { min: number; max: number; step: number } };
      this.torchAvailable = !!caps?.torch;
    }
  }

  async stop() {
    try {
      this.controls?.stop();
    } catch {
      /* ignore */
    }
    this.controls = null;
    if (this.currentTrack) {
      try {
        this.currentTrack.stop();
      } catch {
        /* ignore */
      }
      this.currentTrack = null;
    }
    this.torchAvailable = false;
  }

  async setTorch(on: boolean) {
    if (!this.currentTrack) return;
    try {
      await this.currentTrack.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    } catch {
      /* unsupported */
    }
  }

  async setZoom(value: number) {
    if (!this.currentTrack) return;
    try {
      await this.currentTrack.applyConstraints({ advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet] });
    } catch {
      /* unsupported */
    }
  }

  isTorchAvailable() {
    return this.torchAvailable;
  }

  getZoomCapabilities() {
    if (!this.currentTrack) return null;
    const caps = this.currentTrack.getCapabilities() as { zoom?: { min: number; max: number; step: number } };
    if (caps.zoom) {
      return {
        min: caps.zoom.min,
        max: caps.zoom.max,
        step: caps.zoom.step,
      };
    }
    return null;
  }

  async scanFile(file: File): Promise<ScannerResult | null> {
    const reader = await this.ensureReader();
    const url = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(url);
      return {
        content: result.getText(),
        format: toFormat(result.getBarcodeFormat ? result.getBarcodeFormat().toString() : undefined),
      };
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

let _instance: ScannerService | null = null;
export function getScannerService(): ScannerService {
  if (!_instance) _instance = new ZxingScannerService();
  return _instance;
}
