import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { computeSha256Hex } from "@/lib/investigation/evidence-integrity";
import { APP_VERSION } from "@/lib/app-meta";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "@/lib/scan/types";

export const BACKUP_FORMAT_IDENTIFIER = "scaniq-backup-bundle" as const;
export const CURRENT_BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB security limit

export interface ScanIQBackupManifest {
  format: typeof BACKUP_FORMAT_IDENTIFIER;
  version: number;
  appVersion: string;
  exportTimestamp: string;
  casesCount: number;
  scansCount: number;
  investigationsCount: number;
  checksumSha256?: string;
}

export interface NonSecretSettings {
  theme?: "dark" | "light";
  externalLookupsOptedIn?: boolean;
  sourceToggles?: Record<string, boolean>;
  autoStartCamera?: boolean;
  confirmBeforeOpenDestinations?: boolean;
  caseRetentionDays?: number;
  telemetryEnabled?: boolean;
}

export interface ScanIQBackupPackage {
  manifest: ScanIQBackupManifest;
  data: {
    cases: InvestigationCase[];
    scans: ScanRecord[];
    investigations: InvestigationReport[];
    settings?: NonSecretSettings;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  manifest?: ScanIQBackupManifest;
  data?: ScanIQBackupPackage["data"];
  warnings: string[];
}

export interface RestoreOptions {
  mode: "merge" | "replace";
  includeSettings?: boolean;
}

export interface RestoreResult {
  success: boolean;
  casesImported: number;
  scansImported: number;
  investigationsImported: number;
  settingsRestored: boolean;
  error?: string;
  timestamp: number;
}

export class BackupManager {
  /**
   * Generates a sanitized, non-secret backup bundle containing all local
   * Cases, Scans, Investigations, and non-sensitive user settings.
   */
  public static async createBackupPackage(includeSettings = true): Promise<ScanIQBackupPackage> {
    const [cases, scans, investigations] = await Promise.all([
      db.cases.toArray(),
      db.scans.toArray(),
      db.investigations.toArray(),
    ]);

    let settingsPayload: NonSecretSettings | undefined;

    if (includeSettings) {
      const state = useSettings.getState();
      // Explicitly pick ONLY non-secret configuration properties.
      // API Keys (state.apiKeys) are NEVER exported in ordinary backups.
      settingsPayload = {
        theme: state.theme,
        externalLookupsOptedIn: state.externalLookupsOptedIn,
        sourceToggles: state.sourceToggles ? { ...state.sourceToggles } : {},
        autoStartCamera: state.autoStartCamera,
        confirmBeforeOpenDestinations: state.confirmBeforeOpenDestinations,
        caseRetentionDays: state.caseRetentionDays,
        telemetryEnabled: state.telemetryEnabled,
      };
    }

    const dataPayload = {
      cases,
      scans,
      investigations,
      settings: settingsPayload,
    };

    // Calculate SHA-256 integrity checksum of canonical data payload
    const canonicalDataStr = JSON.stringify(dataPayload);
    const checksumSha256 = await computeSha256Hex(canonicalDataStr);

    const manifest: ScanIQBackupManifest = {
      format: BACKUP_FORMAT_IDENTIFIER,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportTimestamp: new Date().toISOString(),
      casesCount: cases.length,
      scansCount: scans.length,
      investigationsCount: investigations.length,
      checksumSha256,
    };

    return {
      manifest,
      data: dataPayload,
    };
  }

  /**
   * Downloads the backup package as a JSON file in the user's browser.
   */
  public static async downloadBackupFile(filename?: string): Promise<string> {
    const pkg = await this.createBackupPackage(true);
    const jsonStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const dateSlug = new Date().toISOString().slice(0, 10);
    const finalFilename = filename || `scaniq-backup-${dateSlug}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return pkg.manifest.checksumSha256 || "";
  }

  /**
   * Validates raw JSON string or parsed object before any restore/import operation.
   * Performs schema, size, version, and integrity validation.
   */
  public static async validateBackup(input: string | unknown): Promise<BackupValidationResult> {
    const warnings: string[] = [];

    let parsed: unknown;
    if (typeof input === "string") {
      if (input.length > MAX_BACKUP_SIZE_BYTES) {
        return {
          isValid: false,
          error: `Backup file exceeds maximum allowed size (${Math.round(MAX_BACKUP_SIZE_BYTES / (1024 * 1024))}MB).`,
          warnings,
        };
      }
      try {
        parsed = JSON.parse(input);
      } catch {
        return {
          isValid: false,
          error: "Invalid JSON format: Unable to parse backup content.",
          warnings,
        };
      }
    } else {
      parsed = input;
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        isValid: false,
        error: "Malformed backup object structure.",
        warnings,
      };
    }

    const obj = parsed as Record<string, unknown>;

    // 1. Format and Manifest check
    const manifest = obj.manifest as ScanIQBackupManifest | undefined;
    if (!manifest || manifest.format !== BACKUP_FORMAT_IDENTIFIER) {
      // Check if legacy raw array or case export
      if (Array.isArray(obj.cases) || Array.isArray(obj.scans)) {
        warnings.push("Legacy backup format detected. Data will be adapted during import.");
        const legacyData = {
          cases: Array.isArray(obj.cases) ? (obj.cases as InvestigationCase[]) : [],
          scans: Array.isArray(obj.scans) ? (obj.scans as ScanRecord[]) : [],
          investigations: Array.isArray(obj.investigations) ? (obj.investigations as InvestigationReport[]) : [],
        };
        return {
          isValid: true,
          manifest: {
            format: BACKUP_FORMAT_IDENTIFIER,
            version: 0,
            appVersion: "legacy",
            exportTimestamp: new Date().toISOString(),
            casesCount: legacyData.cases.length,
            scansCount: legacyData.scans.length,
            investigationsCount: legacyData.investigations.length,
          },
          data: legacyData,
          warnings,
        };
      }

      return {
        isValid: false,
        error: "Unrecognized backup bundle format. Please provide a valid ScanIQ backup package.",
        warnings,
      };
    }

    // 2. Version check
    if (manifest.version > CURRENT_BACKUP_SCHEMA_VERSION) {
      warnings.push(`Backup is from a newer version of ScanIQ (v${manifest.version}). Newer fields may be ignored.`);
    }

    // 3. Data Structure check
    const data = obj.data as ScanIQBackupPackage["data"] | undefined;
    if (!data || typeof data !== "object") {
      return {
        isValid: false,
        error: "Backup package contains no valid 'data' payload.",
        warnings,
      };
    }

    if (!Array.isArray(data.cases) || !Array.isArray(data.scans) || !Array.isArray(data.investigations)) {
      return {
        isValid: false,
        error: "Invalid data payload: 'cases', 'scans', and 'investigations' must be arrays.",
        warnings,
      };
    }

    // 4. SHA-256 Checksum check (if present)
    if (manifest.checksumSha256) {
      const canonicalDataStr = JSON.stringify(data);
      const computedHash = await computeSha256Hex(canonicalDataStr);
      if (computedHash.toLowerCase() !== manifest.checksumSha256.toLowerCase()) {
        warnings.push("Warning: SHA-256 data checksum mismatch. Some records may have been altered or corrupted.");
      }
    }

    return {
      isValid: true,
      manifest,
      data,
      warnings,
    };
  }

  /**
   * Safely restores or merges validated data into IndexedDB and settings.
   */
  public static async restoreBackup(
    validatedData: ScanIQBackupPackage["data"],
    options: RestoreOptions = { mode: "merge", includeSettings: false }
  ): Promise<RestoreResult> {
    const timestamp = Date.now();

    try {
      if (options.mode === "replace") {
        await Promise.all([db.cases.clear(), db.scans.clear(), db.investigations.clear()]);
      }

      // Filter and sanitize items before DB insertion
      const casesToPut = (validatedData.cases || []).filter((c) => c && typeof c.id === "string");
      const scansToPut = (validatedData.scans || []).filter((s) => s && typeof s.id === "string");
      const invsToPut = (validatedData.investigations || []).filter((i) => i && typeof i.id === "string");

      if (casesToPut.length > 0) {
        await db.cases.bulkPut(casesToPut);
      }
      if (scansToPut.length > 0) {
        await db.scans.bulkPut(scansToPut);
      }
      if (invsToPut.length > 0) {
        await db.investigations.bulkPut(invsToPut);
      }

      let settingsRestored = false;
      if (options.includeSettings && validatedData.settings) {
        const s = validatedData.settings;
        useSettings.setState({
          ...(s.theme && { theme: s.theme }),
          ...(typeof s.externalLookupsOptedIn === "boolean" && { externalLookupsOptedIn: s.externalLookupsOptedIn }),
          ...(s.sourceToggles && { sourceToggles: { ...s.sourceToggles } }),
          ...(typeof s.autoStartCamera === "boolean" && { autoStartCamera: s.autoStartCamera }),
          ...(typeof s.confirmBeforeOpenDestinations === "boolean" && { confirmBeforeOpenDestinations: s.confirmBeforeOpenDestinations }),
          ...(typeof s.caseRetentionDays === "number" && { caseRetentionDays: s.caseRetentionDays }),
          ...(typeof s.telemetryEnabled === "boolean" && { telemetryEnabled: s.telemetryEnabled }),
        });
        settingsRestored = true;
      }

      return {
        success: true,
        casesImported: casesToPut.length,
        scansImported: scansToPut.length,
        investigationsImported: invsToPut.length,
        settingsRestored,
        timestamp,
      };
    } catch (err) {
      return {
        success: false,
        casesImported: 0,
        scansImported: 0,
        investigationsImported: 0,
        settingsRestored: false,
        error: err instanceof Error ? err.message : "Failed to write data to local database.",
        timestamp,
      };
    }
  }
}
