import React from "react";
import {
  ShieldAlert,
  DatabaseZap,
  ExternalLink,
  Info,
} from "lucide-react";
import type { InvestigationReport, ReputationResult } from "@/lib/scan/types";
import { THREAT_PROVIDER_CONFIGS } from "@/lib/investigation/providers/config";
import { ProviderStatusBadge } from "@/components/investigation/CyberBadges";

interface ThreatIntelSectionProps {
  report: InvestigationReport;
}

export function ThreatIntelSection({ report }: ThreatIntelSectionProps) {
  const reputations = report.reputation || [];
  const repBySource = new Map<string, ReputationResult>();
  for (const r of reputations) {
    repBySource.set(r.source, r);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <DatabaseZap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Threat Intelligence Feeds & Provider Matrix</h3>
            <p className="text-[11px] text-muted-foreground">
              Independent verdicts and multi-AV classifications across configured security providers.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THREAT_PROVIDER_CONFIGS.map((prov) => {
          const rep = repBySource.get(prov.id);
          const isConfigured = !report.finalRisk.missingIntelligence?.some((m) =>
            m.toLowerCase().includes(prov.name.toLowerCase()) || m.toLowerCase().includes(prov.id.toLowerCase())
          );

          let statusType: string = "not_configured";
          let customLabel: string | undefined = undefined;

          if (rep) {
            statusType = rep.classification; // 'malicious' | 'suspicious' | 'clean'
            if (rep.score !== undefined) {
              customLabel = `${rep.classification.toUpperCase()} (${rep.score})`;
            }
          } else if (isConfigured) {
            statusType = "clean";
            customLabel = "Ready / Standby";
          }

          return (
            <div key={prov.id} className="rounded-xl border border-border bg-background p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <span>{prov.name}</span>
                </div>
                <ProviderStatusBadge status={statusType} label={customLabel} />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {rep
                  ? rep.threats.join(", ") || rep.categories.join(", ") || "No specific threat detections returned."
                  : prov.description}
              </p>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1.5 border-t border-border/40">
                <span className="font-mono">Category: {prov.category}</span>
                {prov.docsUrl && (
                  <a
                    href={prov.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors text-[10px]"
                  >
                    <span>Documentation</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Defensive Architecture Rule:</span> Unconfigured providers return status <code>not_configured</code> without outbound network requests. Missing external intelligence is recorded transparently and never penalizes the target's risk score.
        </div>
      </div>
    </div>
  );
}
