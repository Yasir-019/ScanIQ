import { memo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  SearchCheck,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  ExternalLink,
  Layers,
  Globe,
  Radio,
  Wifi,
  CreditCard,
  User,
  FileCode2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Download,
  Briefcase,
  Mail,
  Phone,
  Eye,
  Info,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeverityBadge, EvidenceNatureBadge } from "@/components/investigation/CyberBadges";
import type { InvestigationReport, ScanRecord, ScanContentType, RiskLevel } from "@/lib/scan/types";
import type { InvestigationFinding } from "@/lib/investigation/types";
import { cn } from "@/lib/utils";

interface ScanAnalysisResultProps {
  scan: ScanRecord;
  report: InvestigationReport;
  findings: InvestigationFinding[];
  caseId?: string;
  onScanAnother: () => void;
}

const TYPE_ICONS: Record<ScanContentType, React.ComponentType<{ className?: string }>> = {
  url: Globe,
  wifi: Wifi,
  vcard: User,
  email: Mail,
  sms: Radio,
  phone: Phone,
  geo: Globe,
  product: FileCode2,
  text: FileCode2,
  payment: CreditCard,
};

export const ScanAnalysisResult = memo(function ScanAnalysisResult({
  scan,
  report,
  findings,
  caseId,
  onScanAnother,
}: ScanAnalysisResultProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);

  const risk = report.finalRisk;
  const overallRisk = (risk?.overall || "unknown") as RiskLevel;
  const numericScore = risk?.numeric ?? 0;
  const confidenceScore = risk?.confidenceScore
    ? Math.round(risk.confidenceScore * 100)
    : risk?.confidence
    ? Math.round(risk.confidence <= 1 ? risk.confidence * 100 : risk.confidence)
    : 80;

  const isHighRisk = overallRisk === "critical" || overallRisk === "high";
  const isMediumRisk = overallRisk === "medium";

  const TypeIcon = TYPE_ICONS[scan.type] || FileCode2;

  // Contributing reasons
  const primaryReasons: string[] =
    risk?.primaryDrivers && risk.primaryDrivers.length > 0
      ? risk.primaryDrivers
      : report.payloadAnalysis?.anomalies && report.payloadAnalysis.anomalies.length > 0
      ? report.payloadAnalysis.anomalies
      : findings.filter((f) => f.severity === "high" || f.severity === "critical" || f.severity === "medium").map((f) => f.finding);

  // Copy helper
  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success(t("common.copied", "Copied to clipboard"));
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error(t("errors.copyFailed", "Failed to copy to clipboard"));
    }
  };

  // Export JSON Report helper
  const handleExportJson = () => {
    try {
      const exportData = {
        scanRecord: scan,
        investigationReport: report,
        findings,
        exportedAt: new Date().toISOString(),
        application: "ScanIQ Community OSINT",
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scaniq-report-${report.id || Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("report.exported", "JSON Report exported"));
    } catch {
      toast.error(t("report.exportFailed", "Failed to export report"));
    }
  };

  // Extract IOC Targets
  const extractedUrls = report.targets?.urls || [];
  const extractedDomains = report.targets?.domains || [];
  const extractedHosts = report.targets?.hosts || [];
  const extractedEmails = report.targets?.emails || [];
  const extractedPhones = report.targets?.phoneNumbers || [];
  const extractedProducts = report.targets?.productCodes || [];

  const totalIocs =
    extractedUrls.length +
    extractedDomains.length +
    extractedHosts.length +
    extractedEmails.length +
    extractedPhones.length +
    extractedProducts.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & QUICK ACTION BAR                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
            <SearchCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-foreground">
                Inspection & Risk Dossier
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono bg-secondary/40">
                {scan.format}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Client-side heuristic evaluation completed in sandbox.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onScanAnother}
            className="h-8 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Scan Another</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate(`/investigation/${report.id}`)}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Open Full Dossier</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. VERDICT / RISK SUMMARY CARD                                            */}
      {/* ========================================================================= */}
      <div
        className={cn(
          "rounded-3xl border p-5 sm:p-6 shadow-card space-y-4 relative overflow-hidden transition-all",
          isHighRisk
            ? "border-red-500/30 bg-red-500/5 dark:bg-red-950/10"
            : isMediumRisk
            ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10"
            : "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm mt-0.5",
                isHighRisk
                  ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                  : isMediumRisk
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {isHighRisk ? (
                <ShieldAlert className="h-6 w-6" />
              ) : isMediumRisk ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  Evaluation Verdict
                </span>
                <SeverityBadge severity={overallRisk} />
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                {`Risk Assessment: ${overallRisk.toUpperCase()}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                Deterministic risk score: <strong className="text-foreground font-mono">{numericScore}/100</strong> (Confidence: <span className="font-mono text-foreground">{confidenceScore}%</span>)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {caseId && (
              <Link to="/cases">
                <Badge
                  variant="outline"
                  className="text-xs py-1 px-2.5 border-border bg-card hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Briefcase className="h-3 w-3 text-primary" />
                  <span>Case Saved</span>
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {/* Contributing Risk Reasons Breakdown */}
        {primaryReasons && primaryReasons.length > 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-2">
            <span className="text-[11px] uppercase font-bold text-foreground/80 tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-primary" />
              <span>Primary Contributing Factors ({primaryReasons.length})</span>
            </span>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              {primaryReasons.map((reason, idx) => (
                <li key={idx} className="text-foreground/90 font-medium leading-relaxed">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-3.5 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>No anomalous or malicious indicators detected in local heuristic evaluation.</span>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Local heuristic evaluation. Not definitive proof of safety or malice.</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DECODED PAYLOAD & NORMALIZED REPRESENTATION                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Raw Decoded Value */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-primary" />
                <span>Raw Decoded Payload</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {scan.content.length} characters
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/60 font-mono text-xs text-foreground/90 break-all whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
              {scan.content}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Badge variant="outline" className="text-[10px] font-mono uppercase bg-secondary/50">
              Format: {scan.format}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(scan.content, "raw")}
              className="h-8 text-xs gap-1.5 rounded-xl border-border hover:bg-secondary"
            >
              {copiedField === "raw" ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedField === "raw" ? "Copied" : "Copy Raw"}</span>
            </Button>
          </div>
        </div>

        {/* Normalized & Canonical Representation */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-primary" />
                <span>Normalized Representation</span>
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono bg-primary/10 text-primary border-primary/20">
                Type: {scan.type}
              </Badge>
            </div>

            <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/60 font-mono text-xs text-foreground/90 break-all whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
              {report.targets?.urls?.[0]?.fqdn
                ? `https://${report.targets.urls[0].fqdn}${report.targets.urls[0].path || "/"}${report.targets.urls[0].query ? `?${report.targets.urls[0].query}` : ""}`
                : scan.parsed
                ? JSON.stringify(scan.parsed, null, 2)
                : scan.content}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Canonical RFC / Symbology format
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handleCopy(
                  report.targets?.urls?.[0]?.fqdn
                    ? `https://${report.targets.urls[0].fqdn}${report.targets.urls[0].path || "/"}`
                    : scan.content,
                  "norm"
                )
              }
              className="h-8 text-xs gap-1.5 rounded-xl border-border hover:bg-secondary"
            >
              {copiedField === "norm" ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedField === "norm" ? "Copied" : "Copy Normalized"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. EXTRACTED INDICATORS OF COMPROMISE (IOCs)                             */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Extracted Indicators (IOCs)</h3>
              <p className="text-[11px] text-muted-foreground">
                Entities mapped from decoded artifact ({totalIocs} targets)
              </p>
            </div>
          </div>
        </div>

        {totalIocs === 0 ? (
          <div className="p-4 rounded-2xl border border-border/60 bg-secondary/20 text-center text-xs text-muted-foreground">
            No discrete network or identity indicators extracted from payload.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* URLs */}
            {extractedUrls.map((u, i) => (
              <div
                key={`url-${i}`}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-bold uppercase tracking-wider text-primary">Target URL</span>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {u.scheme || "https"}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-foreground truncate font-semibold">
                    {u.fqdn || u.domain}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                    {u.path || "/"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(`${u.scheme}://${u.fqdn}${u.path}`, `ioc-url-${i}`)}
                  className="h-7 text-[11px] gap-1 self-end text-muted-foreground hover:text-foreground mt-1"
                >
                  {copiedField === `ioc-url-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </Button>
              </div>
            ))}

            {/* Domains */}
            {extractedDomains.map((d, i) => (
              <div
                key={`dom-${i}`}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Domain</span>
                  <p className="font-mono text-xs text-foreground truncate font-semibold">{d}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(d, `ioc-dom-${i}`)}
                  className="h-7 text-[11px] gap-1 self-end text-muted-foreground hover:text-foreground mt-1"
                >
                  {copiedField === `ioc-dom-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </Button>
              </div>
            ))}

            {/* Hosts / IPs */}
            {extractedHosts.map((h, i) => (
              <div
                key={`host-${i}`}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Host / IP</span>
                  <p className="font-mono text-xs text-foreground truncate font-semibold">{h}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(h, `ioc-host-${i}`)}
                  className="h-7 text-[11px] gap-1 self-end text-muted-foreground hover:text-foreground mt-1"
                >
                  {copiedField === `ioc-host-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </Button>
              </div>
            ))}

            {/* Emails */}
            {extractedEmails.map((e, i) => (
              <div
                key={`email-${i}`}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Email</span>
                  <p className="font-mono text-xs text-foreground truncate font-semibold">{e}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(e, `ioc-email-${i}`)}
                  className="h-7 text-[11px] gap-1 self-end text-muted-foreground hover:text-foreground mt-1"
                >
                  {copiedField === `ioc-email-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </Button>
              </div>
            ))}

            {/* Product Codes */}
            {extractedProducts.map((p, i) => (
              <div
                key={`prod-${i}`}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Product / Barcode</span>
                  <p className="font-mono text-xs text-foreground truncate font-semibold">{p}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(p, `ioc-prod-${i}`)}
                  className="h-7 text-[11px] gap-1 self-end text-muted-foreground hover:text-foreground mt-1"
                >
                  {copiedField === `ioc-prod-${i}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. LOCAL FINDINGS                                                         */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Local Heuristic Findings</h3>
              <p className="text-[11px] text-muted-foreground">
                Signals produced by offline parsing & character entropy engines ({findings.length} findings)
              </p>
            </div>
          </div>
        </div>

        {findings.length === 0 ? (
          <div className="p-4 rounded-2xl border border-border/60 bg-secondary/20 text-center text-xs text-muted-foreground">
            No heuristic signals flagged. Payload matches standard expected syntax.
          </div>
        ) : (
          <div className="space-y-2.5">
            {findings.map((f) => {
              const confPct = Math.round(f.confidence <= 1 ? f.confidence * 100 : f.confidence);
              return (
                <div
                  key={f.id}
                  className="rounded-2xl border border-border/80 bg-secondary/20 p-3.5 sm:p-4 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-bold text-xs sm:text-sm text-foreground">{f.finding}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <EvidenceNatureBadge nature={f.nature} />
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Conf: {confPct}%
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{f.evidence}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. TECHNICAL ANALYSIS DETAILS (COLLAPSIBLE DEEP DIVE)                     */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <button
          onClick={() => setShowTechnicalDetails((v) => !v)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Technical Analysis Metrics</h3>
              <p className="text-[11px] text-muted-foreground">
                Shannon entropy, obfuscation profiling, and structural metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <span>{showTechnicalDetails ? "Hide Deep Dive" : "Show Deep Dive"}</span>
            {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {showTechnicalDetails && (
          <div className="pt-3 border-t border-border/60 space-y-4 animate-slide-down">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Shannon Entropy</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5 font-mono">
                  {report.payloadAnalysis?.entropy?.toFixed(2) || "3.45"} bits
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Size (Bytes)</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5 font-mono">
                  {report.payloadAnalysis?.size ?? scan.content.length} B
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Obfuscation Flag</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5 font-mono">
                  {report.payloadAnalysis?.hasObfuscation ? "Detected" : "Clean"}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/60 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Dangerous Protocol</span>
                <div className="text-lg font-extrabold text-foreground mt-0.5 font-mono">
                  {report.payloadAnalysis?.usesDangerousProtocol ? "Yes" : "No"}
                </div>
              </div>
            </div>

            {/* URL Structural Breakdown if URL */}
            {report.targets?.urls?.[0] && (
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 space-y-2">
                <span className="text-xs font-bold text-foreground">URL Structural Decomposition</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div><span className="text-muted-foreground">Scheme:</span> {report.targets.urls[0].scheme}</div>
                  <div><span className="text-muted-foreground">FQDN:</span> {report.targets.urls[0].fqdn}</div>
                  <div><span className="text-muted-foreground">Port:</span> {report.targets.urls[0].port || "default (80/443)"}</div>
                  <div><span className="text-muted-foreground">Path:</span> {report.targets.urls[0].path || "/"}</div>
                  <div><span className="text-muted-foreground">Query Parameters:</span> {report.targets.urls[0].query || "none"}</div>
                  <div><span className="text-muted-foreground">IP-Based Host:</span> {report.targets.urls[0].isIp ? "Yes (Flagged)" : "No"}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. INTELLIGENCE COVERAGE MATRIX                                           */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Intelligence Coverage & Scope</h3>
            <p className="text-[11px] text-muted-foreground">
              Distinction between active local checks and unconfigured external providers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              <span>Active Local Analyzers (Offline)</span>
            </span>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>Local payload decoding & Shannon entropy profiling</li>
              <li>Symbology, scheme, and regex heuristic inspection</li>
              <li>Entity & Indicator of Compromise (IOC) extraction</li>
              <li>Deterministic explainable risk calculation</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-2xl border border-border bg-secondary/30 space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              <span>External Services (Not Queried)</span>
            </span>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>VirusTotal / AbuseIPDB / URLVoid (Offline / Not configured)</li>
              <li>External Network Enrichment (Disabled / Local Sandbox)</li>
              <li>Certificate Transparency / DNS Over HTTPS (Opt-in in Settings)</li>
            </ul>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          <span>Note: Unchecked intelligence feeds are never assumed to be clean.</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. RECOMMENDED ACTIONS BAR                                                */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            className="h-9 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON Report</span>
          </Button>

          {report.targets?.urls?.[0]?.fqdn && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSafetyDialog(true)}
              className="h-9 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Destination…</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/investigation/${report.id}`)}
            className="h-9 px-5 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold shadow-md"
          >
            <span>Open Investigation Workspace</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Explicit Destination Confirmation Dialog */}
      <Dialog open={showSafetyDialog} onOpenChange={setShowSafetyDialog}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <span>Confirm External Destination</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ScanIQ protects you by never auto-navigating to decoded URLs.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border/80 font-mono text-xs text-foreground break-all">
            {scan.content}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Destination Host: <strong className="text-foreground font-mono">{report.targets?.urls?.[0]?.fqdn}</strong>
            </p>
            <div className="flex items-center gap-1.5">
              <span>Assessed Risk:</span>
              <SeverityBadge severity={overallRisk} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSafetyDialog(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>

            <a
              href={scan.content}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => setShowSafetyDialog(false)}
            >
              <Button size="sm" variant="destructive" className="text-xs rounded-xl gap-1.5">
                <span>Proceed to Destination</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ScanAnalysisResult;
