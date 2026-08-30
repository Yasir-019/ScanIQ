import React, { useState, useMemo } from "react";
import {
  Clock,
  Calendar,
  ShieldAlert,
  Server,
  FileCode,
  Globe,
  Radio,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationReport } from "@/lib/scan/types";
import { cn } from "@/lib/utils";

interface TimelineViewerProps {
  report: InvestigationReport;
}

interface TimelineEvent {
  id: string;
  type: "event" | "observation" | "retrieval";
  title: string;
  description: string;
  timestamp: number;
  icon: React.ComponentType<{ className?: string }>;
  source: string;
}

export function TimelineViewer({ report }: TimelineViewerProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const events = useMemo(() => {
    const evts: TimelineEvent[] = [];

    // 1. Initial Scan Event
    evts.push({
      id: "event-scan",
      type: "event",
      title: "Payload Decoded & Case Initiated",
      description: `Target captured and local heuristic inspection completed. Payload format: ${report.format}.`,
      timestamp: report.createdAt,
      icon: FileCode,
      source: "ScanIQ Optical Core",
    });

    // 2. Domain Registration Event (if available from RDAP)
    if (report.domainIntel.createdAt) {
      const regDate = new Date(report.domainIntel.createdAt).getTime();
      if (!isNaN(regDate) && regDate > 0) {
        evts.push({
          id: "event-reg",
          type: "event",
          title: "Authoritative Domain Registration",
          description: `Domain registration recorded by ${report.domainIntel.registrar || "authoritative registry"}.`,
          timestamp: regDate,
          icon: Globe,
          source: "RDAP / Registry",
        });
      }
    }

    // 3. DNS & Infrastructure Resolution Observation
    if (report.hostIntel.length > 0) {
      evts.push({
        id: "event-dns",
        type: "observation",
        title: "DNS & Host Resolution",
        description: `Resolved host target to ${report.hostIntel.length} network IP(s): ${report.hostIntel.map((h) => h.ip).filter(Boolean).join(", ")}.`,
        timestamp: report.updatedAt - 1500,
        icon: Server,
        source: "DNS-over-HTTPS / IPinfo",
      });
    }

    // 4. Provider Observations
    for (const rep of report.reputation) {
      evts.push({
        id: `event-rep-${rep.source}`,
        type: "observation",
        title: `Intelligence Observation: ${rep.source}`,
        description: `Feed classified target as '${rep.classification.toUpperCase()}'. Score: ${rep.score ?? "N/A"}.`,
        timestamp: rep.lastChecked || report.updatedAt - 1000,
        icon: ShieldAlert,
        source: rep.source,
      });
    }

    // 5. Synthesis & Report Generation
    evts.push({
      id: "event-completed",
      type: "retrieval",
      title: "Intelligence Synthesis & Risk Evaluation",
      description: `Correlated findings into explainable verdict '${report.finalRisk.overall.toUpperCase()}' (${report.finalRisk.numeric}/100) with confidence ${Math.round((report.finalRisk.confidenceScore ?? report.finalRisk.confidence) * 100)}%.`,
      timestamp: report.updatedAt,
      icon: Radio,
      source: "Synthesizer & Explainable Risk Engine",
    });

    return evts.sort((a, b) => a.timestamp - b.timestamp);
  }, [report]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return events;
    return events.filter((e) => e.type === typeFilter);
  }, [events, typeFilter]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Chronological Intelligence Timeline</h3>
            <p className="text-[11px] text-muted-foreground">
              Traceable sequence of registration history, scan events, and external intelligence observations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Events ({events.length})</option>
            <option value="event">Lifecycle Events</option>
            <option value="observation">Provider Observations</option>
            <option value="retrieval">Synthesis & Reports</option>
          </select>
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
        {filteredEvents.map((evt) => {
          const Icon = evt.icon;
          const date = new Date(evt.timestamp);
          const dateStr = date.toLocaleDateString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <div key={evt.id} className="relative group">
              {/* Timeline Pin */}
              <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm group-hover:border-primary transition-colors">
                <Icon className="h-3 w-3" />
              </div>

              {/* Event Content Card */}
              <div className="rounded-xl border border-border bg-background p-3.5 space-y-1.5 hover:border-border/90 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-foreground">{evt.title}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] uppercase px-1.5 py-0 font-mono",
                        evt.type === "event"
                          ? "border-primary/30 text-primary bg-primary/5"
                          : evt.type === "observation"
                          ? "border-blue-500/30 text-blue-500 bg-blue-500/5"
                          : "border-purple-500/30 text-purple-500 bg-purple-500/5"
                      )}
                    >
                      {evt.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{dateStr}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{evt.description}</p>
                <div className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/40 flex justify-between font-mono">
                  <span>Source: <span className="font-semibold text-foreground">{evt.source}</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
