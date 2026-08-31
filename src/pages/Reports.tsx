import { memo, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FileText,
  Search,
  Calendar,
  Layers,
  ArrowRight,
  ScanSearch,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge } from "@/components/investigation/CyberBadges";
import { FormalReportDossier } from "@/components/reports/FormalReportDossier";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "@/lib/scan/types";
import { sanitizeObject } from "@/lib/investigation/sanitization";
import { investigationEngine } from "@/lib/investigation/engine";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ReportsScreen = memo(function ReportsScreen() {
  const navigate = useNavigate();
  const settings = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "risk" | "oldest">("recent");

  // Selected report for Dossier Viewer Modal
  const [selectedReport, setSelectedReport] = useState<InvestigationReport | null>(null);

  // Generate Report from Case Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isRegeneratingId, setIsRegeneratingId] = useState<string | null>(null);

  // Live queries for investigations and cases
  const reports = useLiveQuery(() => db.investigations.orderBy("createdAt").reverse().toArray(), []) as
    | InvestigationReport[]
    | undefined;

  const cases = useLiveQuery(() => db.cases.toArray(), []) as InvestigationCase[] | undefined;

  // Filtered and sorted reports
  const filteredReports = useMemo(() => {
    if (!Array.isArray(reports)) return [];
    const list = reports.filter((rep) => {
      // Risk filter
      const riskLevel = rep.finalRisk?.overall || "unknown";
      if (riskFilter !== "all" && riskLevel.toLowerCase() !== riskFilter.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = rep.id.toLowerCase().includes(q);
        const matchCase = rep.caseId?.toLowerCase().includes(q);
        const matchContent = rep.rawContent?.toLowerCase().includes(q);
        const matchVerdict = rep.finalRisk?.verdict?.toLowerCase().includes(q);
        return matchId || matchCase || matchContent || matchVerdict;
      }

      return true;
    });

    if (sortBy === "recent") {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === "oldest") {
      list.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === "risk") {
      const riskWeight: Record<string, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        benign: 1,
        unknown: 0,
      };
      list.sort(
        (a, b) =>
          (riskWeight[b.finalRisk?.overall || "unknown"] || 0) -
          (riskWeight[a.finalRisk?.overall || "unknown"] || 0)
      );
    }

    return list;
  }, [reports, riskFilter, searchQuery, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!Array.isArray(reports)) return { total: 0, critical: 0, high: 0, medium: 0, low: 0, benign: 0 };
    return {
      total: reports.length,
      critical: reports.filter((r) => r.finalRisk?.overall === "critical").length,
      high: reports.filter((r) => r.finalRisk?.overall === "high").length,
      medium: reports.filter((r) => r.finalRisk?.overall === "medium").length,
      low: reports.filter((r) => r.finalRisk?.overall === "low").length,
      benign: reports.filter((r) => r.finalRisk?.overall === "benign").length,
    };
  }, [reports]);

  // Download JSON directly from card
  const handleDownloadReportJson = (rep: InvestigationReport, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const sanitized = sanitizeObject({
        scanIqVersion: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        caseId: rep.caseId || rep.id,
        investigationId: rep.id,
        createdAt: new Date(rep.createdAt).toISOString(),
        status: rep.status,
        format: rep.format,
        contentType: rep.contentType,
        rawContent: rep.rawContent,
        executiveSummary: {
          riskLevel: rep.finalRisk.overall,
          threatScore: rep.finalRisk.numeric,
          verdict: rep.finalRisk.verdict,
          explanation: rep.finalRisk.explanation,
        },
        payloadAnalysis: rep.payloadAnalysis,
        domainIntelligence: rep.domainIntel,
        infrastructureIntelligence: rep.hostIntel,
        threatIntelligence: rep.reputation,
        evidenceFindings: rep.findings,
      });

      const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scaniq-report-${rep.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Structured report JSON downloaded");
    } catch {
      toast.error("Failed to download report JSON");
    }
  };

  // Delete individual report
  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm("Delete this investigation report?");
    if (!ok) return;
    await db.investigations.delete(id);
    toast.success("Investigation report deleted.");
  };

  // Regenerate / refresh report from existing Case
  const handleRegenerateFromCase = async (rep: InvestigationReport, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRegeneratingId) return;
    setIsRegeneratingId(rep.id);
    const toastId = toast.loading("Regenerating investigation report with latest intelligence...");

    try {
      const scanRecord: ScanRecord = {
        id: `scan-regen-${Date.now()}`,
        content: rep.rawContent,
        format: rep.format,
        type: rep.contentType,
        scannedAt: Date.now(),
        caseId: rep.caseId,
      };

      const { report: newReport } = await investigationEngine.runInvestigation(
        scanRecord,
        rep.caseId,
        {
          userConsent: settings.externalLookupsOptedIn,
          sourceToggles: settings.sourceToggles,
        }
      );

      await db.investigations.put(newReport);
      if (rep.caseId) {
        await db.cases.update(rep.caseId, {
          latestInvestigationId: newReport.id,
          latestRiskLevel: newReport.finalRisk.overall,
          updatedAt: Date.now(),
        });
      }

      toast.success("Report updated successfully!", { id: toastId });
    } catch {
      toast.error("Failed to regenerate report.", { id: toastId });
    } finally {
      setIsRegeneratingId(null);
    }
  };

  // Open Report from Case selection
  const handleSelectCaseToReport = (c: InvestigationCase) => {
    setIsGenerateModalOpen(false);
    if (c.latestInvestigationId) {
      const existing = reports?.find((r) => r.id === c.latestInvestigationId);
      if (existing) {
        setSelectedReport(existing);
      } else {
        navigate(`/investigation/${c.latestInvestigationId}`);
      }
    } else {
      toast.info(`Case ${c.label || c.id} has no scans yet. Open Scan tab to add target.`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & METRICS BAR                                               */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  Investigation Reports & Evidence
                </h1>
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-primary/30 bg-primary/10 text-primary">
                  Local Records
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Formal dossiers, provenance logs, and verifiable intelligence summaries.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsGenerateModalOpen(true)}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generate from Case</span>
            </Button>

            <Link to="/">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl">
                <ScanSearch className="h-3.5 w-3.5" />
                <span>New Scan</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Aggregate Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2">
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Reports</span>
            <div className="text-xl font-extrabold text-foreground mt-0.5 font-mono">{stats.total}</div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wider">Critical</span>
            <div className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-0.5 font-mono">{stats.critical}</div>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wider">High Risk</span>
            <div className="text-xl font-extrabold text-orange-600 dark:text-orange-400 mt-0.5 font-mono">{stats.high}</div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Medium</span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">{stats.medium}</div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Low Risk</span>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 font-mono">{stats.low}</div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Benign</span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">{stats.benign}</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH, SEVERITY FILTERS & SORTING                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports by case ID, target URL, or verdict..."
            className="pl-10 h-10 text-xs rounded-2xl bg-card border-border"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "critical", "high", "medium", "low", "benign"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setRiskFilter(lvl)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors",
                riskFilter === lvl
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              {lvl}
            </button>
          ))}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-2.5 rounded-xl bg-card border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shrink-0 ml-1"
          >
            <option value="recent">Sort: Recent</option>
            <option value="risk">Sort: Risk</option>
            <option value="oldest">Sort: Oldest</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. REPORTS LIST                                                           */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-12 text-center space-y-3 bg-card/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-foreground">No investigation reports found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || riskFilter !== "all"
                  ? "Try resetting your search or severity filter."
                  : "Scan a QR code or generate a report from a case to initialize an evidence dossier."}
              </p>
            </div>
            <Link to="/">
              <Button size="sm" className="mt-2 text-xs gap-1.5 bg-primary text-primary-foreground rounded-xl font-semibold">
                <ScanSearch className="h-3.5 w-3.5" />
                <span>Go to Scanner</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredReports.map((rep) => {
              const risk = rep.finalRisk?.overall || "unknown";
              const score = rep.finalRisk?.numeric ?? 0;
              const date = new Date(rep.createdAt || Date.now());
              const isRegenerating = isRegeneratingId === rep.id;

              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className="cursor-pointer group rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:border-primary/40 hover:bg-secondary/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary/80 border border-border/80 group-hover:border-primary/30 transition-colors">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>

                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate max-w-lg">
                          {rep.rawContent.slice(0, 80) || `Investigation ${rep.id.slice(0, 8)}`}
                        </span>
                        <SeverityBadge severity={risk} className="text-[10px]" />
                        <span className="font-mono text-xs font-bold text-foreground">
                          {score}/100
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          {date.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Briefcase className="h-3 w-3" />
                          <span>Case #{rep.caseId?.replace("case-", "").slice(0, 8) || "Direct"}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          <span>{rep.findings?.length || 0} findings</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleRegenerateFromCase(rep, e)}
                      disabled={isRegenerating}
                      className="h-8 text-xs gap-1 rounded-xl border-border hover:bg-secondary"
                      title="Regenerate Report"
                    >
                      <RefreshCw className={cn("h-3 w-3", isRegenerating && "animate-spin text-primary")} />
                      <span className="hidden md:inline">{isRegenerating ? "Updating…" : "Regen"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleDownloadReportJson(rep, e)}
                      className="h-8 text-xs gap-1 rounded-xl border-border hover:bg-secondary"
                      title="Download Structured JSON"
                    >
                      <Download className="h-3 w-3" />
                      <span className="hidden md:inline">JSON</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteReport(rep.id, e)}
                      className="h-8 text-xs rounded-xl text-destructive hover:bg-destructive/10 px-2"
                      title="Delete Report"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(rep);
                      }}
                    >
                      <span>View Dossier</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. FORMAL REPORT DOSSIER MODAL                                            */}
      {/* ========================================================================= */}
      {selectedReport && (
        <FormalReportDossier
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          report={selectedReport}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. GENERATE REPORT FROM CASE MODAL                                        */}
      {/* ========================================================================= */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Generate Report from Case
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an investigation case to view or export its complete intelligence report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {!cases || cases.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2 border border-dashed rounded-2xl">
                <Briefcase className="h-6 w-6 mx-auto opacity-40" />
                <p>No investigation cases found.</p>
              </div>
            ) : (
              cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCaseToReport(c)}
                  className="p-3 rounded-2xl border border-border bg-secondary/30 hover:bg-secondary hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-foreground truncate">
                      {c.label || `Case #${c.id.slice(-6)}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {c.primaryTarget || c.id}
                    </div>
                  </div>

                  <SeverityBadge severity={c.latestRiskLevel || "unknown"} className="text-[9px]" />
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsGenerateModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ReportsScreen;
