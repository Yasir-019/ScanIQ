import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  FileText,
  BookOpen,
  Layers,
  Activity,
  Network,
  Globe,
  Clock,
  Code2,
  Search,
  RefreshCw,
  SlidersHorizontal,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { db } from "@/lib/db";
import type { ScanRecord } from "@/lib/scan/types";
import type { UnifiedInvestigationModel } from "@/lib/investigation/synthesis-types";
import { investigationEngine } from "@/lib/investigation/engine";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// Modular Analyst Workspace Components
import { ExecutiveVerdict } from "@/components/investigation/ExecutiveVerdict";
import { RiskDriversPanel } from "@/components/investigation/RiskDriversPanel";
import { DecodedPayloadSection } from "@/components/investigation/DecodedPayloadSection";
import { UrlDomainSection } from "@/components/investigation/UrlDomainSection";
import { InfrastructureSection } from "@/components/investigation/InfrastructureSection";
import { ThreatIntelSection } from "@/components/investigation/ThreatIntelSection";
import { InvestigationGraphViewer } from "@/components/investigation/InvestigationGraphViewer";
import { TimelineViewer } from "@/components/investigation/TimelineViewer";
import { EvidenceExplorer } from "@/components/investigation/EvidenceExplorer";
import { TechnicalDetailsSection } from "@/components/investigation/TechnicalDetailsSection";
import { ProviderControlsModal } from "@/components/investigation/ProviderControlsModal";
import { ReportExportModal } from "@/components/investigation/ReportExportModal";

export default function InvestigationScreen() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const settings = useSettings();

  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "intel" | "graph" | "timeline" | "technical" | "notes">("overview");
  const [isRerunning, setIsRerunning] = useState(false);
  const [showProviderControls, setShowProviderControls] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Load current investigation
  const inv = useLiveQuery(
    () => (id ? db.investigations.where("id").equals(id).first() : Promise.resolve(undefined)),
    [id],
  );

  // Load all historical investigations for this case
  const caseId = inv?.caseId;
  const caseHistory = useLiveQuery(
    () => (caseId ? db.investigations.where("caseId").equals(caseId).reverse().sortBy("createdAt") : Promise.resolve([])),
    [caseId],
  );

  const [notes, setNotes] = useState<string>(inv?.notes ?? "");

  useEffect(() => {
    if (inv?.notes !== undefined) setNotes(inv.notes);
  }, [inv?.id, inv?.notes]);

  if (!inv) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto py-8">
        <button
          onClick={() => navigate("/cases")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </button>
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground space-y-2">
          <Search className="mx-auto h-8 w-8 opacity-40 text-primary" />
          <p className="font-semibold text-foreground">Investigation Record Not Found</p>
          <p>This investigation record may have been deleted or does not exist locally.</p>
        </div>
      </div>
    );
  }

  const saveNotes = async () => {
    if (!inv) return;
    await db.investigations.update(inv.id, { notes });
    toast.success("Case notes saved.");
  };

  const handleRerunInvestigation = async () => {
    if (!inv || isRerunning) return;
    setIsRerunning(true);
    const toastId = toast.loading("Rerunning intelligence lookups across active providers...");

    try {
      const scanRecord: ScanRecord = {
        id: `scan-rerun-${Date.now()}`,
        content: inv.rawContent,
        format: inv.format,
        type: inv.contentType,
        scannedAt: Date.now(),
        caseId: inv.caseId,
      };

      const { report } = await investigationEngine.runInvestigation(scanRecord, inv.caseId, {
        userConsent: settings.externalLookupsOptedIn,
        sourceToggles: settings.sourceToggles,
      });

      // Save new investigation record
      await db.investigations.put(report);

      // Update case pointer to latest investigation
      if (inv.caseId) {
        await db.cases.update(inv.caseId, {
          latestInvestigationId: report.id,
          latestRiskLevel: report.finalRisk.overall,
          updatedAt: Date.now(),
        });
      }

      toast.success("Investigation refreshed with latest intelligence", { id: toastId });
      navigate(`/investigation/${report.id}`);
    } catch (err) {
      toast.error(`Failed to rerun investigation: ${err instanceof Error ? err.message : "Unknown error"}`, { id: toastId });
    } finally {
      setIsRerunning(false);
    }
  };

  const synthesis = inv.synthesis as UnifiedInvestigationModel | undefined;
  const historyList = caseHistory || [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-16">
      {/* Workspace Sticky Control Bar */}
      <div className="p-3 sm:p-3.5 rounded-2xl border border-border bg-card/90 backdrop-blur shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/cases")}
            className="h-8 rounded-xl text-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cases</span>
          </Button>

          {/* Multi-Run History Switcher */}
          {historyList.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs bg-secondary/50 px-2 py-1 rounded-xl border border-border">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Run:</span>
              <select
                value={inv.id}
                onChange={(e) => navigate(`/investigation/${e.target.value}`)}
                className="bg-transparent text-[11px] font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                {historyList.map((hist, idx) => (
                  <option key={hist.id} value={hist.id} className="bg-background text-foreground">
                    #{historyList.length - idx} · {new Date(hist.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({hist.finalRisk.overall.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProviderControls(true)}
            className="h-8 text-xs rounded-xl flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Provider Controls</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRerunInvestigation}
            disabled={isRerunning}
            className="h-8 text-xs rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRerunning && "animate-spin text-primary")} />
            <span>{isRerunning ? "Rerunning..." : "Rerun Analysis"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export Dossier</span>
          </Button>
        </div>
      </div>

      {/* 1. Executive Verdict & Risk/Confidence Meters */}
      <ExecutiveVerdict report={inv} />

      {/* 2. Investigation Workspace Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-7 rounded-xl h-auto p-1 gap-1 bg-secondary/40 border border-border">
          <TabsTrigger value="overview" className="rounded-lg text-xs py-1.5">
            <Layers className="mr-1 h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="evidence" className="rounded-lg text-xs py-1.5">
            <Activity className="mr-1 h-3.5 w-3.5" /> Evidence ({inv.findings.length})
          </TabsTrigger>
          <TabsTrigger value="intel" className="rounded-lg text-xs py-1.5">
            <Globe className="mr-1 h-3.5 w-3.5" /> Intel & Infra
          </TabsTrigger>
          <TabsTrigger value="graph" className="rounded-lg text-xs py-1.5">
            <Network className="mr-1 h-3.5 w-3.5" /> Entity Graph
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg text-xs py-1.5">
            <Clock className="mr-1 h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="technical" className="rounded-lg text-xs py-1.5">
            <Code2 className="mr-1 h-3.5 w-3.5" /> Technical
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg text-xs py-1.5 col-span-3 sm:col-span-1">
            <BookOpen className="mr-1 h-3.5 w-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <RiskDriversPanel
            finalRisk={inv.finalRisk}
            onSelectEvidence={() => setActiveTab("evidence")}
          />
          <DecodedPayloadSection report={inv} />
          <UrlDomainSection report={inv} />
        </TabsContent>

        {/* TAB 2: EVIDENCE EXPLORER */}
        <TabsContent value="evidence" className="mt-4 space-y-4">
          <EvidenceExplorer findings={inv.findings} />
        </TabsContent>

        {/* TAB 3: INTEL & INFRASTRUCTURE */}
        <TabsContent value="intel" className="mt-4 space-y-4">
          <ThreatIntelSection report={inv} />
          <InfrastructureSection
            hosts={inv.hostIntel}
            primaryDomain={inv.targets.domains[0] || inv.targets.urls[0]?.domain}
          />
        </TabsContent>

        {/* TAB 4: INVESTIGATION GRAPH */}
        <TabsContent value="graph" className="mt-4 space-y-4">
          <InvestigationGraphViewer synthesis={synthesis} />
        </TabsContent>

        {/* TAB 5: TIMELINE */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <TimelineViewer report={inv} />
        </TabsContent>

        {/* TAB 6: TECHNICAL & PROVENANCE */}
        <TabsContent value="technical" className="mt-4 space-y-4">
          <TechnicalDetailsSection report={inv} />
        </TabsContent>

        {/* TAB 7: ANALYST CASE NOTES */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Analyst Case Notes</h3>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              placeholder="Record forensic notes, IOCs, timestamps, or findings..."
              className="rounded-xl text-xs font-mono"
            />
            <Button size="sm" onClick={saveNotes} className="rounded-xl text-xs font-semibold">
              Save Notes
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Provider Controls Modal */}
      <ProviderControlsModal
        isOpen={showProviderControls}
        onClose={() => setShowProviderControls(false)}
        report={inv}
        onRerun={handleRerunInvestigation}
      />

      {/* Formal Dossier Export Modal */}
      <ReportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        report={inv}
      />
    </div>
  );
}
