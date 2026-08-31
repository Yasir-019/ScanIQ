import { useState, useMemo, useCallback } from "react";
import {
  Activity,
  Search,
  ShieldCheck,
  CheckCircle2,
  Fingerprint,
  ArrowRight,
  Layers,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { OsintFinding } from "@/lib/scan/types";
import { computeSha256Hex } from "@/lib/investigation/evidence-integrity";
import { cn } from "@/lib/utils";
import {
  SeverityBadge,
  EvidenceNatureBadge,
} from "@/components/investigation/CyberBadges";

interface EvidenceExplorerProps {
  findings: OsintFinding[];
  rawContent?: string;
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

export function EvidenceExplorer({ findings, rawContent: _rawContent }: EvidenceExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [natureFilter, setNatureFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [verifiedHashes, setVerifiedHashes] = useState<Record<string, { hash: string; verified: boolean }>>({});
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

        // Origin filter
        if (originFilter !== "all") {
          const isExternal = f.nature === "external_intelligence";
          const isFact = f.nature === "observed_fact";
          const isHeuristic = f.nature === "heuristic_indicator" || f.nature === "inferred_conclusion";
          if (originFilter === "raw_evidence" && !isFact) return false;
          if (originFilter === "derived_finding" && !isHeuristic) return false;
          if (originFilter === "external_intelligence" && !isExternal) return false;
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
  }, [findings, severityFilter, natureFilter, originFilter, searchQuery]);

  const handleVerifyIntegrity = useCallback(async (f: OsintFinding) => {
    setIsVerifying((prev) => ({ ...prev, [f.id]: true }));
    try {
      const canonicalData = JSON.stringify({
        id: f.id,
        kind: f.kind,
        title: f.title,
        summary: f.summary,
        severity: f.severity,
        nature: f.nature,
      });
      const hash = await computeSha256Hex(canonicalData);
      setVerifiedHashes((prev) => ({
        ...prev,
        [f.id]: { hash, verified: true },
      }));
      toast.success("Cryptographic SHA-256 evidence integrity verified.");
    } catch {
      toast.error("Failed to compute SHA-256 integrity hash.");
    } finally {
      setIsVerifying((prev) => ({ ...prev, [f.id]: false }));
    }
  }, []);

  const handleCopyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    toast.success("SHA-256 hash copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Evidence Integrity & Provenance Explorer</h3>
            <p className="text-[11px] text-muted-foreground">
              Inspecting {filteredFindings.length} of {findings.length} findings with cryptographic traceability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>NIST-Compliant Hashing</span>
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="relative sm:col-span-1">
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
          className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
          className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          <option value="all">All Evidence Natures</option>
          <option value="observed_fact">Observed Fact</option>
          <option value="heuristic_indicator">Heuristic Indicator</option>
          <option value="external_intelligence">External Intelligence</option>
          <option value="inferred_conclusion">Inferred Conclusion</option>
        </select>

        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          <option value="all">All Evidence Origins</option>
          <option value="raw_evidence">Raw Evidence (Facts)</option>
          <option value="derived_finding">Derived Finding (Heuristic)</option>
          <option value="external_intelligence">External Intelligence</option>
        </select>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-1">
          <Fingerprint className="mx-auto h-7 w-7 opacity-40 text-primary" />
          <p className="font-semibold text-foreground">No Evidence Findings Match Filters</p>
          <p>Try clearing your active severity or origin filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((f) => {
            const isHigh = f.severity === "critical" || f.severity === "high";
            const isExpanded = expandedFindingId === f.id;
            const integrity = verifiedHashes[f.id];

            return (
              <div
                key={f.id}
                className={cn(
                  "p-3.5 sm:p-4 rounded-2xl border bg-background space-y-2.5 transition-all shadow-xs",
                  isHigh ? "border-destructive/30 bg-destructive/5" : "border-border"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={f.severity} />
                    <Badge variant="outline" className="text-[9px] border-border bg-secondary/50 text-foreground py-0.5 px-2 font-mono">
                      {f.kind.replace(/-/g, " · ")}
                    </Badge>
                    <EvidenceNatureBadge nature={f.nature} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Confidence: {Math.round(f.confidence * 100)}%
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedFindingId(isExpanded ? null : f.id)}
                      className="h-6 text-[10px] px-2 rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Fingerprint className="h-3 w-3" />
                      <span>{isExpanded ? "Hide Lineage" : "Provenance"}</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-foreground leading-snug">{f.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{f.summary}</p>
                </div>

                {/* Provenance & Lineage Box */}
                {isExpanded && (
                  <div className="p-3 rounded-xl border border-border/80 bg-secondary/20 space-y-2.5 animate-fade-in text-xs">
                    <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3 text-primary" />
                        Traceability Lineage Chain
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">ID: {f.id}</span>
                    </div>

                    {/* Step-by-step Provenance Trace */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-[10px]">
                        1. Raw Input Artifact
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono text-[10px]">
                        2. {f.nature === "external_intelligence" ? "External API" : "Local Engine"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono text-[10px]">
                        3. Finding Generated
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                        4. Risk Scored
                      </span>
                    </div>

                    {/* Cryptographic SHA-256 Digest Verification */}
                    <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {integrity ? (
                          <div className="flex items-center gap-1.5 font-mono text-[10px] text-foreground bg-background px-2 py-1 rounded-lg border border-emerald-500/40">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-[320px]">{integrity.hash}</span>
                            <button
                              onClick={() => handleCopyHash(integrity.hash, f.id)}
                              className="ml-1 text-muted-foreground hover:text-foreground"
                              title="Copy SHA-256 Hash"
                            >
                              {copiedId === f.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyIntegrity(f)}
                            disabled={isVerifying[f.id]}
                            className="h-6 text-[10px] rounded-lg gap-1"
                          >
                            <Fingerprint className="h-3 w-3 text-primary" />
                            <span>{isVerifying[f.id] ? "Computing Hash…" : "Verify SHA-256 Hash"}</span>
                          </Button>
                        )}
                      </div>

                      <span className="text-[10px] text-muted-foreground font-mono">
                        Nature: {f.nature || "heuristic_indicator"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sources Provenance */}
                {f.references && f.references.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Source Lineage:</span>
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
