import { useState, useMemo, useEffect } from "react";
import {
  Network,
  Globe,
  Server,
  Building,
  MapPin,
  ShieldAlert,
  FileCode,
  Link as LinkIcon,
  Lock,
  ArrowRight,
  Info,
  Table as TableIcon,
  ExternalLink,
  History,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  UnifiedInvestigationModel,
} from "@/lib/investigation/synthesis-types";
import {
  IocCorrelationService,
  type CrossCaseIocResult,
} from "@/lib/investigation/ioc-correlation";
import { cn } from "@/lib/utils";

interface InvestigationGraphViewerProps {
  synthesis?: UnifiedInvestigationModel;
  currentCaseId?: string;
  onNavigateToCase?: (caseId: string) => void;
}

const nodeTypeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string; bgFill: string; borderStroke: string }
> = {
  qr_code: { label: "Barcode Payload", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary", bgFill: "rgba(59, 130, 246, 0.15)", borderStroke: "#3b82f6" },
  barcode: { label: "Barcode", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary", bgFill: "rgba(59, 130, 246, 0.15)", borderStroke: "#3b82f6" },
  payload: { label: "Payload", icon: FileCode, colorClass: "border-primary/40 bg-primary/10 text-primary", bgFill: "rgba(59, 130, 246, 0.15)", borderStroke: "#3b82f6" },
  url: { label: "URL Target", icon: LinkIcon, colorClass: "border-blue-500/40 bg-blue-500/10 text-blue-500", bgFill: "rgba(59, 130, 246, 0.15)", borderStroke: "#60a5fa" },
  domain: { label: "Domain", icon: Globe, colorClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-500", bgFill: "rgba(99, 102, 241, 0.15)", borderStroke: "#818cf8" },
  subdomain: { label: "Subdomain", icon: Globe, colorClass: "border-indigo-500/40 bg-indigo-500/10 text-indigo-400", bgFill: "rgba(99, 102, 241, 0.12)", borderStroke: "#a5b4fc" },
  ip: { label: "IP Host", icon: Server, colorClass: "border-purple-500/40 bg-purple-500/10 text-purple-500", bgFill: "rgba(168, 85, 247, 0.15)", borderStroke: "#c084fc" },
  asn: { label: "Autonomous System", icon: Building, colorClass: "border-orange-500/40 bg-orange-500/10 text-orange-500", bgFill: "rgba(249, 115, 22, 0.15)", borderStroke: "#fb923c" },
  organization: { label: "Organization", icon: Building, colorClass: "border-orange-500/40 bg-orange-500/10 text-orange-500", bgFill: "rgba(249, 115, 22, 0.15)", borderStroke: "#fb923c" },
  registrar: { label: "Registrar", icon: Building, colorClass: "border-teal-500/40 bg-teal-500/10 text-teal-500", bgFill: "rgba(20, 184, 166, 0.15)", borderStroke: "#2dd4bf" },
  nameserver: { label: "Nameserver", icon: Server, colorClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-500", bgFill: "rgba(6, 182, 212, 0.15)", borderStroke: "#22d3ee" },
  certificate: { label: "TLS Certificate", icon: Lock, colorClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500", bgFill: "rgba(16, 185, 129, 0.15)", borderStroke: "#34d399" },
  location: { label: "Geolocation", icon: MapPin, colorClass: "border-pink-500/40 bg-pink-500/10 text-pink-500", bgFill: "rgba(236, 72, 153, 0.15)", borderStroke: "#f472b6" },
  threat_indicator: { label: "Threat Match", icon: ShieldAlert, colorClass: "border-destructive/40 bg-destructive/10 text-destructive", bgFill: "rgba(239, 68, 68, 0.15)", borderStroke: "#f87171" },
};

export function InvestigationGraphViewer({
  synthesis,
  currentCaseId,
  onNavigateToCase,
}: InvestigationGraphViewerProps) {
  const nodes = useMemo(() => synthesis?.graph?.nodes || [], [synthesis?.graph?.nodes]);
  const edges = useMemo(() => synthesis?.graph?.edges || [], [synthesis?.graph?.edges]);

  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [crossCaseIntel, setCrossCaseIntel] = useState<CrossCaseIocResult | null>(null);
  const [isLoadingCrossCase, setIsLoadingCrossCase] = useState(false);

  // Filter nodes based on type pill
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (typeFilter !== "all") {
      result = result.filter((n) => n.type === typeFilter);
    }
    return result;
  }, [nodes, typeFilter]);

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) ||
    filteredNodes[0] ||
    nodes[0];

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [edges, selectedNode]);

  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNode) return set;
    set.add(selectedNode.id);
    for (const e of connectedEdges) {
      set.add(e.source);
      set.add(e.target);
    }
    return set;
  }, [selectedNode, connectedEdges]);

  // Query cross-case IOC occurrences when selected node changes
  useEffect(() => {
    if (!selectedNode) {
      setCrossCaseIntel(null);
      return;
    }

    let isMounted = true;
    setIsLoadingCrossCase(true);

    IocCorrelationService.correlateIocAcrossCases(selectedNode.label, currentCaseId)
      .then((res) => {
        if (isMounted) {
          setCrossCaseIntel(res);
          setIsLoadingCrossCase(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCrossCaseIntel(null);
          setIsLoadingCrossCase(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNode, currentCaseId]);

  // Compute 2D coordinates for visual graph layout (Hierarchical/Radial positioning)
  const layout = useMemo(() => {
    const width = 640;
    const height = 360;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodePositions = new Map<string, { x: number; y: number }>();
    const total = nodes.length;

    if (total === 1) {
      nodePositions.set(nodes[0].id, { x: centerX, y: centerY });
    } else if (total > 1) {
      // Find root or primary node (payload or url or domain)
      const rootNode =
        nodes.find((n) => n.type === "payload" || n.type === "qr_code" || n.type === "url") ||
        nodes[0];

      nodePositions.set(rootNode.id, { x: centerX, y: centerY });

      const otherNodes = nodes.filter((n) => n.id !== rootNode.id);
      const angleStep = (2 * Math.PI) / Math.max(1, otherNodes.length);
      const radius = Math.min(centerX - 60, centerY - 50, 130);

      otherNodes.forEach((node, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        nodePositions.set(node.id, { x, y });
      });
    }

    return { width, height, nodePositions };
  }, [nodes]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(nodes.map((n) => n.type)));
  }, [nodes]);

  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* 1. Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Investigation Entity & IOC Graph</h3>
            <p className="text-[11px] text-muted-foreground">
              Evidence-derived multi-hop relationships with cross-case IOC intelligence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-secondary/40 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("visual")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                viewMode === "visual"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Network className="h-3 w-3" />
              <span>Topology Graph</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TableIcon className="h-3 w-3" />
              <span>Entity Table</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50">
              {nodes.length} Nodes
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50">
              {edges.length} Edges
            </Badge>
          </div>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground space-y-2">
          <Network className="mx-auto h-8 w-8 opacity-40 text-primary" />
          <p className="font-semibold text-foreground">No Graph Entities Discovered</p>
          <p>This payload does not contain structured network, domain, or IOC relationships.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-xl text-[11px] font-medium transition-colors border",
                typeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
              )}
            >
              All Types ({nodes.length})
            </button>
            {uniqueTypes.map((t) => {
              const meta = nodeTypeMeta[t] || { label: t };
              const count = nodes.filter((n) => n.type === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[11px] font-medium transition-colors border",
                    typeFilter === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Area: Visual SVG Canvas or Table Explorer */}
            <div className="lg:col-span-2 space-y-2.5">
              {viewMode === "visual" ? (
                <div className="relative rounded-2xl border border-border bg-background/80 overflow-hidden shadow-inner flex flex-col items-center justify-center p-2 min-h-[380px]">
                  <svg
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    className="w-full h-full max-h-[380px] select-none"
                  >
                    {/* Background Grid Pattern */}
                    <defs>
                      <pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/40" />
                      </pattern>
                      <marker
                        id="arrowhead"
                        markerWidth="6"
                        markerHeight="4"
                        refX="18"
                        refY="2"
                        orient="auto"
                      >
                        <polygon points="0 0, 6 2, 0 4" fill="currentColor" className="text-primary/70" />
                      </marker>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#graph-grid)" />

                    {/* Edge Lines */}
                    {edges.map((edge) => {
                      const src = layout.nodePositions.get(edge.source);
                      const tgt = layout.nodePositions.get(edge.target);
                      if (!src || !tgt) return null;

                      const isConnectedToSelected =
                        selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);

                      return (
                        <g key={edge.id} className="transition-opacity">
                          <line
                            x1={src.x}
                            y1={src.y}
                            x2={tgt.x}
                            y2={tgt.y}
                            stroke="currentColor"
                            strokeWidth={isConnectedToSelected ? 2 : 1}
                            markerEnd="url(#arrowhead)"
                            className={cn(
                              "transition-colors",
                              isConnectedToSelected
                                ? "text-primary"
                                : "text-border/80 stroke-dasharray-1"
                            )}
                          />
                          {edge.label && (
                            <text
                              x={(src.x + tgt.x) / 2}
                              y={(src.y + tgt.y) / 2 - 4}
                              textAnchor="middle"
                              fontSize="8"
                              className={cn(
                                "font-mono select-none pointer-events-none fill-current",
                                isConnectedToSelected ? "text-primary font-bold" : "text-muted-foreground/60"
                              )}
                            >
                              {edge.label}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Node Circles & Labels */}
                    {nodes.map((node) => {
                      const pos = layout.nodePositions.get(node.id);
                      if (!pos) return null;

                      const isSelected = selectedNode?.id === node.id;
                      const isConnected = connectedNodeIds.has(node.id);
                      const meta = nodeTypeMeta[node.type] || nodeTypeMeta.payload;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          onClick={() => setSelectedNodeId(node.id)}
                          className="cursor-pointer transition-all duration-200"
                        >
                          <circle
                            r={isSelected ? 18 : isConnected ? 14 : 12}
                            fill={meta.bgFill}
                            stroke={isSelected ? "#3b82f6" : meta.borderStroke}
                            strokeWidth={isSelected ? 3 : 1.5}
                            className={cn(
                              "transition-all",
                              isSelected && "filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            )}
                          />
                          <text
                            y={isSelected ? 26 : 22}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight={isSelected ? "bold" : "normal"}
                            className={cn(
                              "font-sans select-none pointer-events-none fill-current",
                              isSelected ? "text-foreground font-bold" : "text-muted-foreground"
                            )}
                          >
                            {node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground font-mono">
                    Click any node to inspect relationships and cross-case IOC occurrences.
                  </p>
                </div>
              ) : (
                /* Table Explorer Mode */
                <div className="rounded-2xl border border-border bg-background overflow-hidden max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 bg-secondary/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        <th className="p-2.5 pl-3">Entity Type</th>
                        <th className="p-2.5">Label / Value</th>
                        <th className="p-2.5">Sources</th>
                        <th className="p-2.5">Confidence</th>
                        <th className="p-2.5 text-right pr-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredNodes.map((node) => {
                        const meta = nodeTypeMeta[node.type] || nodeTypeMeta.payload;
                        const isSelected = selectedNode?.id === node.id;
                        return (
                          <tr
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={cn(
                              "cursor-pointer transition-colors hover:bg-secondary/30",
                              isSelected && "bg-primary/5 font-semibold"
                            )}
                          >
                            <td className="p-2.5 pl-3">
                              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", meta.colorClass)}>
                                {meta.label}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-foreground font-mono truncate max-w-[200px]">
                              {node.label}
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono text-[10px]">
                              {node.sources.join(", ")}
                            </td>
                            <td className="p-2.5 font-mono text-[10px]">
                              {Math.round((node.confidence || 1.0) * 100)}%
                            </td>
                            <td className="p-2.5 text-right pr-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNodeId(node.id);
                                }}
                                className="h-6 text-[10px] px-2 rounded-lg"
                              >
                                Inspect
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Area: Node Inspector & Cross-Case Intelligence Panel */}
            <div className="rounded-2xl border border-border bg-background p-4 space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-foreground">Entity Inspector</h4>
                  </div>
                  {selectedNode && (
                    <Badge variant="outline" className="text-[9px] uppercase font-mono">
                      {selectedNode.type}
                    </Badge>
                  )}
                </div>

                {selectedNode ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Entity Value</span>
                      <p className="font-mono text-xs font-bold text-foreground break-all mt-0.5">
                        {selectedNode.label}
                      </p>
                      {selectedNode.sublabel && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{selectedNode.sublabel}</p>
                      )}
                    </div>

                    {/* Cross-Case IOC Occurrence Alert */}
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          <History className="h-3 w-3 text-primary" />
                          Cross-Case Correlation
                        </span>
                        {isLoadingCrossCase && (
                          <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {crossCaseIntel && crossCaseIntel.occurrences.length > 0 ? (
                        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Observed in {crossCaseIntel.occurrences.length} Investigation Case(s)</span>
                          </div>

                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                            {crossCaseIntel.occurrences.map((occ) => (
                              <div
                                key={occ.caseId}
                                className="p-1.5 rounded-lg border border-border/60 bg-card text-[10px] space-y-0.5 flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-semibold text-foreground truncate max-w-[140px]">{occ.caseLabel}</p>
                                  <p className="text-[9px] text-muted-foreground font-mono">
                                    Risk: {occ.riskLevel} · {new Date(occ.lastObserved).toLocaleDateString()}
                                  </p>
                                </div>
                                {onNavigateToCase && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onNavigateToCase(occ.caseId)}
                                    className="h-5 text-[9px] px-1.5 rounded-md gap-0.5"
                                  >
                                    <span>View</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          No previous cross-case matches found for this indicator.
                        </p>
                      )}
                    </div>

                    {/* Connected Edges */}
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Connected Relationships ({connectedEdges.length})
                      </span>
                      {connectedEdges.length === 0 ? (
                        <p className="text-muted-foreground text-[11px] italic">No direct relationships linked to this node.</p>
                      ) : (
                        <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
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
                  <p className="text-xs text-muted-foreground italic">Select a node from the graph to inspect details.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
