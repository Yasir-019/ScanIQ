import { useEffect } from "react";
import {
  Lock,
  Settings,
  Eye,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings";
import { ProviderRegistry } from "@/lib/investigation/providers/registry";
import type { InvestigationReport } from "@/lib/scan/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ProviderControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InvestigationReport;
  onRerun: () => void;
}

export function ProviderControlsModal({
  isOpen,
  onClose,
  report,
  onRerun,
}: ProviderControlsModalProps) {
  const navigate = useNavigate();
  const settings = useSettings();
  const allProviders = ProviderRegistry.list();

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

  const urlTarget = report.targets.urls[0];
  const domainTarget = report.targets.domains[0] || urlTarget?.domain;
  const ipTarget = report.targets.hosts[0];

  const getTargetForProvider = (providerId: string): string => {
    switch (providerId) {
      case "virus-total":
      case "urlscan":
      case "google-safe-browsing":
        return urlTarget ? `URL: ${urlTarget.scheme}://${urlTarget.fqdn || urlTarget.domain}` : `Domain: ${domainTarget || "N/A"}`;
      case "abuseipdb":
      case "ipinfo":
        return ipTarget ? `IP: ${ipTarget}` : "Discovered Host IP";
      case "crtsh-cert":
      case "rdap-domain":
      case "dns-over-https":
        return domainTarget ? `Domain: ${domainTarget}` : "N/A";
      default:
        return "Local payload string";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-controls-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h3 id="provider-controls-title" className="text-sm sm:text-base font-bold text-foreground">
                Intelligence Provider & Privacy Controls
              </h3>
              <p className="text-xs text-muted-foreground">
                Control external query targets, credentials, and source privacy opt-ins.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close provider controls"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Global Consent Banner */}
        <div className="rounded-xl border border-border/80 bg-background p-3.5 flex items-center justify-between gap-3 shrink-0">
          <div>
            <span className="text-xs font-bold text-foreground">Global External Lookups Consent</span>
            <p className="text-[11px] text-muted-foreground">
              When disabled, ScanIQ strictly runs client-side heuristics and blocks all outbound queries.
            </p>
          </div>
          <Switch
            checked={settings.externalLookupsOptedIn}
            onCheckedChange={(checked) => settings.set({ externalLookupsOptedIn: checked })}
            aria-label="Toggle global external lookups consent"
          />
        </div>

        {/* Providers Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registered Intelligence Providers ({allProviders.length})
            </h4>
          </div>

          {allProviders.map((prov) => {
            const isEnabled = settings.sourceToggles[prov.id] ?? true;
            const targetSample = getTargetForProvider(prov.id);
            const isConfigured = prov.checkPrerequisites({
              userConsent: settings.externalLookupsOptedIn,
              isSourceEnabled: isEnabled,
            }).ready;

            return (
              <div
                key={prov.id}
                className={cn(
                  "p-3.5 rounded-xl border bg-background/90 space-y-2 transition-colors",
                  isEnabled ? "border-border" : "border-border/40 opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{prov.name}</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-mono bg-secondary/50">
                      {prov.type} · {prov.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {prov.requiresAuth && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          isConfigured
                            ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                            : "border-amber-500/30 text-amber-600 bg-amber-500/5"
                        )}
                      >
                        <Lock className="h-2.5 w-2.5 mr-1" />
                        {isConfigured ? "Key Configured" : "Requires Key"}
                      </Badge>
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => settings.toggleSource(prov.id, checked)}
                      aria-label={`Toggle ${prov.name}`}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">{prov.description}</p>

                {/* Target Transparency Box */}
                <div className="p-2 rounded-lg bg-secondary/40 border border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <Eye className="h-3 w-3 shrink-0 text-primary" />
                    <span className="font-semibold text-foreground">Target Sent:</span>
                    <span className="font-mono truncate">{targetSample}</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 shrink-0 font-medium">0 image data transmitted</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              navigate("/sources");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="mr-1 h-3.5 w-3.5" /> Manage API Keys in Settings
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs rounded-xl">
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onRerun();
              }}
              className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              Apply & Rerun Analysis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
