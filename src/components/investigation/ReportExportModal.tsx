import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  Shield,
  Layers,
  Globe,
  Network,
  Activity,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InvestigationReport } from "@/lib/scan/types";
import { toast } from "sonner";
import { scanTypeLabel } from "@/lib/osint/risk";
import { sanitizeObject } from "@/lib/investigation/sanitization";

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InvestigationReport;
}

export function ReportExportModal({ isOpen, onClose, report }: ReportExportModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownloadJson = () => {
    try {
      const sanitized = sanitizeObject({
        scanIqVersion: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        caseId: report.caseId || report.id,
        investigationId: report.id,
        createdAt: new Date(report.createdAt).toISOString(),
        status: report.status,
        format: report.format,
        contentType: report.contentType,
        rawContent: report.rawContent,
        targets: report.targets,
        executiveVerdict: {
          riskLevel: report.finalRisk.overall,
          threatScore: report.finalRisk.numeric,
          confidenceScore: report.finalRisk.confidenceScore ?? report.finalRisk.confidence,
          confidenceLevel: report.finalRisk.confidenceLevel || "medium",
          verdict: report.finalRisk.verdict,
          explanation: report.finalRisk.explanation,
        },
        riskDrivers: {
          primaryDrivers: report.finalRisk.primaryDrivers || [],
          supportingEvidence: report.finalRisk.supportingEvidence || [],
          mitigatingFactors: report.finalRisk.mitigatingFactors || [],
          conflictingIntelligence: report.finalRisk.conflictingIntelligence || [],
          missingIntelligence: report.finalRisk.missingIntelligence || [],
        },
        payloadAnalysis: report.payloadAnalysis,
        domainIntelligence: report.domainIntel,
        infrastructureIntelligence: report.hostIntel,
        threatIntelligence: report.reputation,
        evidenceFindings: report.findings,
        synthesis: report.synthesis,
      });

      const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scaniq-investigation-${report.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Investigation report JSON downloaded");
    } catch {
      toast.error("Failed to download JSON");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = [
        `# ScanIQ OSINT Investigation Report`,
        `**Case ID:** ${report.caseId || report.id} | **Investigation ID:** ${report.id}`,
        `**Generated:** ${new Date().toLocaleString()}`,
        `**Format:** ${report.format} | **Content Type:** ${scanTypeLabel(report.contentType)}`,
        ``,
        `## 1. Executive Verdict`,
        `* **Risk Level:** ${report.finalRisk.overall.toUpperCase()}`,
        `* **Threat Score:** ${report.finalRisk.numeric} / 100`,
        `* **Evidence Confidence:** ${typeof report.finalRisk.confidenceLevel === "string" ? report.finalRisk.confidenceLevel.toUpperCase() : "MEDIUM"} (${Math.round((report.finalRisk.confidenceScore ?? report.finalRisk.confidence) * 100)}%)`,
        `* **Verdict:** ${report.finalRisk.verdict}`,
        `* **Rationale:** ${report.finalRisk.explanation}`,
        ``,
        `## 2. Risk Drivers & Mitigating Factors`,
        `### Primary Risk Drivers`,
        ...(report.finalRisk.primaryDrivers?.map((d) => `* [!] ${d}`) || ["* None detected"]),
        ``,
        `### Mitigating Factors`,
        ...(report.finalRisk.mitigatingFactors?.map((m) => `* [✓] ${m}`) || ["* None recorded"]),
        ``,
        `### Missing Intelligence Sources`,
        ...(report.finalRisk.missingIntelligence?.map((m) => `* [?] ${m}`) || ["* All sources configured"]),
        ``,
        `## 3. Decoded Target Payload`,
        `\`\`\``,
        `${report.rawContent}`,
        `\`\`\``,
        ``,
        `## 4. Evidence Log (${report.findings.length} findings)`,
        ...report.findings.map(
          (f) => `* **[${f.severity.toUpperCase()}]** ${f.title} — *${f.summary}* (Source: ${f.references?.join(", ") || "Local"})`
        ),
      ].join("\n");

      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("Markdown dossier copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy report");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 id="dossier-title" className="text-sm sm:text-base font-bold text-foreground">
                Formal Investigation Dossier
              </h3>
              <p className="text-xs text-muted-foreground">
                Export, print, or copy complete evidence-backed report.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyMarkdown} className="h-8 text-xs rounded-xl">
              {copied ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadJson} className="h-8 text-xs rounded-xl">
              <Download className="mr-1 h-3 w-3" /> Download JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs rounded-xl">
              <Printer className="mr-1 h-3 w-3" /> Print
            </Button>
            <button
              onClick={onClose}
              aria-label="Close export modal"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document Preview */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-2 font-sans bg-background p-5 sm:p-6 rounded-xl border border-border/80 text-xs">
          {/* Header Banner */}
          <div className="border-b-2 border-primary pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground uppercase">
                ScanIQ Cyber Intelligence Dossier
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                Case ID: <span className="text-foreground font-semibold">{report.caseId || report.id}</span> · Investigation ID: <span className="text-foreground">{report.id}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Generated Date</span>
              <p className="font-mono text-xs text-foreground font-semibold">{new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* Section 1: Executive Summary & Verdict */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-1">
              1. Executive Verdict & Risk Evaluation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border bg-card">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Threat Level</span>
                <p className="text-sm font-extrabold text-foreground uppercase mt-0.5">
                  {report.finalRisk.overall} ({report.finalRisk.numeric}/100)
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Evidence Confidence</span>
                <p className="text-sm font-extrabold text-foreground uppercase mt-0.5">
                  {report.finalRisk.confidenceLevel || "MEDIUM"} ({Math.round((report.finalRisk.confidenceScore ?? report.finalRisk.confidence) * 100)}%)
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Investigation Status</span>
                <p className="text-xs font-semibold text-foreground mt-0.5 uppercase">
                  {report.status}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card space-y-1">
              <p className="font-bold text-foreground">{report.finalRisk.verdict}</p>
              <p className="text-muted-foreground leading-relaxed">{report.finalRisk.explanation}</p>
            </div>
          </div>

          {/* Section 2: Why Is This Risky? */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-1">
              2. Risk Drivers & Mitigating Evidence
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border bg-card space-y-1.5">
                <span className="font-bold text-destructive text-[11px]">Primary Risk Drivers</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {report.finalRisk.primaryDrivers?.map((d, i) => <li key={i}><span className="text-foreground">{d}</span></li>) || <li>No adverse indicators detected.</li>}
                </ul>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card space-y-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">Mitigating Factors</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {report.finalRisk.mitigatingFactors?.map((m, i) => <li key={i}><span className="text-foreground">{m}</span></li>) || <li>None recorded.</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: Decoded Payload */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-1">
              3. Decoded Target Payload
            </h2>
            <pre className="p-3 rounded-xl border border-border bg-card font-mono text-[11px] break-all leading-relaxed whitespace-pre-wrap">
              {report.rawContent}
            </pre>
          </div>

          {/* Section 4: Domain & Infrastructure */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-1">
              4. Domain & Infrastructure Lineage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Apex Domain</span>
                <p className="font-mono font-bold mt-0.5">{report.targets.domains[0] || "N/A"}</p>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Registrar</span>
                <p className="font-medium mt-0.5">{report.domainIntel.registrar || "Redacted / Unknown"}</p>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-card">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Resolved Hosts</span>
                <p className="font-mono mt-0.5">{report.hostIntel.map((h) => h.ip).join(", ") || "None"}</p>
              </div>
            </div>
          </div>

          {/* Section 5: Evidence Findings */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-1">
              5. Normalized Evidence Base ({report.findings.length} observations)
            </h2>
            <div className="space-y-1.5">
              {report.findings.map((f) => (
                <div key={f.id} className="p-2.5 rounded-xl border border-border bg-card space-y-0.5">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-foreground">{f.title}</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-mono">{f.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{f.summary}</p>
                  <p className="text-[9px] text-muted-foreground/70 font-mono">
                    Source: {f.references?.join(", ") || "Local"} · Confidence: {Math.round(f.confidence * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs rounded-xl">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
