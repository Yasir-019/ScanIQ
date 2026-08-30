import { useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  DatabaseZap,
  Shield,
  Wifi,
  Globe2,
  BadgeCheck,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Network,
  FileSearch,
  CreditCard,
  Package,
  Info,
  KeyRound,
  AlertTriangle,
  ExternalLink,
  Search,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/lib/settings";
import {
  OSINT_SOURCES,
  type OsintSource,
  type SourceArchitecture,
  type SourceCategory,
} from "@/lib/osint/sources";
import { cn } from "@/lib/utils";

const catIcon: Record<SourceCategory, React.ComponentType<{ className?: string }>> = {
  payload: Cpu,
  heuristics: ShieldCheck,
  ioc: Layers,
  dns: Network,
  whois: FileSearch,
  rdap: FileSearch,
  asn: Network,
  geolocation: MapPin,
  certificate: BadgeCheck,
  reputation: ShieldCheck,
  blocklist: ShieldAlert,
  redirect: Globe2,
  "brand-protection": Shield,
  product: Package,
  payment: CreditCard,
};

const catLabel: Record<SourceCategory, string> = {
  payload: "Payload Analysis",
  heuristics: "URL Safety Heuristics",
  ioc: "IOC Extraction",
  dns: "DNS-over-HTTPS",
  whois: "WHOIS Registry",
  rdap: "RDAP Protocols",
  asn: "ASN & Routing",
  geolocation: "IP Geolocation",
  certificate: "Certificates & CT",
  reputation: "Reputation Engines",
  blocklist: "Threat Blocklists",
  redirect: "Redirection Tracing",
  "brand-protection": "Brand Protection",
  product: "Product Identifiers",
  payment: "Payment Schemes",
};

interface SourceCardProps {
  src: OsintSource;
  enabled: boolean;
  isConfigured: boolean;
  onToggle: (v: boolean) => void;
  onSelectDetails: (src: OsintSource) => void;
}

function SourceCard({
  src,
  enabled,
  isConfigured,
  onToggle,
  onSelectDetails,
}: SourceCardProps) {
  const Icon = catIcon[src.category] || DatabaseZap;

  // Access type badge
  const accessTypeBadge =
    src.architecture === "local" ? (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold gap-1"
      >
        <ShieldCheck className="h-3 w-3" />
        <span>Local only</span>
      </Badge>
    ) : src.architecture === "network" ? (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold gap-1"
      >
        <Wifi className="h-3 w-3" />
        <span>Direct network</span>
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold gap-1"
      >
        <KeyRound className="h-3 w-3" />
        <span>Key required</span>
      </Badge>
    );

  // Status badge
  const statusBadge =
    src.architecture === "local" ? (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono"
      >
        Available
      </Badge>
    ) : src.requiresAuth ? (
      isConfigured ? (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono flex items-center gap-1"
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          <span>Connected</span>
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-border bg-secondary/50 text-muted-foreground text-[10px] font-mono"
        >
          Not configured
        </Badge>
      )
    ) : enabled ? (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono"
      >
        Enabled
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-border bg-secondary/50 text-muted-foreground text-[10px] font-mono"
      >
        Disabled
      </Badge>
    );

  const canToggle =
    src.userToggleable && (!src.requiresAuth || isConfigured);

  return (
    <div
      className={cn(
        "rounded-3xl border p-4 sm:p-5 bg-card shadow-sm transition-all flex flex-col justify-between space-y-4 hover:border-primary/40",
        enabled && canToggle ? "border-primary/30 bg-card" : "border-border"
      )}
    >
      <div className="space-y-3">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border mt-0.5",
                src.architecture === "local"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : src.architecture === "network"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm text-foreground truncate">{src.name}</h3>
                {accessTypeBadge}
                {statusBadge}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {catLabel[src.category]}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {src.description}
        </p>

        {/* Destination & Scopes */}
        <div className="space-y-1.5 pt-1">
          {src.destination && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
              <span className="font-semibold text-foreground/80">Target Endpoint:</span>
              <span className="font-mono text-muted-foreground truncate">{src.destination}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Analyzes:</span>
            {src.scope.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="text-[9px] uppercase font-mono py-0 px-1.5 bg-secondary/50 border-border"
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectDetails(src)}
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-xl"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Details</span>
          </Button>

          {src.requiresAuth && !isConfigured && (
            <Link to="/integrations">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl font-medium"
              >
                <KeyRound className="h-3 w-3" />
                <span>Configure Key</span>
              </Button>
            </Link>
          )}
        </div>

        {src.userToggleable ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              {enabled && canToggle ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={enabled && canToggle}
              disabled={!canToggle}
              onCheckedChange={onToggle}
              aria-label={`Toggle ${src.name}`}
            />
          </div>
        ) : (
          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
            Always Active (Offline)
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function SourcesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sourceToggles = useSettings((s) => s.sourceToggles);
  const apiKeys = useSettings((s) => s.apiKeys);
  const resetToggles = useSettings((s) => s.resetSourceToggles);
  const externalOpted = useSettings((s) => s.externalLookupsOptedIn);
  const set = useSettings((s) => s.set);

  const [activeTab, setActiveTab] = useState<"all" | SourceArchitecture>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "enabled" | "key_required" | "connected" | "not_configured">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<OsintSource | null>(null);

  // Check integration configuration status
  const isSourceConfigured = useCallback(
    (src: OsintSource): boolean => {
      if (!src.requiresAuth) return true;
      const hasEnv = src.envKey ? Boolean(import.meta.env[src.envKey]) : false;
      const hasStoredKey = src.requiredIntegrationId
        ? Boolean(apiKeys?.[src.requiredIntegrationId])
        : false;
      return hasEnv || hasStoredKey;
    },
    [apiKeys]
  );

  // Metrics
  const totalCount = OSINT_SOURCES.length;
  const localCount = OSINT_SOURCES.filter((s) => s.architecture === "local").length;
  const networkCount = OSINT_SOURCES.filter((s) => s.architecture === "network").length;
  const reputationCount = OSINT_SOURCES.filter((s) => s.architecture === "reputation").length;

  const enabledCount = OSINT_SOURCES.filter((s) => {
    if (s.architecture === "local") return true;
    return Boolean(sourceToggles[s.id]);
  }).length;

  const connectedIntegrationsCount = OSINT_SOURCES.filter(
    (s) => s.requiresAuth && isSourceConfigured(s)
  ).length;

  // Filtered list
  const filteredSources = useMemo(() => {
    return OSINT_SOURCES.filter((s) => {
      // 1. Architecture Tab Filter
      if (activeTab !== "all" && s.architecture !== activeTab) return false;

      // 2. Secondary Quick Filter
      if (quickFilter === "enabled") {
        if (s.architecture === "local") {
          // local is always active
        } else if (!sourceToggles[s.id]) {
          return false;
        }
      } else if (quickFilter === "key_required") {
        if (!s.requiresAuth) return false;
      } else if (quickFilter === "connected") {
        if (!s.requiresAuth || !isSourceConfigured(s)) return false;
      } else if (quickFilter === "not_configured") {
        if (!s.requiresAuth || isSourceConfigured(s)) return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesc = s.description.toLowerCase().includes(q);
        const matchesCategory = catLabel[s.category].toLowerCase().includes(q);
        const matchesScopes = s.scope.some((sc) => sc.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesCategory && !matchesScopes) {
          return false;
        }
      }

      return true;
    });
  }, [activeTab, quickFilter, searchQuery, sourceToggles, isSourceConfigured]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & NAVIGATION                                                */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("common.back", "Back")}</span>
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <DatabaseZap className="h-6 w-6 text-primary" />
              <span>Intelligence Sources & Capabilities</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Comprehensive registry of local heuristic analyzers, network discovery feeds, and reputation providers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/integrations">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl">
                <KeyRound className="h-3.5 w-3.5" />
                <span>Integrations (BYOK)</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToggles}
              className="h-8 text-xs border-border hover:bg-secondary rounded-xl text-muted-foreground"
            >
              Reset Defaults
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. AGGREGATE SUMMARY METRICS BAR                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Total Sources */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <DatabaseZap className="h-3.5 w-3.5 text-primary" />
              <span>Total Sources</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {totalCount}
            </div>
          </div>

          {/* Enabled Sources */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Enabled Sources</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {enabledCount} <span className="text-xs font-normal text-muted-foreground">/ {totalCount}</span>
            </div>
          </div>

          {/* Local Offline Analyzers */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Local Analysis</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {localCount} <span className="text-xs font-normal text-muted-foreground">(100% Offline)</span>
            </div>
          </div>

          {/* Connected Integrations */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-3.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-blue-500" />
              <span>Integrations</span>
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 font-mono">
              {connectedIntegrationsCount} <span className="text-xs font-normal text-muted-foreground">/ {reputationCount} Keys</span>
            </div>
          </div>
        </div>

        {/* Privacy Notice Banner if external lookups are disabled */}
        {!externalOpted && (
          <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-foreground/90">
                <strong>Local Sandbox Active:</strong> Outbound network lookups are currently held in sandbox. Network and Reputation sources will run only after enabling External Consent.
              </span>
            </div>
            <Link to="/privacy-settings">
              <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 shrink-0 rounded-xl">
                <span>Privacy Settings</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH & QUICK FILTERS                                                 */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sources by name, category, or scope (e.g. DNS, VirusTotal, IP)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-2xl bg-card border-border text-xs"
          />
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={quickFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("all")}
            className="h-8 text-xs rounded-xl"
          >
            All
          </Button>
          <Button
            variant={quickFilter === "enabled" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("enabled")}
            className="h-8 text-xs rounded-xl"
          >
            Enabled
          </Button>
          <Button
            variant={quickFilter === "key_required" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("key_required")}
            className="h-8 text-xs rounded-xl"
          >
            Key Required
          </Button>
          <Button
            variant={quickFilter === "connected" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("connected")}
            className="h-8 text-xs rounded-xl"
          >
            Connected
          </Button>
          <Button
            variant={quickFilter === "not_configured" ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter("not_configured")}
            className="h-8 text-xs rounded-xl"
          >
            Not Configured
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ARCHITECTURE TABS & SOURCES CATALOG                                   */}
      {/* ========================================================================= */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="w-full space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-secondary/60 p-1">
          <TabsTrigger value="all" className="rounded-xl text-xs font-semibold">
            All ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="local" className="rounded-xl text-xs font-semibold">
            Local ({localCount})
          </TabsTrigger>
          <TabsTrigger value="network" className="rounded-xl text-xs font-semibold">
            Network ({networkCount})
          </TabsTrigger>
          <TabsTrigger value="reputation" className="rounded-xl text-xs font-semibold">
            Reputation ({reputationCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {filteredSources.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center space-y-3">
              <DatabaseZap className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">No matching sources found</h3>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search keywords or filter criteria.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setQuickFilter("all");
                  setActiveTab("all");
                }}
                className="text-xs rounded-xl"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((s) => (
                <SourceCard
                  key={s.id}
                  src={s}
                  enabled={Boolean(sourceToggles[s.id])}
                  isConfigured={isSourceConfigured(s)}
                  onToggle={(v) =>
                    set({ sourceToggles: { ...sourceToggles, [s.id]: v } })
                  }
                  onSelectDetails={(source) => setSelectedSource(source)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* 5. SOURCE DETAILS MODAL                                                   */}
      {/* ========================================================================= */}
      {selectedSource && (
        <Dialog open={!!selectedSource} onOpenChange={() => setSelectedSource(null)}>
          <DialogContent className="max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <DialogHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold",
                    selectedSource.architecture === "local"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : selectedSource.architecture === "network"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  )}
                >
                  {selectedSource.architecture === "local"
                    ? "Local Analysis"
                    : selectedSource.architecture === "network"
                    ? "Network Source"
                    : "Reputation / API"}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono bg-secondary/50">
                  Category: {catLabel[selectedSource.category]}
                </Badge>
              </div>

              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                {selectedSource.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedSource.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 text-xs">
              {/* Technical Profile Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Execution Mode
                  </span>
                  <div className="font-semibold text-foreground">
                    {selectedSource.privacy === "local"
                      ? "Client-Side WASM / JS"
                      : selectedSource.privacy === "offline"
                      ? "Bundled Offline DB"
                      : selectedSource.privacy === "proxied"
                      ? "User Proxied Gateway"
                      : "Direct Outbound API Query"}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-secondary/40 border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Target Endpoint
                  </span>
                  <div className="font-mono text-foreground truncate">
                    {selectedSource.destination || "Local Sandbox"}
                  </div>
                </div>
              </div>

              {/* Data Analyzed Scopes */}
              <div className="p-3 rounded-2xl bg-secondary/30 border border-border space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  Analyzed Data Scopes
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedSource.scope.map((sc) => (
                    <Badge
                      key={sc}
                      variant="outline"
                      className="text-[10px] uppercase font-mono bg-background border-border"
                    >
                      {sc}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Privacy Implications Callout */}
              {selectedSource.privacyImplications && (
                <div
                  className={cn(
                    "p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1",
                    selectedSource.architecture === "local"
                      ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  )}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {selectedSource.architecture === "local" ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span>Privacy Implications & Network Visibility</span>
                  </div>
                  <p className="text-[11px] opacity-90">{selectedSource.privacyImplications}</p>
                </div>
              )}

              {/* Rate Limits & Documentation Links */}
              {selectedSource.rateLimitHints && (
                <div className="p-3 rounded-2xl bg-secondary/30 border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Rate Limits & Quota Hints
                  </span>
                  <p className="text-foreground/90 font-mono text-[11px]">
                    {selectedSource.rateLimitHints}
                  </p>
                </div>
              )}

              {/* External Links */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {selectedSource.homepage && (
                  <a
                    href={selectedSource.homepage}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <span>Provider Homepage</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {selectedSource.docsUrl && (
                  <a
                    href={selectedSource.docsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <span>API Documentation</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSource(null)}
                className="text-xs rounded-xl"
              >
                Close
              </Button>

              {selectedSource.requiresAuth && !isSourceConfigured(selectedSource) ? (
                <Link to="/integrations" onClick={() => setSelectedSource(null)}>
                  <Button size="sm" className="text-xs rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Configure in Integrations</span>
                  </Button>
                </Link>
              ) : selectedSource.userToggleable ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {sourceToggles[selectedSource.id] ? "Enabled" : "Disabled"}
                  </span>
                  <Switch
                    checked={Boolean(sourceToggles[selectedSource.id])}
                    onCheckedChange={(v) => {
                      set({ sourceToggles: { ...sourceToggles, [selectedSource.id]: v } });
                    }}
                  />
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
