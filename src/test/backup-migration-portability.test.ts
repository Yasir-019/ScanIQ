import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "@/lib/scan/types";

const mockCases = new Map<string, InvestigationCase>();
const mockScans = new Map<string, ScanRecord>();
const mockInvestigations = new Map<string, InvestigationReport>();

vi.mock("@/lib/db", () => {
  return {
    db: {
      cases: {
        toArray: () => Array.from(mockCases.values()),
        put: (c: InvestigationCase) => {
          mockCases.set(c.id, c);
          return c.id;
        },
        bulkPut: (items: InvestigationCase[]) => {
          items.forEach((c) => mockCases.set(c.id, c));
        },
        clear: () => {
          mockCases.clear();
        },
      },
      scans: {
        toArray: () => Array.from(mockScans.values()),
        put: (s: ScanRecord) => {
          mockScans.set(s.id, s);
          return s.id;
        },
        bulkPut: (items: ScanRecord[]) => {
          items.forEach((s) => mockScans.set(s.id, s));
        },
        clear: () => {
          mockScans.clear();
        },
      },
      investigations: {
        toArray: () => Array.from(mockInvestigations.values()),
        put: (inv: InvestigationReport) => {
          mockInvestigations.set(inv.id, inv);
          return inv.id;
        },
        bulkPut: (items: InvestigationReport[]) => {
          items.forEach((i) => mockInvestigations.set(i.id, i));
        },
        clear: () => {
          mockInvestigations.clear();
        },
      },
    },
  };
});

import { BackupManager, BACKUP_FORMAT_IDENTIFIER, CURRENT_BACKUP_SCHEMA_VERSION } from "@/lib/backup/backup-manager";
import { useSettings } from "@/lib/settings";

describe("ScanIQ Community — Phase 16: Backup, Migration & Data Portability", () => {
  beforeEach(() => {
    mockCases.clear();
    mockScans.clear();
    mockInvestigations.clear();

    useSettings.setState({
      theme: "dark",
      externalLookupsOptedIn: true,
      sourceToggles: { "rdap-domain": true, "dns-over-https": true },
      apiKeys: {
        VIRUSTOTAL_API_KEY: "SUPER_SECRET_KEY_12345",
        SHODAN_API_KEY: "ANOTHER_SECRET_KEY_ABCDE",
      },
    });
  });

  describe("1. Backup Package Creation & Secret Exclusion", () => {
    it("generates a structured backup package containing manifest and local data", async () => {
      const case1: InvestigationCase = {
        id: "case-bkp-1",
        label: "Malware Analysis Dossier",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        latestRiskLevel: "high",
        primaryTarget: "https://evil-sample.xyz",
      };

      const scan1: ScanRecord = {
        id: "scan-bkp-1",
        caseId: "case-bkp-1",
        content: "https://evil-sample.xyz",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      mockCases.set(case1.id, case1);
      mockScans.set(scan1.id, scan1);

      const pkg = await BackupManager.createBackupPackage(true);

      expect(pkg.manifest.format).toBe(BACKUP_FORMAT_IDENTIFIER);
      expect(pkg.manifest.version).toBe(CURRENT_BACKUP_SCHEMA_VERSION);
      expect(pkg.manifest.casesCount).toBe(1);
      expect(pkg.manifest.scansCount).toBe(1);
      expect(pkg.manifest.checksumSha256).toBeDefined();
      expect(pkg.data.cases.length).toBe(1);
      expect(pkg.data.scans.length).toBe(1);
    });

    it("STRICTLY excludes API keys and credentials from exported settings and backup bundle", async () => {
      const pkg = await BackupManager.createBackupPackage(true);
      const stringified = JSON.stringify(pkg);

      // Verify no API keys exist anywhere in the exported package
      expect(stringified).not.toContain("SUPER_SECRET_KEY_12345");
      expect(stringified).not.toContain("ANOTHER_SECRET_KEY_ABCDE");
      expect(pkg.data.settings).toBeDefined();
      expect((pkg.data.settings as unknown as Record<string, unknown>).apiKeys).toBeUndefined();
    });
  });

  describe("2. Backup Validation & Schema Verification", () => {
    it("validates intact backup packages with valid checksums", async () => {
      const pkg = await BackupManager.createBackupPackage(true);
      const jsonStr = JSON.stringify(pkg);

      const validation = await BackupManager.validateBackup(jsonStr);
      expect(validation.isValid).toBe(true);
      expect(validation.manifest?.format).toBe(BACKUP_FORMAT_IDENTIFIER);
      expect(validation.error).toBeUndefined();
    });

    it("detects and adapts legacy backup formats safely", async () => {
      const legacyBackup = {
        cases: [{ id: "case-legacy-1", label: "Legacy Case", createdAt: 1000, updatedAt: 1000, status: "active" }],
        scans: [{ id: "scan-legacy-1", content: "https://legacy.com", format: "QR_CODE", type: "url", scannedAt: 1000 }],
        investigations: [],
      };

      const validation = await BackupManager.validateBackup(JSON.stringify(legacyBackup));
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some((w) => w.includes("Legacy"))).toBe(true);
      expect(validation.data?.cases.length).toBe(1);
    });

    it("rejects malformed or invalid JSON payloads", async () => {
      const corruptedJson = "{ not-valid-json: broken ]";
      const validation = await BackupManager.validateBackup(corruptedJson);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain("Invalid JSON");
    });
  });

  describe("3. Restore and Merge Operations", () => {
    it("merges backup records into existing local database without deleting existing items", async () => {
      const existingCase: InvestigationCase = {
        id: "case-existing",
        label: "Existing Case",
        status: "active",
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockCases.set(existingCase.id, existingCase);

      const backupData = {
        cases: [
          { id: "case-imported-1", label: "Imported Alpha", status: "active" as const, createdAt: 2000, updatedAt: 2000 },
          { id: "case-imported-2", label: "Imported Beta", status: "active" as const, createdAt: 3000, updatedAt: 3000 },
        ],
        scans: [],
        investigations: [],
      };

      const result = await BackupManager.restoreBackup(backupData, { mode: "merge" });
      expect(result.success).toBe(true);
      expect(result.casesImported).toBe(2);
      expect(mockCases.size).toBe(3); // 1 existing + 2 imported
      expect(mockCases.has("case-existing")).toBe(true);
    });

    it("performs complete replace when replace mode is explicitly selected", async () => {
      const existingCase: InvestigationCase = {
        id: "case-old-to-delete",
        label: "Old Case",
        status: "active",
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockCases.set(existingCase.id, existingCase);

      const backupData = {
        cases: [
          { id: "case-fresh-1", label: "Fresh Restored Case", status: "active" as const, createdAt: 4000, updatedAt: 4000 },
        ],
        scans: [],
        investigations: [],
      };

      const result = await BackupManager.restoreBackup(backupData, { mode: "replace" });
      expect(result.success).toBe(true);
      expect(result.casesImported).toBe(1);
      expect(mockCases.size).toBe(1);
      expect(mockCases.has("case-old-to-delete")).toBe(false);
      expect(mockCases.has("case-fresh-1")).toBe(true);
    });
  });
});
