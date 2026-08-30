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
} from "lucide-react";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/investigation/CyberBadges";
import type { InvestigationReport } from "@/lib/scan/types";

const ReportsScreen = memo(function ReportsScreen() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const reports = useLiveQuery(async () => {
    return await db.investigations.orderBy("createdAt").reverse().toArray();
  }, []) as InvestigationReport[] | undefined;

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter((rep) => {
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
  }, [reports, riskFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!reports) return { total: 0, critical: 0, high: 0, medium: 0, low: 0, benign: 0 };
    return {
      total: reports.length,
      critical: reports.filter((r) => r.finalRisk?.overall === "critical").length,
      high: reports.filter((r) => r.finalRisk?.overall === "high").length,
      medium: reports.filter((r) => r.finalRisk?.overall === "medium").length,
      low: reports.filter((r) => r.finalRisk?.overall === "low").length,
      benign: reports.filter((r) => r.finalRisk?.overall === "benign").length,
    };
  }, [reports]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Investigation Reports
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-primary/30 bg-primary/10 text-primary">
                  Local Records
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Dossiers and evidence-backed threat reports saved locally on your device.
              </p>
            </div>
          </div>

          <Link to="/">
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <ScanSearch className="h-3.5 w-3.5" />
              <span>New Investigation</span>
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-2">
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Reports</span>
            <div className="text-xl font-extrabold text-foreground mt-0.5">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 tracking-wider">Critical</span>
            <div className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-0.5">{stats.critical}</div>
          </div>
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 tracking-wider">High Risk</span>
            <div className="text-xl font-extrabold text-orange-600 dark:text-orange-400 mt-0.5">{stats.high}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Medium</span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{stats.medium}</div>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Low Risk</span>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{stats.low}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Benign</span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.benign}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case ID, target URL, or verdict..."
            className="pl-9 h-9 text-xs rounded-xl bg-card border-border"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "critical", "high", "medium", "low", "benign"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setRiskFilter(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors uppercase tracking-wider ${
                riskFilter === lvl
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
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
                  : "Scan a QR code or enter a payload to generate your first intelligence report."}
              </p>
            </div>
            <Link to="/">
              <Button size="sm" className="mt-2 text-xs gap-1 bg-primary text-primary-foreground">
                <ScanSearch className="h-3.5 w-3.5" />
                <span>Go to Scanner</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredReports.map((rep) => {
              const risk = rep.finalRisk?.overall || "unknown";
              const score = rep.finalRisk?.numeric ?? 0;
              const date = new Date(rep.createdAt || Date.now());

              return (
                <div
                  key={rep.id}
                  onClick={() => navigate(`/investigation/${rep.id}`)}
                  className="cursor-pointer group rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:bg-secondary/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/80 border border-border/80 group-hover:border-primary/30 transition-colors">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate max-w-md">
                          {rep.rawContent.slice(0, 70) || `Investigation ${rep.id.slice(0, 8)}`}
                        </span>
                        <SeverityBadge severity={risk} className="text-[10px]" />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          {date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          <span>Format: {rep.format || "QR_CODE"}</span>
                        </span>
                        <span className="font-mono text-foreground font-semibold">
                          Score: {score}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-primary group-hover:bg-primary/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/investigation/${rep.id}`);
                      }}
                    >
                      <span>Open Dossier</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default ReportsScreen;
