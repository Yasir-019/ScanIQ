import React from "react";
import {
  Globe,
  Link2,
  Calendar,
  Building,
  Server,
  ShieldAlert,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationReport } from "@/lib/scan/types";

interface UrlDomainSectionProps {
  report: InvestigationReport;
}

export function UrlDomainSection({ report }: UrlDomainSectionProps) {
  const url = report.targets.urls[0];
  const domainIntel = report.domainIntel;
  const primaryDomain = report.targets.domains[0] || url?.domain;

  return (
    <div className="space-y-4">
      {/* 1. URL Intelligence */}
      {url ? (
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">URL Intelligence</h3>
              <p className="text-[11px] text-muted-foreground">Normalized structure and query parameters.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/70 bg-background p-3 space-y-1 sm:col-span-2">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Destination URI</span>
              <p className="font-mono text-xs text-foreground break-all">
                {url.scheme}://{url.fqdn || url.domain}{url.port ? `:${url.port}` : ""}{url.path}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-2.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Protocol</span>
              <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                {url.scheme.toUpperCase()}
                {url.scheme === "https" ? (
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    TLS Encrypted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                    Unencrypted
                  </Badge>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-2.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Host / Port</span>
              <p className="font-semibold text-foreground mt-0.5 font-mono">
                {url.fqdn || url.domain} {url.port ? `(Port ${url.port})` : "(Standard 443/80)"}
              </p>
            </div>

            {url.path && (
              <div className="rounded-xl border border-border/70 bg-background p-2.5 sm:col-span-2">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Path</span>
                <p className="font-mono text-xs text-foreground break-all mt-0.5">
                  {url.path}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 2. Domain Intelligence (RDAP / Whois) */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Domain Registration Intelligence (RDAP)</h3>
            <p className="text-[11px] text-muted-foreground">Authoritative registry information and domain age.</p>
          </div>
        </div>

        {!primaryDomain ? (
          <p className="text-xs text-muted-foreground italic">No apex domain extracted from this payload.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-border/70 bg-background p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Apex Domain
                </span>
                <p className="font-bold text-sm text-foreground mt-0.5 font-mono">{primaryDomain}</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Building className="h-3 w-3" /> Registrar
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  {domainIntel.registrar || "Not published / RDAP private"}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Domain Age
                </span>
                <p className="font-semibold text-foreground mt-0.5">
                  {domainIntel.ageDays !== undefined ? `${domainIntel.ageDays} days old` : "Unknown / Unresolved"}
                </p>
              </div>
            </div>

            {/* Nameservers and Registration Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {domainIntel.nameservers && domainIntel.nameservers.length > 0 && (
                <div className="rounded-xl border border-border/70 bg-background p-3 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                    <Server className="h-3 w-3" /> Authoritative Nameservers
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {domainIntel.nameservers.map((ns, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">
                        {ns}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/70 bg-background p-3 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Registration Privacy Notice
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {domainIntel.whoisRedacted
                    ? "Registrant details are redacted per GDPR / ICANN privacy policies. Note: Privacy protection is standard for legitimate organizations and is not considered malicious."
                    : "Public registrant data observed."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
