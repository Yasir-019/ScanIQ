import React, { useState } from "react";
import {
  Code2,
  Copy,
  Check,
  Server,
  Globe,
  Network,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InvestigationReport } from "@/lib/scan/types";
import { toast } from "sonner";

interface TechnicalDetailsSectionProps {
  report: InvestigationReport;
}

export function TechnicalDetailsSection({ report }: TechnicalDetailsSectionProps) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [activeSubtab, setActiveSubtab] = useState<"dns" | "rdap" | "entities" | "raw">("dns");

  const dnsRecords = report.domainIntel.dns || [];
  const rdap = report.domainIntel;
  const synthesis = report.synthesis as { entities?: Record<string, unknown> } | undefined;

  const handleCopyJson = async () => {
    try {
      const sanitizedReport = {
        id: report.id,
        createdAt: report.createdAt,
        status: report.status,
        targets: report.targets,
        finalRisk: report.finalRisk,
        domainIntel: report.domainIntel,
        hostIntel: report.hostIntel,
        findings: report.findings,
        synthesis: report.synthesis,
      };
      await navigator.clipboard.writeText(JSON.stringify(sanitizedReport, null, 2));
      setCopiedJson(true);
      toast.success("Sanitized investigation JSON copied");
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      toast.error("Failed to copy technical JSON");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Code2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Technical & Raw Inspection</h3>
            <p className="text-[11px] text-muted-foreground">
              Deep-dive structured parameters for cybersecurity analysts.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyJson} className="h-7 text-xs">
          {copiedJson ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
          {copiedJson ? "Copied" : "Copy JSON"}
        </Button>
      </div>

      {/* Subtabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveSubtab("dns")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            activeSubtab === "dns" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
          }`}
        >
          DNS Records ({dnsRecords.length})
        </button>
        <button
          onClick={() => setActiveSubtab("rdap")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            activeSubtab === "rdap" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
          }`}
        >
          RDAP Raw Fields
        </button>
        <button
          onClick={() => setActiveSubtab("entities")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            activeSubtab === "entities" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
          }`}
        >
          Synthesized Entities
        </button>
        <button
          onClick={() => setActiveSubtab("raw")}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            activeSubtab === "raw" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
          }`}
        >
          Sanitized Case JSON
        </button>
      </div>

      {/* 1. DNS Records Table */}
      {activeSubtab === "dns" && (
        <div className="space-y-2">
          {dnsRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No DNS records returned for this host.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-secondary/60 border-b border-border text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Record Type</th>
                    <th className="p-2.5">Value / Target</th>
                    <th className="p-2.5">TTL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dnsRecords.map((rec, i) => (
                    <tr key={i} className="hover:bg-background/80">
                      <td className="p-2.5 font-bold text-primary">{rec.type}</td>
                      <td className="p-2.5 break-all text-foreground">{rec.value}</td>
                      <td className="p-2.5 text-muted-foreground">{rec.ttl ?? "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. RDAP Raw Fields */}
      {activeSubtab === "rdap" && (
        <div className="rounded-2xl border border-border bg-background p-3.5 space-y-2 text-xs">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-xl border border-border/50 bg-card">
              <dt className="font-semibold text-muted-foreground uppercase text-[9px]">Registrar</dt>
              <dd className="font-mono text-foreground mt-0.5">{rdap.registrar || "None"}</dd>
            </div>
            <div className="p-2 rounded-xl border border-border/50 bg-card">
              <dt className="font-semibold text-muted-foreground uppercase text-[9px]">Created Date</dt>
              <dd className="font-mono text-foreground mt-0.5">{rdap.createdAt || "Unknown"}</dd>
            </div>
            <div className="p-2 rounded-xl border border-border/50 bg-card">
              <dt className="font-semibold text-muted-foreground uppercase text-[9px]">Expiration Date</dt>
              <dd className="font-mono text-foreground mt-0.5">{rdap.expiresAt || "Unknown"}</dd>
            </div>
            <div className="p-2 rounded-xl border border-border/50 bg-card">
              <dt className="font-semibold text-muted-foreground uppercase text-[9px]">Statuses</dt>
              <dd className="font-mono text-foreground mt-0.5">{rdap.statuses?.join(", ") || "None"}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* 3. Synthesized Entities */}
      {activeSubtab === "entities" && (
        <div className="space-y-2">
          {!synthesis?.entities ? (
            <p className="text-xs text-muted-foreground italic">No synthesized entity records available.</p>
          ) : (
            <pre className="max-h-72 overflow-auto rounded-2xl border border-border bg-background p-3.5 font-mono text-[11px] text-foreground/90">
              {JSON.stringify(synthesis.entities, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* 4. Full Sanitized JSON */}
      {activeSubtab === "raw" && (
        <pre className="max-h-80 overflow-auto rounded-2xl border border-border bg-background p-3.5 font-mono text-[11px] text-foreground/90 select-all">
          {JSON.stringify(
            {
              id: report.id,
              caseId: report.caseId,
              createdAt: report.createdAt,
              status: report.status,
              targets: report.targets,
              finalRisk: report.finalRisk,
              domainIntel: report.domainIntel,
              hostIntel: report.hostIntel,
              findings: report.findings,
            },
            null,
            2
          )}
        </pre>
      )}
    </div>
  );
}
