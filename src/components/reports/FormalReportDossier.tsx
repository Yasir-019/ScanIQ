import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  Shield,
  Layers,
  AlertTriangle,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
  Hash,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge, EvidenceNatureBadge } from "@/components/investigation/CyberBadges";
import type { InvestigationReport } from "@/lib/scan/types";
import { toast } from "sonner";
import { scanTypeLabel } from "@/lib/osint/risk";
import { sanitizeObject } from "@/lib/investigation/sanitization";
import { cn } from "@/lib/utils";

interface FormalReportDossierProps {
  isOpen: boolean;
  onClose: () => void;
  report: InvestigationReport;
}

export function FormalReportDossier({ isOpen, onClose, report }: FormalReportDossierProps) {
  const [copied, setCopied] = useState(false);
  const [payloadHash, setPayloadHash] = useState<string>("");
  const [reportHash, setReportHash] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    technical: false,
    evidence: true,
    sources: true,
    limitations: false,
  });

  // Calculate SHA-256 integrity hashes
  useEffect(() => {
    async function calcHashes() {
      try {
        const encoder = new TextEncoder();
        
        // 1. Target payload hash
        const payloadData = encoder.encode(report.rawContent || "");
        const payloadBuf = await crypto.subtle.digest("SHA-256", payloadData);
        const pHash = Array.from(new Uint8Array(payloadBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setPayloadHash(pHash);

        // 2. Full report canonical representation hash
        const canonical = JSON.stringify({
          id: report.id,
          caseId: report.caseId,
          content: report.rawContent,
          verdict: report.finalRisk.verdict,
          score: report.finalRisk.numeric,
          findings: report.findings.map((f) => ({ id: f.id, sev: f.severity })),
        });
        const repData = encoder.encode(canonical);
        const repBuf = await crypto.subtle.digest("SHA-256", repData);
        const rHash = Array.from(new Uint8Array(repBuf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setReportHash(rHash);
      } catch {
        setPayloadHash("SHA-256 calculation unavailable");
        setReportHash("SHA-256 calculation unavailable");
      }
    }
    if (isOpen) {
      calcHashes();
    }
  }, [isOpen, report]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Structured sources matrix
  const sourcesCoverage = useMemo(() => {
    const usedSources: { name: string; status: "analyzed" | "not_configured" | "disabled" | "skipped"; detail: string }[] = [];

    // Local Analysis
    usedSources.push({
      name: "Local Symbology & Heuristics",
      status: "analyzed",
      detail: "Client-side WASM heuristic parser and entropy analyzer.",
    });

    // DNS
    if (report.hostIntel && report.hostIntel.length > 0) {
      usedSources.push({
        name: "DNS-over-HTTPS (1.1.1.1 / Quad9)",
        status: "analyzed",
        detail: `Resolved ${report.hostIntel.length} host records.`,
      });
    } else if (report.targets.domains.length > 0) {
      usedSources.push({
        name: "DNS-over-HTTPS",
        status: "skipped",
        detail: "No active DNS resolution responses.",
      });
    }

    // RDAP
    if (report.domainIntel.registrar) {
      usedSources.push({
        name: "RDAP Registration Directory",
        status: "analyzed",
        detail: `Registrar: ${report.domainIntel.registrar}`,
      });
    }

    // Reputation Feeds
    if (report.reputation && report.reputation.length > 0) {
      for (const repItem of report.reputation) {
        usedSources.push({
          name: repItem.source,
          status: "analyzed",
          detail: `Classification: ${repItem.classification.toUpperCase()} (Threats: ${repItem.threats?.join(", ") || "None"})`,
        });
      }
    }

    // Missing intelligence from risk summary
    if (report.finalRisk.missingIntelligence) {
      for (const m of report.finalRisk.missingIntelligence) {
        usedSources.push({
          name: m,
          status: "not_configured",
          detail: "API key not configured in BYOK Integrations.",
        });
      }
    }

    return usedSources;
  }, [report]);

  if (!isOpen) return null;

  const handleDownloadJson = () => {
    try {
      const sanitized = sanitizeObject({
        scanIqVersion: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        reportIntegrityHash: reportHash,
        caseId: report.caseId || report.id,
        investigationId: report.id,
        createdAt: new Date(report.createdAt).toISOString(),
        status: report.status,
        format: report.format,
        contentType: report.contentType,
        rawContent: report.rawContent,
        payloadSha256: payloadHash,
        targets: report.targets,
        executiveSummary: {
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
        sourcesCoverage,
        payloadAnalysis: report.payloadAnalysis,
        domainIntelligence: report.domainIntel,
        infrastructureIntelligence: report.hostIntel,
        threatIntelligence: report.reputation,
        evidenceFindings: report.findings,
        analysisLimitations: [
          "Static inspection and network OSINT queries only. No active browser exploit execution.",
          "Unconfigured external providers were skipped and not evaluated.",
          "Results reflect point-in-time state at observation time.",
        ],
        synthesis: report.synthesis,
      });

      const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scaniq-report-${report.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Structured report JSON downloaded");
    } catch {
      toast.error("Failed to download JSON report");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = [
        `# ScanIQ Cyber Intelligence Report`,
        `**Case ID:** ${report.caseId || report.id} | **Investigation ID:** ${report.id}`,
        `**Generated:** ${new Date().toLocaleString()} | **Payload SHA-256:** \`${payloadHash}\``,
        `**Format:** ${report.format} | **Content Type:** ${scanTypeLabel(report.contentType)}`,
        ``,
        `---`,
        ``,
        `## 1. Executive Summary & Verdict`,
        `* **Threat Level:** ${report.finalRisk.overall.toUpperCase()} (${report.finalRisk.numeric}/100)`,
        `* **Evidence Confidence:** ${(report.finalRisk.confidenceLevel || "MEDIUM").toUpperCase()} (${Math.round((report.finalRisk.confidenceScore ?? report.finalRisk.confidence) * 100)}%)`,
        `* **Verdict:** ${report.finalRisk.verdict}`,
        `* **Executive Assessment:** ${report.finalRisk.explanation}`,
        ``,
        `## 2. Target & Decoded Input`,
        `\`\`\``,
        `${report.rawContent}`,
        `\`\`\``,
        ``,
        `## 3. Primary Risk Drivers & Mitigating Evidence`,
        `### Primary Drivers`,
        ...(report.finalRisk.primaryDrivers?.map((d) => `* [!] ${d}`) || ["* No adverse indicators detected."]),
        `### Mitigating Factors`,
        ...(report.finalRisk.mitigatingFactors?.map((m) => `* [✓] ${m}`) || ["* None recorded."]),
        ``,
        `## 4. Key Findings (${report.findings.length} findings)`,
        ...report.findings.map(
          (f) => `* **[${f.severity.toUpperCase()}]** ${f.title} — *${f.summary}* (Source: ${f.references?.join(", ") || "Local"})`
        ),
        ``,
        `## 5. Intelligence Sources Coverage`,
        ...sourcesCoverage.map(
          (s) => `* [${s.status === "analyzed" ? "✓" : "—"}] **${s.name}**: ${s.detail}`
        ),
        ``,
        `## 6. Analysis Limitations`,
        `* Static analysis and network OSINT queries only. No active browser exploit execution.`,
        `* Point-in-time observation without persistent monitoring.`,
        ``,
        `## 7. Cryptographic Integrity`,
        `* **Report Digest (SHA-256):** \`${reportHash}\``,
      ].join("\n");

      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("Markdown report copied to clipboard");
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
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-sm sm:text-base font-bold text-foreground">
                Investigation Report & Evidence Dossier
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                Case #{report.caseId || report.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyMarkdown}
              className="h-8 text-xs rounded-xl border-border"
            >
              {copied ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy Markdown"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="h-8 text-xs rounded-xl border-border"
            >
              <Download className="mr-1 h-3 w-3" />
              <span>Download JSON</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs rounded-xl border-border bg-secondary/50 font-semibold"
            >
              <Printer className="mr-1 h-3 w-3" />
              <span>Print / PDF</span>
            </Button>
            <button
              onClick={onClose}
              aria-label="Close report modal"
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE / FORMAL REPORT BODY                                            */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-2 font-sans bg-background p-5 sm:p-7 rounded-2xl border border-border/80 text-xs">
          {/* Header Banner */}
          <div className="border-b-2 border-primary pb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-foreground uppercase">
                  ScanIQ Cyber Intelligence Report
                </span>
                <Badge variant="outline" className="text-[9px] uppercase font-mono border-primary/40 bg-primary/10 text-primary">
                  Official Record
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                Case ID: <span className="text-foreground font-semibold">{report.caseId || report.id}</span> · Investigation: <span className="text-foreground">{report.id}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Report Timestamp</span>
              <p className="font-mono text-xs text-foreground font-semibold">
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Section 1: Executive Summary & Threat Verdict */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/60 pb-1">
              <Shield className="h-3.5 w-3.5" />
              <span>1. Executive Summary & Verdict</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl border border-border bg-card">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Assessed Threat Level</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <SeverityBadge severity={report.finalRisk.overall} className="text-xs" />
                  <span className="font-mono text-sm font-extrabold text-foreground">
                    {report.finalRisk.numeric}/100
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Evidence Confidence</span>
                <p className="text-xs font-bold text-foreground mt-0.5 uppercase">
                  {report.finalRisk.confidenceLevel || "MEDIUM"} ({Math.round((report.finalRisk.confidenceScore ?? report.finalRisk.confidence) * 100)}%)
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Investigation Status</span>
                <p className="text-xs font-semibold text-foreground mt-0.5 uppercase font-mono">
                  {report.status}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-border bg-card space-y-1.5">
              <div className="font-bold text-sm text-foreground">{report.finalRisk.verdict}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {report.finalRisk.explanation}
              </p>
            </div>
          </div>

          {/* Section 2: Target & Decoded Input */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/60 pb-1">
              <Layers className="h-3.5 w-3.5" />
              <span>2. Target & Decoded Input</span>
            </h3>

            <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Format:</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{report.format}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px]">Content Type:</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{scanTypeLabel(report.contentType)}</Badge>
                </div>
              </div>

              <pre className="p-3 rounded-xl bg-secondary/50 font-mono text-xs break-all leading-relaxed whitespace-pre-wrap text-foreground">
                {report.rawContent}
              </pre>

              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span>SHA-256: {payloadHash || "Calculating…"}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Risk Drivers & Mitigating Evidence */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/60 pb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>3. Risk Drivers & Mitigating Factors</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2">
                <span className="font-bold text-destructive text-xs uppercase tracking-wider">Primary Risk Drivers</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  {report.finalRisk.primaryDrivers && report.finalRisk.primaryDrivers.length > 0 ? (
                    report.finalRisk.primaryDrivers.map((d, i) => (
                      <li key={i}><span className="text-foreground font-medium">{d}</span></li>
                    ))
                  ) : (
                    <li>No adverse threat drivers identified.</li>
                  )}
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider">Mitigating Factors</span>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                  {report.finalRisk.mitigatingFactors && report.finalRisk.mitigatingFactors.length > 0 ? (
                    report.finalRisk.mitigatingFactors.map((m, i) => (
                      <li key={i}><span className="text-foreground font-medium">{m}</span></li>
                    ))
                  ) : (
                    <li>No specific mitigating factors recorded.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Key Findings with Source Attribution */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>4. Evidence Findings ({report.findings.length} Observations)</span>
              </h3>
              <button
                onClick={() => toggleSection("evidence")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <span>{expandedSections.evidence ? "Collapse" : "Expand"}</span>
                {expandedSections.evidence ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {expandedSections.evidence && (
              <div className="space-y-2">
                {report.findings.map((f) => (
                  <div key={f.id} className="p-3 rounded-2xl border border-border bg-card space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-foreground text-xs">{f.title}</span>
                        <SeverityBadge severity={f.severity} className="text-[9px]" />
                        <EvidenceNatureBadge nature={f.nature} />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                        ID: {f.id}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.summary}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80 font-mono pt-1 border-t border-border/40">
                      <span>Source: {f.references?.join(", ") || "Local Engine"}</span>
                      <span>·</span>
                      <span>Confidence: {Math.round(f.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Intelligence Coverage Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                <span>5. Intelligence Sources Coverage Matrix</span>
              </h3>
              <button
                onClick={() => toggleSection("sources")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <span>{expandedSections.sources ? "Collapse" : "Expand"}</span>
                {expandedSections.sources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {expandedSections.sources && (
              <div className="p-3.5 rounded-2xl border border-border bg-card space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Explicit record of sources queried during this run. Unconfigured feeds are explicitly listed and never treated as clean results.
                </p>
                <div className="space-y-1.5 pt-1">
                  {sourcesCoverage.map((src, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-secondary/30 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-mono",
                            src.status === "analyzed"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border bg-secondary/50 text-muted-foreground"
                          )}
                        >
                          {src.status === "analyzed" ? "✓ Analyzed" : "— Not Configured"}
                        </Badge>
                        <span className="font-semibold text-foreground">{src.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{src.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Analysis Limitations & Scope */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-border/60 pb-1">
              <Info className="h-3.5 w-3.5" />
              <span>6. Analysis Scope & Limitations</span>
            </h3>

            <div className="p-3.5 rounded-2xl border border-border bg-card space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              <ul className="list-disc list-inside space-y-1">
                <li>Static heuristic inspection and network OSINT queries only. No active sandbox exploit execution.</li>
                <li>Absence of adverse indicators does not guarantee safety against novel or zero-day phishing campaigns.</li>
                <li>Third-party threat intelligence queries represent point-in-time public records.</li>
              </ul>
            </div>
          </div>

          {/* Section 7: Report Metadata & Cryptographic Provenance */}
          <div className="p-4 rounded-2xl border border-border bg-secondary/30 space-y-2 text-[11px]">
            <div className="flex items-center justify-between font-mono text-muted-foreground">
              <span>Report Engine: ScanIQ Community v1.0.0</span>
              <span>Zero-Telemetry Local Record</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground break-all">
              <span className="font-bold text-foreground">Report Canonical Digest (SHA-256): </span>
              {reportHash || "Computing…"}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 shrink-0 print:hidden">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs rounded-xl">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
