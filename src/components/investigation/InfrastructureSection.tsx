import {
  Network,
  Server,
  MapPin,
  Building2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HostIntelligence } from "@/lib/scan/types";

interface InfrastructureSectionProps {
  hosts: HostIntelligence[];
  primaryDomain?: string;
}

export function InfrastructureSection({ hosts, primaryDomain }: InfrastructureSectionProps) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Infrastructure Intelligence</h3>
            <p className="text-[11px] text-muted-foreground">
              Correlated DNS resolutions, IP routing (ASN), and approximate hosting locations.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Pipeline Hierarchy */}
      <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span className="font-mono">{primaryDomain || "Domain"}</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1 text-muted-foreground font-medium">
          <Server className="h-3.5 w-3.5" /> DNS / DoH
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1 text-muted-foreground font-medium">
          <Building2 className="h-3.5 w-3.5" /> IP & ASN
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex items-center gap-1 text-muted-foreground font-medium">
          <MapPin className="h-3.5 w-3.5" /> Approx Geolocation
        </div>
      </div>

      {/* Host Cards */}
      {hosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No external host or IP resolution data collected for this target.
        </div>
      ) : (
        <div className="space-y-3">
          {hosts.map((host, idx) => {
            const locParts = [
              host.geolocation?.city,
              host.geolocation?.region,
              host.geolocation?.country,
            ].filter(Boolean);
            const locStr = locParts.join(", ") || "Unresolved";

            return (
              <div key={idx} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 border-primary/30 text-primary">
                      {host.ip || "Unknown IP"}
                    </Badge>
                    {host.reverseDns && (
                      <span className="text-xs text-muted-foreground font-mono">
                        ({host.reverseDns})
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Infrastructure Host #{idx + 1}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* ASN & Routing Organization */}
                  <div className="rounded-xl border border-border/60 bg-card p-2.5 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Autonomous System (ASN)
                    </span>
                    <p className="font-semibold text-foreground">
                      {host.asn?.number ? `AS${host.asn.number}` : "ASN Unknown"}{" "}
                      {host.asn?.organization ? `· ${host.asn.organization}` : ""}
                    </p>
                  </div>

                  {/* Approximate Infrastructure Geolocation */}
                  <div className="rounded-xl border border-border/60 bg-card p-2.5 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Approximate Infrastructure Geolocation
                    </span>
                    <p className="font-semibold text-foreground">
                      {locStr}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  Note: Geolocation indicates approximate server data center routing and never identifies physical device or owner location.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
