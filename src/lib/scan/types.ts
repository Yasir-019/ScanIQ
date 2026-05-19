export type ScanFormat =
  | "QR_CODE"
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "CODE_39"
  | "CODE_93"
  | "ITF"
  | "DATA_MATRIX"
  | "PDF_417"
  | "AZTEC"
  | "UNKNOWN";

export type ScanContentType =
  | "url"
  | "wifi"
  | "vcard"
  | "email"
  | "sms"
  | "phone"
  | "geo"
  | "product"
  | "text";

export type SafetyStatus = "unchecked" | "safe" | "suspicious" | "malicious";

export interface ScanRecord {
  id: string;
  content: string;
  format: ScanFormat;
  type: ScanContentType;
  parsed?: Record<string, unknown>;
  safetyStatus?: SafetyStatus;
  favorite?: boolean;
  scannedAt: number; // epoch ms
}

export interface GeneratedCode {
  id: string;
  type: ScanContentType;
  payload: string;
  label?: string;
  style?: { fg?: string; bg?: string };
  createdAt: number;
}
