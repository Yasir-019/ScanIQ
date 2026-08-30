import { useState, useMemo } from "react";
import {
  Activity,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { OsintFinding } from "@/lib/scan/types";
import { cn } from "@/lib/utils";
import {
  SeverityBadge,
  EvidenceNatureBadge,
} from "@/components/investigation/CyberBadges";

interface EvidenceExplorerProps {
  findings: OsintFinding[];
}

const severityOrder: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
  benign: 1,
  unknown: 0,
};

export function EvidenceExplorer({ findings }: EvidenceExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [natureFilter, setNatureFilter] = useState<string>("all");

  const filteredFindings = useMemo(() => {
    return findings
      .filter((f) => {
        // Severity filter
        if (severityFilter !== "all") {
          const sev = f.severity as string;
          if (severityFilter === "informational" && sev !== "benign" && sev !== "informational") return false;
          if (severityFilter !== "informational" && sev !== severityFilter) return false;
        }

        // Nature filter
        if (natureFilter !== "all" && f.nature !== natureFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = f.title.toLowerCase().includes(q);
          const matchSummary = f.summary.toLowerCase().includes(q);
          const matchKind = f.kind.toLowerCase().includes(q);
          const matchSource = f.references?.some((r) => r.toLowerCase().includes(q));
          return matchTitle || matchSummary || matchKind || matchSource;
        }

        return true;
      })
      .sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0));
  }, [findings, severityFilter, natureFilter, searchQuery]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Evidence & Findings Explorer</h3>
            <p className="text-[11px] text-muted-foreground">
              Inspecting {filteredFindings.length} of {findings.length} findings with full lineage.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search findings, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs rounded-xl"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational / Benign</option>
        </select>

        <select
          value={natureFilter}
          onChange={(e) => setNatureFilter(e.target.value)}
          className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Evidence Natures</option>
          <option value="observed_fact">Observed Fact</option>
          <option value="heuristic_indicator">Heuristic Indicator</option>
          <option value="external_intelligence">External Intelligence</option>
          <option value="inferred_conclusion">Inferred Conclusion</option>
        </select>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No findings match your active filters.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFindings.map((f) => {
            const isHigh = f.severity === "critical" || f.severity === "high";

            return (
              <div
                key={f.id}
                className={cn(
                  "p-3.5 rounded-xl border bg-background space-y-2 transition-all",
                  isHigh ? "border-destructive/40 bg-destructive/5" : "border-border/70"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={f.severity} />
                    <Badge variant="outline" className="text-[9px] border-border bg-secondary/50 text-foreground py-0.5 px-2 font-mono">
                      {f.kind.replace(/-/g, " · ")}
                    </Badge>
                    <EvidenceNatureBadge nature={f.nature} />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Confidence: {Math.round(f.confidence * 100)}%
                  </span>
                </div>

                <h4 className="text-xs font-bold text-foreground leading-snug">{f.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.summary}</p>

                {f.references && f.references.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Sources:</span>
                    {f.references.map((r, i) => (
                      <span key={i} className="font-mono bg-secondary/60 px-1.5 py-0.5 rounded text-foreground text-[10px] border border-border/60">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
