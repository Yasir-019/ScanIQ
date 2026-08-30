import {
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  AlertCircle,
  FileQuestion,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskScoreSummary } from "@/lib/scan/types";

interface RiskDriversPanelProps {
  finalRisk: RiskScoreSummary;
  onSelectEvidence?: (evidenceTitle: string) => void;
}

export function RiskDriversPanel({ finalRisk, onSelectEvidence }: RiskDriversPanelProps) {
  const primaryDrivers = finalRisk.primaryDrivers || [];
  const supporting = finalRisk.supportingEvidence || [];
  const mitigating = finalRisk.mitigatingFactors || [];
  const conflicts = finalRisk.conflictingIntelligence || [];
  const missing = finalRisk.missingIntelligence || [];

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Why Is This Risky?</h3>
          <p className="text-[11px] text-muted-foreground">Explainable breakdown of risk drivers and mitigating factors.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Primary Risk Drivers */}
        <div className="space-y-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3.5">
          <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
            <AlertCircle className="h-4 w-4" />
            <span>Primary Risk Drivers ({primaryDrivers.length})</span>
          </div>
          {primaryDrivers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No severe adverse indicators or malicious patterns identified.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {primaryDrivers.map((driver, idx) => (
                <li
                  key={idx}
                  onClick={() => onSelectEvidence?.(driver)}
                  className="text-xs text-foreground bg-background/80 rounded-lg p-2 border border-destructive/15 flex items-start gap-1.5 cursor-pointer hover:bg-background transition-colors"
                >
                  <span className="text-destructive font-bold text-[10px] mt-0.5">•</span>
                  <span className="leading-snug">{driver}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 2. Mitigating Factors */}
        <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
            <ShieldCheck className="h-4 w-4" />
            <span>Mitigating Factors ({mitigating.length})</span>
          </div>
          {mitigating.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No mitigating infrastructure factors identified.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {mitigating.map((factor, idx) => (
                <li
                  key={idx}
                  className="text-xs text-foreground bg-background/80 rounded-lg p-2 border border-emerald-500/15 flex items-start gap-1.5"
                >
                  <span className="text-emerald-500 font-bold text-[10px] mt-0.5">✓</span>
                  <span className="leading-snug">{factor}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3. Supporting Evidence */}
      {supporting.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-3.5">
          <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-xs">
            <HelpCircle className="h-4 w-4" />
            <span>Supporting Context ({supporting.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {supporting.map((item, idx) => (
              <Badge
                key={idx}
                variant="outline"
                onClick={() => onSelectEvidence?.(item)}
                className="text-[11px] bg-background border-border/80 text-foreground py-1 px-2 cursor-pointer hover:border-primary/50"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 4. Conflicting Intelligence */}
      {conflicts.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4" />
            <span>Conflicting Provider Intelligence ({conflicts.length})</span>
          </div>
          <div className="space-y-1.5">
            {conflicts.map((conflict, idx) => (
              <div key={idx} className="bg-background/90 rounded-xl p-2.5 border border-amber-500/20 text-xs">
                <p className="font-semibold text-foreground">{conflict.conflictSummary}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Target: <span className="font-mono">{conflict.target}</span>. Disagreement preserved without discarding signals.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Missing Intelligence Sources */}
      {missing.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-border/70 bg-background p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
            <FileQuestion className="h-3.5 w-3.5" />
            <span>Missing / Unconfigured Sources ({missing.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {missing.map((src, idx) => (
              <Badge key={idx} variant="outline" className="text-[10px] bg-secondary/50 text-muted-foreground border-border">
                {src}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
