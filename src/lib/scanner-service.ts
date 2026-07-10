import type { ScanFormat } from "./scan/types";

export interface ScannerResult {
  content: string;
  format: ScanFormat;
}

export interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
}

export interface ScannerService {
  start(video: HTMLVideoElement, onResult: (r: ScannerResult) => void): Promise<void>;
  stop(): void;
  setTorch(on: boolean): Promise<void>;
  scanFile(file: File): Promise<ScannerResult | null>;
  isTorchAvailable(): boolean;
  getZoomCapabilities(): ZoomCapabilities | null;
  setZoom(level: number): Promise<void>;
  isActive(): boolean;
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
  private zoomCaps: ZoomCapabilities | null = null;
  private starting = false;
  private active = false;

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
      this.reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });
    }
    return this.reader;
  }

  isActive() {
    return this.active;
  }

  async start(video: HTMLVideoElement, onResult: (r: ScannerResult) => void) {
    // Prevent concurrent starts
    if (this.starting) return;
    this.starting = true;

    // Stop any existing session first
    this.stopInternal();

    try {
      const reader = await this.ensureReader();

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      this.controls = await reader.decodeFromConstraints(constraints, video, (result) => {
        if (result) {
          onResult({
            content: result.getText(),
            format: toFormat(result.getBarcodeFormat ? result.getBarcodeFormat().toString() : undefined),
          });
        }
      });

      this.active = true;

      // Probe torch + zoom after stream settles
      setTimeout(() => {
        const stream = video.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0] || null;
        this.currentTrack = track;
        const caps = track?.getCapabilities?.() as MediaTrackCapabilities & {
          torch?: boolean;
          zoom?: { min: number; max: number; step: number } | number[];
        };
        this.torchAvailable = !!caps?.torch;
        const z = caps?.zoom;
        if (z && typeof z === "object" && "max" in z && z.max > (z.min ?? 1)) {
          this.zoomCaps = {
            min: z.min ?? 1,
            max: z.max,
            step: z.step && z.step > 0 ? z.step : 0.1,
          };
        } else {
          this.zoomCaps = null;
        }
      }, 400);
    } finally {
      this.starting = false;
    }
  }

  private stopInternal() {
    this.active = false;
    try {
      this.controls?.stop();
    } catch { /* ignore */ }
    this.controls = null;
    if (this.currentTrack) {
      try { this.currentTrack.stop(); } catch { /* ignore */ }
      this.currentTrack = null;
    }
    this.torchAvailable = false;
    this.zoomCaps = null;
  }

  stop() {
    this.stopInternal();
  }

  getZoomCapabilities() {
    return this.zoomCaps;
  }

  async setZoom(level: number) {
    if (!this.currentTrack || !this.zoomCaps) return;
    const clamped = Math.max(this.zoomCaps.min, Math.min(this.zoomCaps.max, level));
    try {
      await this.currentTrack.applyConstraints({
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet & { zoom: number }],
      });
    } catch { /* unsupported */ }
  }

  async setTorch(on: boolean) {
    if (!this.currentTrack) return;
    try {
      await this.currentTrack.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    } catch { /* unsupported */ }
  }

  isTorchAvailable() {
    return this.torchAvailable;
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
