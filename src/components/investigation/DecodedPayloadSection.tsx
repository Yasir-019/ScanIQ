import { useState } from "react";
import {
  FileCode,
  Copy,
  ExternalLink,
  ShieldAlert,
  Lock,
  Globe,
  Hash,
  Mail,
  Phone,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InvestigationReport } from "@/lib/scan/types";
import { toast } from "sonner";

interface DecodedPayloadSectionProps {
  report: InvestigationReport;
}

export function DecodedPayloadSection({ report }: DecodedPayloadSectionProps) {
  const [copied, setCopied] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [urlToOpen, setUrlToOpen] = useState<string | null>(null);

  const payload = report.payloadAnalysis;
  const raw = report.rawContent;
  const targets = report.targets;
  const isElevatedRisk = report.finalRisk.overall === "high" || report.finalRisk.overall === "critical";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      toast.success("Payload copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy payload");
    }
  };

  const handleOpenPrompt = (url: string) => {
    setUrlToOpen(url);
    if (isElevatedRisk) {
      setShowWarningModal(true);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const confirmOpen = () => {
    if (urlToOpen) {
      window.open(urlToOpen, "_blank", "noopener,noreferrer");
      setShowWarningModal(false);
      setUrlToOpen(null);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileCode className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Decoded Payload</h3>
            <p className="text-[11px] text-muted-foreground">Original scan content and extracted entities.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs">
            {copied ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Raw Payload Display (Safe Sandbox view) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Raw Decoded String</span>
          <span>{payload.size} bytes · Entropy: {payload.entropy.toFixed(2)}</span>
        </div>
        <pre className="max-h-48 overflow-auto break-all rounded-2xl border border-border bg-background p-3.5 font-mono text-xs text-foreground/90 leading-relaxed select-all">
          {raw}
        </pre>
      </div>

      {/* Structural Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="rounded-xl border border-border/70 bg-background p-2.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Format</span>
          <p className="font-semibold text-foreground mt-0.5">{report.format.replace(/_/g, " ")}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-2.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Content Type</span>
          <p className="font-semibold text-foreground mt-0.5">{report.contentType.toUpperCase()}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-2.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Credentials</span>
          <p className="font-semibold mt-0.5">
            {payload.hasCredentialsEmbedded ? (
              <span className="text-destructive flex items-center gap-1"><Lock className="h-3 w-3" /> Embedded</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">None</span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background p-2.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Obfuscation</span>
          <p className="font-semibold mt-0.5">
            {payload.hasObfuscation ? (
              <span className="text-amber-500">Detected</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">None</span>
            )}
          </p>
        </div>
      </div>

      {/* Extracted Entities */}
      <div className="space-y-2 pt-1 border-t border-border/50">
        <h4 className="text-xs font-semibold text-foreground">Extracted Targets & Entities</h4>
        <div className="flex flex-wrap gap-2">
          {targets.urls.map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary font-mono"
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-xs">{u.scheme}://{u.fqdn || u.domain}{u.path}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenPrompt(`${u.scheme}://${u.fqdn || u.domain}${u.port ? `:${u.port}` : ""}${u.path}`)}
                className="h-5 w-5 p-0 hover:bg-primary/20"
                title="Inspect / Open Target"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {targets.domains.map((d, i) => (
            <Badge key={i} variant="outline" className="text-xs font-mono py-1 px-2">
              <Hash className="mr-1 h-3 w-3" /> {d}
            </Badge>
          ))}

          {targets.emails.map((e, i) => (
            <Badge key={i} variant="outline" className="text-xs font-mono py-1 px-2">
              <Mail className="mr-1 h-3 w-3" /> {e}
            </Badge>
          ))}

          {targets.phoneNumbers.map((p, i) => (
            <Badge key={i} variant="outline" className="text-xs font-mono py-1 px-2">
              <Phone className="mr-1 h-3 w-3" /> {p}
            </Badge>
          ))}
        </div>
      </div>

      {/* Warning Confirmation Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/15">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">Security Warning: High Risk Destination</h4>
                <p className="text-xs text-muted-foreground">ScanIQ identified significant threat indicators.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs space-y-1 text-foreground">
              <p className="font-semibold text-destructive">{report.finalRisk.verdict}</p>
              <p className="text-muted-foreground">{report.finalRisk.explanation}</p>
              <p className="font-mono text-[11px] break-all pt-1 text-foreground">
                Target: {urlToOpen}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Opening this URL in a live browser may expose your credentials, trigger malware download, or compromise security.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowWarningModal(false)}>
                Cancel (Recommended)
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmOpen}>
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
