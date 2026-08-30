import { useState, useMemo } from "react";
import {
  Network,
  Globe,
  Server,
  Building,
  MapPin,
  ShieldAlert,
  FileCode,
  Link,
  Lock,
  ArrowRight,
  Info,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type {
  UnifiedInvestigationModel,
} from "@/lib/investigation/synthesis-types";
import { cn } from "@/lib/utils";

interface InvestigationGraphViewerProps {
  synthesis?: UnifiedInvestigationModel;
}

const nodeTypeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  qr_code: { label: "QR Barcode", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary" },
  barcode: { label: "Barcode", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary" },
  payload: { label: "Payload", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary" },
  url: { label: "URL", icon: Link, colorClass: "border-blue-500/40 bg-blue-500/10 text-blue-500" },
  domain: { label: "Apex Domain", icon: Globe, colorClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-500" },
  subdomain: { label: "Subdomain", icon: Globe, colorClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" },
  ip: { label: "IP Address", icon: Server, colorClass: "border-purple-500/40 bg-purple-500/10 text-purple-500" },
  asn: { label: "Autonomous System", icon: Building, colorClass: "border-orange-500/40 bg-orange-500/10 text-orange-500" },
  organization: { label: "Organization", icon: Building, colorClass: "border-orange-500/40 bg-orange-500/10 text-orange-500" },
  registrar: { label: "Registrar", icon: Building, colorClass: "border-teal-500/40 bg-teal-500/10 text-teal-500" },
  nameserver: { label: "Nameserver", icon: Server, colorClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-500" },
  certificate: { label: "TLS Certificate", icon: Lock, colorClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  location: { label: "Geolocation", icon: MapPin, colorClass: "border-pink-500/40 bg-pink-500/10 text-pink-500" },
  threat_indicator: { label: "Threat Match", icon: ShieldAlert, colorClass: "border-destructive/40 bg-destructive/10 text-destructive" },
};

export function InvestigationGraphViewer({ synthesis }: InvestigationGraphViewerProps) {
  const nodes = useMemo(() => synthesis?.graph?.nodes || [], [synthesis?.graph?.nodes]);
  const edges = useMemo(() => synthesis?.graph?.edges || [], [synthesis?.graph?.edges]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredNodes = useMemo(() => {
    if (!filterQuery.trim()) return nodes;
    const q = filterQuery.toLowerCase();
    return nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        (n.sublabel && n.sublabel.toLowerCase().includes(q)) ||
        n.type.toLowerCase().includes(q) ||
        n.sources.some((s) => s.toLowerCase().includes(q))
    );
  }, [nodes, filterQuery]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || filteredNodes[0];
  const connectedEdges = edges.filter(
    (e) => e.source === selectedNode?.id || e.target === selectedNode?.id
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header & Graph Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Multi-Hop Entity Correlation Graph</h3>
            <p className="text-[11px] text-muted-foreground">
              Evidence-backed graph synthesis connecting payloads, domains, infrastructure, and indicators.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50">
            {nodes.length} Nodes
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50">
            {edges.length} Relationships
          </Badge>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-1">
          <Network className="mx-auto h-7 w-7 opacity-40 text-primary" />
          <p className="font-semibold text-foreground">No Graph Entities Synthesized</p>
          <p>This payload does not contain multi-hop network or infrastructure targets.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Entity Node Matrix */}
          <div className="lg:col-span-2 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter entities by name, type, source..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredNodes.map((node) => {
                const meta = nodeTypeMeta[node.type] || nodeTypeMeta.payload;
                const Icon = meta.icon;
                const isSelected = node.id === (selectedNode?.id || selectedNodeId);

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all space-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                        : "border-border bg-background hover:bg-secondary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <div className={cn("p-1 rounded-md border shrink-0", meta.colorClass)}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground truncate">
                          {meta.label}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal shrink-0">
                        {node.freshness || "current"}
                      </Badge>
                    </div>

                    <p className="font-semibold text-xs text-foreground truncate">{node.label}</p>
                    {node.sublabel && (
                      <p className="text-[10px] text-muted-foreground truncate">{node.sublabel}</p>
                    )}

                    <div className="text-[9px] text-muted-foreground/80 pt-1 border-t border-border/40 flex justify-between font-mono">
                      <span className="truncate max-w-[65%]">Src: {node.sources.join(", ")}</span>
                      <span>Conf: {Math.round((node.confidence || 1.0) * 100)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Node Inspector & Relationships Panel */}
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
              <Info className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-bold text-foreground">Entity Inspector</h4>
            </div>

            {selectedNode ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Entity Identifier</span>
                  <p className="font-mono text-xs font-semibold text-foreground break-all mt-0.5">
                    {selectedNode.id}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Label & Value</span>
                  <p className="font-medium text-foreground mt-0.5">{selectedNode.label}</p>
                  {selectedNode.sublabel && (
                    <p className="text-muted-foreground text-[11px] mt-0.5">{selectedNode.sublabel}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Sources & Lineage</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.sources.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-mono bg-secondary/50">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Connected Edges ({connectedEdges.length})
                  </span>
                  {connectedEdges.length === 0 ? (
                    <p className="text-muted-foreground text-[11px] italic">No direct relationships linked to this node.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {connectedEdges.map((e) => (
                        <li
                          key={e.id}
                          className="p-2 rounded-lg border border-border/60 bg-card text-[11px] space-y-0.5"
                        >
                          <div className="flex items-center gap-1 font-semibold text-primary">
                            <span className="truncate">{e.source.split(":")[0]}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="text-foreground text-[10px] font-mono">{e.label || e.type}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.target.split(":")[0]}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate font-mono">
                            Target: {e.target}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Select an entity node to inspect details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
