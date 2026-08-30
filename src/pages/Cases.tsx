import { useMemo, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Trash2,
  Star,
  Briefcase,
  ArrowRight,
  Calendar,
  Plus,
  Edit2,
  Download,
  AlertTriangle,
  FolderOpen,
  Layers,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { db, createNewCase, deleteCaseWithCascade } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/investigation/CyberBadges";
import { parseScanContent } from "@/lib/scan/parser";
import { investigationEngine } from "@/lib/investigation/engine";
import type { InvestigationCase, RiskLevel, ScanRecord, CaseStatus } from "@/lib/scan/types";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface CaseCardProps {
  c: InvestigationCase;
  linkedScansCount: number;
  open: (id: string) => void;
  onEdit: (c: InvestigationCase) => void;
  onAddTarget: (c: InvestigationCase) => void;
  remove: (id: string) => void;
  toggleStar: (id: string, current: boolean) => void;
}

const CaseCard = memo(function CaseCard({
  c,
  linkedScansCount,
  open,
  onEdit,
  onAddTarget,
  remove,
  toggleStar,
}: CaseCardProps) {
  const risk = (c.latestRiskLevel ?? "unknown") as RiskLevel;
  const date = new Date(c.updatedAt);
  const isArchived = c.status === "archived";

  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const exportData = {
        caseRecord: c,
        exportedAt: new Date().toISOString(),
        application: "ScanIQ Community OSINT",
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `case-${c.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Case exported as JSON");
    } catch {
      toast.error("Failed to export case");
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl border p-4 sm:p-5 bg-card shadow-sm transition-all flex flex-col justify-between space-y-3.5 hover:border-primary/40",
        isArchived ? "opacity-70 bg-secondary/20" : "bg-card"
      )}
    >
      <div className="space-y-3">
        {/* Top Header: Label, Star, Risk */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30 mt-0.5">
              <Briefcase className="h-5 w-5" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm text-foreground truncate">
                  {c.label || `Case #${c.id.replace("case-", "").slice(0, 8)}`}
                </h3>
                {c.status && c.status !== "active" && (
                  <Badge variant="outline" className="text-[9px] uppercase font-mono bg-secondary/50">
                    {c.status}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                ID: {c.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SeverityBadge severity={risk} />
            <button
              onClick={() => toggleStar(c.id, !!c.starred)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-warning transition-colors"
              aria-label={c.starred ? "Unstar case" : "Star case"}
            >
              <Star className={cn("h-4 w-4", c.starred && "fill-warning text-warning")} />
            </button>
          </div>
        </div>

        {/* Target Preview & Indicators */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {c.primaryTarget && (
            <div className="p-2.5 rounded-2xl bg-secondary/40 border border-border/60 font-mono text-[11px] text-foreground/90 truncate">
              <span className="text-muted-foreground font-sans text-[10px] uppercase font-bold mr-1">Primary:</span>
              {c.primaryTarget}
            </div>
          )}

          {c.notes && (
            <p className="text-[11px] line-clamp-2 text-muted-foreground/90 italic">
              &ldquo;{c.notes}&rdquo;
            </p>
          )}

          {/* Tags */}
          {c.tags && c.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {c.tags.map((t, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-[9px] font-mono py-0 px-1.5 bg-secondary/30 border-border"
                >
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-2 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {date.toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-primary" />
            {linkedScansCount} {linkedScansCount === 1 ? "artifact" : "artifacts"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddTarget(c)}
              className="h-7 text-[11px] gap-1 rounded-xl border-border hover:bg-secondary px-2.5"
            >
              <Plus className="h-3 w-3" />
              <span>Add Artifact</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(c)}
              className="h-7 text-[11px] gap-1 rounded-xl text-muted-foreground hover:text-foreground px-2"
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportJson}
              className="h-7 text-[11px] gap-1 rounded-xl text-muted-foreground hover:text-foreground px-2"
              title="Export Case JSON"
            >
              <Download className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(c.id)}
              className="h-7 text-[11px] gap-1 rounded-xl text-destructive hover:bg-destructive/10 px-2"
              title="Delete Case"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => open(c.id)}
            className="h-7 px-3 text-[11px] gap-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm"
          >
            <span>Open Dossier</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export default function CasesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useSettings();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "starred" | "archived">("all");
  const [sortBy, setSortBy] = useState<"updated" | "risk" | "created">("updated");

  // Modals state
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [newCaseLabel, setNewCaseLabel] = useState("");
  const [newCaseTags, setNewCaseTags] = useState("");
  const [newCaseNotes, setNewCaseNotes] = useState("");

  const [editingCase, setEditingCase] = useState<InvestigationCase | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editStatus, setEditStatus] = useState<CaseStatus>("active");
  const [editTags, setEditTags] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [targetCase, setTargetCase] = useState<InvestigationCase | null>(null);
  const [newTargetPayload, setNewTargetPayload] = useState("");
  const [isProcessingTarget, setIsProcessingTarget] = useState(false);

  // Live query for all cases and scans
  const cases = useLiveQuery(() => db.cases.toArray(), []);
  const scans = useLiveQuery(() => db.scans.toArray(), []);

  // Compute scans per case
  const scanCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (scans) {
      for (const s of scans) {
        if (s.caseId) {
          map.set(s.caseId, (map.get(s.caseId) || 0) + 1);
        }
      }
    }
    return map;
  }, [scans]);

  // Filtered and sorted case list
  const filtered = useMemo(() => {
    let list = cases ? [...cases] : [];

    // 1. Tab Filter
    if (tab === "starred") {
      list = list.filter((c) => c.starred);
    } else if (tab === "active") {
      list = list.filter((c) => {
        const risk = c.latestRiskLevel;
        return risk === "high" || risk === "critical" || risk === "medium";
      });
    } else if (tab === "archived") {
      list = list.filter((c) => c.status === "archived");
    }

    // 2. Search Query
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          (c.label ?? "").toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.primaryTarget ?? "").toLowerCase().includes(q) ||
          (c.tags ?? []).join(" ").toLowerCase().includes(q) ||
          (c.notes ?? "").toLowerCase().includes(q)
      );
    }

    // 3. Sorting
    if (sortBy === "updated") {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sortBy === "created") {
      list.sort((a, b) => b.createdAt - a.createdAt);
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
          (riskWeight[b.latestRiskLevel || "unknown"] || 0) -
          (riskWeight[a.latestRiskLevel || "unknown"] || 0)
      );
    }

    return list;
  }, [cases, tab, query, sortBy]);

  // Aggregate metrics
  const totalCount = cases?.length ?? 0;
  const highRiskCount = cases?.filter(
    (c) => c.latestRiskLevel === "critical" || c.latestRiskLevel === "high"
  ).length ?? 0;
  const starredCount = cases?.filter((c) => c.starred).length ?? 0;

  // Open investigation dossier
  const open = (id: string) => {
    const target = cases?.find((c) => c.id === id);
    if (target?.latestInvestigationId) {
      navigate(`/investigation/${target.latestInvestigationId}`);
    } else {
      toast.info("This case has no completed investigation report yet. Add an artifact to run analysis.");
    }
  };

  // Toggle star
  const toggleStar = useCallback(async (id: string, current: boolean) => {
    await db.cases.update(id, { starred: !current });
    toast.success(!current ? "Case starred" : "Case unstarred");
  }, []);

  // Delete case
  const remove = useCallback(
    async (id: string) => {
      const item = await db.cases.get(id);
      if (!item) return;
      await deleteCaseWithCascade(id);
      toast("Case deleted", {
        action: {
          label: t("common.undo", "Undo"),
          onClick: async () => {
            if (!item) return;
            await db.cases.put(item);
            toast.success("Case restored");
          },
        },
      });
    },
    [t]
  );

  // Clear all cases
  const clearAll = async () => {
    const ok = window.confirm(
      "Permanently delete ALL investigation cases, linked scans, and reports from local storage?"
    );
    if (!ok) return;
    await Promise.all([db.cases.clear(), db.scans.clear(), db.investigations.clear()]);
    toast.success("All investigation cases cleared.");
  };

  // Create new Case action
  const handleCreateCase = async () => {
    const label = newCaseLabel.trim() || undefined;
    const tags = newCaseTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const notes = newCaseNotes.trim() || undefined;

    const created = await createNewCase(label, tags, notes);
    toast.success(`Case ${created.label} created.`);
    setIsNewCaseOpen(false);
    setNewCaseLabel("");
    setNewCaseTags("");
    setNewCaseNotes("");
  };

  // Open Edit Modal
  const handleOpenEdit = (c: InvestigationCase) => {
    setEditingCase(c);
    setEditLabel(c.label || "");
    setEditStatus(c.status || "active");
    setEditTags(c.tags ? c.tags.join(", ") : "");
    setEditNotes(c.notes || "");
  };

  // Save Edit action
  const handleSaveEdit = async () => {
    if (!editingCase) return;
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await db.cases.update(editingCase.id, {
      label: editLabel.trim() || undefined,
      status: editStatus,
      tags,
      notes: editNotes.trim() || undefined,
      updatedAt: Date.now(),
    });

    toast.success("Case updated.");
    setEditingCase(null);
  };

  // Add Target Artifact action
  const handleAddTargetToCase = async () => {
    if (!targetCase) return;
    const payload = newTargetPayload.trim();
    if (!payload) {
      toast.error("Please enter a payload or target URL.");
      return;
    }

    setIsProcessingTarget(true);
    try {
      const now = Date.now();
      const parsed = parseScanContent(payload, "UNKNOWN");

      const scanRecord: ScanRecord = {
        id: `scan-${crypto.randomUUID ? crypto.randomUUID() : String(now)}`,
        content: payload,
        format: "UNKNOWN",
        type: parsed.type,
        parsed: parsed.data,
        safetyStatus: "unchecked",
        scannedAt: now,
        caseId: targetCase.id,
      };

      await db.scans.put(scanRecord);

      // Run modular investigation engine
      const { report: inv } = await investigationEngine.runInvestigation(
        scanRecord,
        targetCase.id,
        {
          userConsent: settings.externalLookupsOptedIn,
          sourceToggles: settings.sourceToggles,
        }
      );

      await db.investigations.put(inv);

      const finalRiskOverall = inv.finalRisk.overall;
      const safetyStatus: ScanRecord["safetyStatus"] =
        finalRiskOverall === "critical" || finalRiskOverall === "high"
          ? "malicious"
          : finalRiskOverall === "medium" || finalRiskOverall === "low"
          ? "suspicious"
          : finalRiskOverall === "benign"
          ? "safe"
          : "unchecked";

      scanRecord.safetyStatus = safetyStatus;
      scanRecord.investigationId = inv.id;
      await db.scans.put(scanRecord);

      // Update case
      const currentTargetCount = (targetCase.targetCount || 1) + 1;
      await db.cases.update(targetCase.id, {
        latestInvestigationId: inv.id,
        latestRiskLevel: finalRiskOverall,
        primaryTarget: targetCase.primaryTarget || payload,
        targetCount: currentTargetCount,
        updatedAt: now,
      });

      toast.success("Artifact added to case and analysis completed!");
      setTargetCase(null);
      setNewTargetPayload("");
    } catch {
      toast.error("Failed to process target artifact.");
    } finally {
      setIsProcessingTarget(false);
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
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Investigation Cases
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Local-first case dossier management for multi-target OSINT investigations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsNewCaseOpen(true)}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>New Case</span>
            </Button>

            {totalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="h-8 text-xs rounded-xl border-border text-muted-foreground hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>Total Cases</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {totalCount}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span>High / Critical Risks</span>
            </div>
            <div className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-1 font-mono">
              {highRiskCount}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-warning" />
              <span>Starred Cases</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {starredCount}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-500" />
              <span>Total Artifacts</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {scans?.length ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH, FILTER TABS & SORTING                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="w-full md:w-auto"
        >
          <TabsList className="grid grid-cols-4 rounded-2xl bg-secondary/60 p-1">
            <TabsTrigger value="all" className="rounded-xl text-xs font-semibold">
              All ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-xl text-xs font-semibold">
              Risks ({highRiskCount})
            </TabsTrigger>
            <TabsTrigger value="starred" className="rounded-xl text-xs font-semibold">
              Starred ({starredCount})
            </TabsTrigger>
            <TabsTrigger value="archived" className="rounded-xl text-xs font-semibold">
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by label, target URL, tag, ID, or notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-10 rounded-2xl bg-card border-border text-xs"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 px-3 rounded-2xl bg-card border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shrink-0"
          >
            <option value="updated">Sort: Recent</option>
            <option value="risk">Sort: Risk Level</option>
            <option value="created">Sort: Created</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CASE LIST GRID                                                         */}
      {/* ========================================================================= */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Briefcase className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">No investigation cases found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {tab === "starred"
                ? "You have not starred any investigation cases yet."
                : tab === "active"
                ? "No high or critical risk cases flagged."
                : tab === "archived"
                ? "No archived cases."
                : "Create a new case above or scan a barcode to initialize an investigation."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsNewCaseOpen(true)}
            className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Case</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              linkedScansCount={scanCountMap.get(c.id) || (c.targetCount || 1)}
              open={open}
              onEdit={handleOpenEdit}
              onAddTarget={(caseObj) => {
                setTargetCase(caseObj);
                setNewTargetPayload("");
              }}
              remove={remove}
              toggleStar={toggleStar}
            />
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CREATE NEW CASE DIALOG                                                 */}
      {/* ========================================================================= */}
      <Dialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Create Investigation Case
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Initialize a new investigation dossier to group related targets and scans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="case-label" className="font-semibold text-foreground">Case Label / Title</label>
              <Input
                id="case-label"
                placeholder="e.g. Phishing Campaign #442 - Suspicious Payment QR"
                value={newCaseLabel}
                onChange={(e) => setNewCaseLabel(e.target.value)}
                className="h-10 rounded-2xl bg-secondary/40 border-border text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="case-tags" className="font-semibold text-foreground">Tags (comma-separated)</label>
              <Input
                id="case-tags"
                placeholder="e.g. phishing, qr-scam, banking, high-priority"
                value={newCaseTags}
                onChange={(e) => setNewCaseTags(e.target.value)}
                className="h-10 rounded-2xl bg-secondary/40 border-border text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="case-notes" className="font-semibold text-foreground">Initial Analyst Notes</label>
              <Textarea
                id="case-notes"
                placeholder="Initial background, context, victim report, or scope..."
                value={newCaseNotes}
                onChange={(e) => setNewCaseNotes(e.target.value)}
                className="h-20 rounded-2xl bg-secondary/40 border-border text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewCaseOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleCreateCase}
              className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Case</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. EDIT CASE METADATA DIALOG                                              */}
      {/* ========================================================================= */}
      <Dialog open={!!editingCase} onOpenChange={() => setEditingCase(null)}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Edit Case Details
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              {editingCase?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="edit-case-label" className="font-semibold text-foreground">Case Title</label>
              <Input
                id="edit-case-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="h-10 rounded-2xl bg-secondary/40 border-border text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-case-status" className="font-semibold text-foreground">Investigation Status</label>
              <select
                id="edit-case-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as CaseStatus)}
                className="w-full h-10 px-3 rounded-2xl bg-secondary/40 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active Investigation</option>
                <option value="archived">Archived</option>
                <option value="closed">Closed / Resolved</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-case-tags" className="font-semibold text-foreground">Tags</label>
              <Input
                id="edit-case-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="h-10 rounded-2xl bg-secondary/40 border-border text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-case-notes" className="font-semibold text-foreground">Analyst Notes</label>
              <Textarea
                id="edit-case-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="h-20 rounded-2xl bg-secondary/40 border-border text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingCase(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleSaveEdit}
              className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. ADD ARTIFACT / TARGET TO EXISTING CASE DIALOG                          */}
      {/* ========================================================================= */}
      <Dialog open={!!targetCase} onOpenChange={() => setTargetCase(null)}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Add Artifact to {targetCase?.label || "Case"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Link another URL, QR barcode, or payload into this exact case file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="new-target-payload" className="font-semibold text-foreground">Artifact Payload / Content</label>
              <Textarea
                id="new-target-payload"
                placeholder="https://example.com/login or paste raw QR payload..."
                value={newTargetPayload}
                onChange={(e) => setNewTargetPayload(e.target.value)}
                className="h-24 rounded-2xl bg-secondary/40 border-border font-mono text-xs"
              />
            </div>

            <div className="p-3 rounded-2xl bg-secondary/30 border border-border text-[11px] text-muted-foreground">
              Analysis will execute client-side and link the resulting threat report directly into this case dossier.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTargetCase(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              disabled={isProcessingTarget || !newTargetPayload.trim()}
              onClick={handleAddTargetToCase}
              className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5"
            >
              {isProcessingTarget ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Analyze & Link to Case</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
