import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  FolderArchive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { db } from "@/lib/db";
import {
  BackupManager,
  type BackupValidationResult,
  type RestoreOptions,
} from "@/lib/backup/backup-manager";
import { cn } from "@/lib/utils";

export function DataStorageManager() {
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const scans = useLiveQuery(() => db.scans.toArray(), []);
  const investigations = useLiveQuery(() => db.investigations.toArray(), []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreOptions["mode"]>("merge");
  const [includeSettings, setIncludeSettings] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const totalCases = cases?.length ?? 0;
  const totalScans = scans?.length ?? 0;
  const totalInvs = investigations?.length ?? 0;

  // Handle Export / Backup Download
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const checksum = await BackupManager.downloadBackupFile();
      toast.success("Backup package downloaded successfully.", {
        description: checksum ? `SHA-256: ${checksum.slice(0, 16)}…` : undefined,
      });
    } catch {
      toast.error("Failed to generate backup bundle.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file select for Import / Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const validation = await BackupManager.validateBackup(text);
      setValidationResult(validation);
      setIsRestoreModalOpen(true);
    } catch {
      toast.error("Could not read backup file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!validationResult || !validationResult.isValid || !validationResult.data) return;

    setIsRestoring(true);
    try {
      const result = await BackupManager.restoreBackup(validationResult.data, {
        mode: restoreMode,
        includeSettings,
      });

      if (result.success) {
        toast.success(
          restoreMode === "replace"
            ? "Full restore completed successfully."
            : "Data successfully merged into local database.",
          {
            description: `Imported ${result.casesImported} cases, ${result.scansImported} scans, ${result.investigationsImported} reports.`,
          }
        );
        setIsRestoreModalOpen(false);
        setValidationResult(null);
      } else {
        toast.error(`Restore failed: ${result.error || "Existing data preserved."}`);
      }
    } catch {
      toast.error("Restore encountered an unexpected error. Existing data preserved.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. Storage Overview Metrics */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl border border-border bg-card">
        <div className="text-center p-2 rounded-xl bg-secondary/30">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Cases</span>
          <p className="text-base font-extrabold text-foreground font-mono mt-0.5">{totalCases}</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-secondary/30">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Scans</span>
          <p className="text-base font-extrabold text-foreground font-mono mt-0.5">{totalScans}</p>
        </div>
        <div className="text-center p-2 rounded-xl bg-secondary/30">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Reports</span>
          <p className="text-base font-extrabold text-foreground font-mono mt-0.5">{totalInvs}</p>
        </div>
      </div>

      {/* 2. Data Portability Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Export & Backup</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Generate a versioned JSON backup containing all investigation cases, indicators, evidence, and reports. API keys are excluded for security.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="w-full h-8 text-xs rounded-xl gap-1.5 font-semibold"
          >
            {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>{isExporting ? "Packaging…" : "Create & Export Backup"}</span>
          </Button>
        </div>

        <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>Import & Restore</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Restore or merge a previously exported ScanIQ backup bundle. Data is validated and integrity-checked prior to writing.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-8 text-xs rounded-xl gap-1.5 border-border hover:bg-secondary"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Select Backup File</span>
          </Button>
        </div>
      </div>

      {/* 3. Restore & Validation Preview Modal */}
      <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Validate & Restore Backup
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Review backup package details and choose restore options.
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-3 text-xs">
              {validationResult.isValid && validationResult.manifest ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Valid ScanIQ Backup Package</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono space-y-0.5">
                      <p>Export Date: {new Date(validationResult.manifest.exportTimestamp).toLocaleString()}</p>
                      <p>Format: {validationResult.manifest.format} (v{validationResult.manifest.version})</p>
                    </div>
                  </div>

                  {/* Contents Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Cases</span>
                      <p className="font-bold text-foreground font-mono">{validationResult.manifest.casesCount}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Scans</span>
                      <p className="font-bold text-foreground font-mono">{validationResult.manifest.scansCount}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-secondary/40 border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Reports</span>
                      <p className="font-bold text-foreground font-mono">{validationResult.manifest.investigationsCount}</p>
                    </div>
                  </div>

                  {/* Restore Mode Selector */}
                  <div className="space-y-1.5 pt-1">
                    <span className="font-bold text-foreground text-[11px]">Restore Strategy</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRestoreMode("merge")}
                        className={cn(
                          "p-2.5 rounded-xl border text-left space-y-0.5 transition-all text-xs",
                          restoreMode === "merge"
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-secondary/40"
                        )}
                      >
                        <p className="font-bold text-foreground">Merge Data</p>
                        <p className="text-[10px] text-muted-foreground">Keep existing cases and add backup items.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode("replace")}
                        className={cn(
                          "p-2.5 rounded-xl border text-left space-y-0.5 transition-all text-xs",
                          restoreMode === "replace"
                            ? "border-destructive bg-destructive/10 ring-1 ring-destructive"
                            : "border-border bg-card hover:bg-secondary/40"
                        )}
                      >
                        <p className="font-bold text-destructive">Full Replace</p>
                        <p className="text-[10px] text-muted-foreground">Clear current data and restore backup.</p>
                      </button>
                    </div>
                  </div>

                  {/* Settings Checkbox */}
                  {validationResult.data?.settings && (
                    <label className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 border border-border/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSettings}
                        onChange={(e) => setIncludeSettings(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-[11px] text-foreground font-medium">
                        Restore non-secret preferences (Theme, retention, toggles)
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl border border-destructive/30 bg-destructive/10 space-y-1 text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Incompatible Backup File</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{validationResult.error}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRestoreModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            {validationResult?.isValid && (
              <Button
                size="sm"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className={cn(
                  "text-xs rounded-xl font-semibold gap-1",
                  restoreMode === "replace" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary"
                )}
              >
                {isRestoring ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                <span>{isRestoring ? "Restoring…" : restoreMode === "replace" ? "Replace All & Restore" : "Merge & Restore"}</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
