import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationReport, RiskLevel } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import { SeverityBadge, SEVERITY_CONFIG } from "@/components/investigation/CyberBadges";

interface ExecutiveVerdictProps {
  report: InvestigationReport;
}

export function ExecutiveVerdict({ report }: ExecutiveVerdictProps) {
  const risk = report.finalRisk;
  const sevKey = risk.overall?.toLowerCase() || "unknown";
  const confMeta = SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.unknown;
  const SevIcon = confMeta.icon;

  const scorePct = Math.max(0, Math.min(100, risk.numeric));
  const confidenceScore = risk.confidenceScore ?? risk.confidence ?? 0.8;
  const confidenceLevel = risk.confidenceLevel || (confidenceScore >= 0.8 ? "High" : confidenceScore >= 0.5 ? "Medium" : "Low");

  const statusLabel =
    report.status === "complete"
      ? (risk.missingIntelligence && risk.missingIntelligence.length > 0
          ? "Complete (Partial Sources)"
          : "Complete")
      : report.status === "running"
      ? "Querying Providers..."
      : report.status === "failed"
      ? "Investigation Failed"
      : "Pending";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-bold border-primary/30 bg-primary/10 text-primary tracking-wide">
            EXECUTIVE VERDICT
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] flex items-center gap-1",
              report.status === "complete"
                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
            )}
          >
            {report.status === "complete" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            <span>{statusLabel}</span>
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          Case: <span className="text-foreground">{report.caseId || report.id}</span>
        </div>
      </div>

      {/* Main Verdict Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Risk Badge & Numeric Score */}
        <div
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border text-center space-y-1",
            confMeta.classes
          )}
        >
          <SevIcon className="h-8 w-8 mb-1" />
          <span className="text-xs font-extrabold tracking-wider uppercase">
            {confMeta.label}
          </span>
          <div className="text-2xl font-black tracking-tight tabular-nums text-foreground">
            {risk.numeric} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Explainable Verdict Statement */}
        <div className="md:col-span-2 space-y-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground leading-snug">
              {risk.verdict}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {risk.explanation}
            </p>
          </div>

          {/* Metrics Grid: Risk Score vs Evidence Confidence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Risk Score Meter */}
            <div className="space-y-1 bg-secondary/30 p-2.5 rounded-xl border border-border/50">
              <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                <span>Threat Severity</span>
                <span className="font-bold text-foreground tabular-nums">{risk.numeric}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", confMeta.dotColor)}
                  style={{ width: `${scorePct}%` }}
                />
              </div>
            </div>

            {/* Evidence Confidence Meter */}
            <div className="space-y-1 bg-secondary/30 p-2.5 rounded-xl border border-border/50">
              <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                <span>Evidence Confidence</span>
                <span className="font-bold text-foreground tabular-nums">
                  {typeof confidenceLevel === "string" ? confidenceLevel.toUpperCase() : "MEDIUM"} ({Math.round(confidenceScore * 100)}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.round(confidenceScore * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
