import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  LockKeyhole,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/lib/settings";
import {
  OSINT_SOURCES,
  listSourcesByCategory,
  type OsintSource,
  type SourceCategory,
} from "@/lib/osint/sources";
import { cn } from "@/lib/utils";

const catIcon: Record<SourceCategory, React.ComponentType<{ className?: string }>> = {
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
  dns: "DNS",
  whois: "WHOIS",
  rdap: "RDAP",
  asn: "ASN / Hosting",
  geolocation: "Geolocation",
  certificate: "Certificates / CT",
  reputation: "Reputation Engines",
  blocklist: "Blocklists",
  redirect: "Redirect Tracing",
  "brand-protection": "Brand Protection",
  product: "Product Codes",
  payment: "Payment Schemes",
};

const privacyIcon: Record<OsintSource["privacy"], React.ComponentType<{ className?: string }>> = {
  local: ShieldCheck,
  offline: BadgeCheck,
  direct: Wifi,
  proxied: LockKeyhole,
};

const privacyLabel: Record<OsintSource["privacy"], string> = {
  local: "Local only",
  offline: "Offline DB",
  direct: "Direct network",
  proxied: "Proxied",
};

function SourceRow({ src, onChange, enabled, hasAuth }: {
  src: OsintSource;
  onChange: (v: boolean) => void;
  enabled: boolean;
  hasAuth: boolean;
}) {
  const [open, setOpen] = useState(false);
  const PrivIcon = privacyIcon[src.privacy];
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-card transition",
        enabled ? "border-primary/30 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
          aria-expanded={open}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              enabled ? "bg-primary/20 text-primary" : "bg-secondary/40 text-muted-foreground",
            )}
          >
            <DatabaseZap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{src.name}</span>
              {src.privacy === "local" || src.privacy === "offline" ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">
                  <ShieldCheck className="mr-1 h-3 w-3" /> {privacyLabel[src.privacy]}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
                  <Wifi className="mr-1 h-3 w-3" /> {privacyLabel[src.privacy]}
                </Badge>
              )}
              {src.requiresAuth && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-[10px]",
                    hasAuth
                      ? "border-success/30 bg-success/5 text-success"
                      : "border-destructive/30 bg-destructive/5 text-destructive",
                  )}
                >
                  <LockKeyhole className="mr-1 h-3 w-3" />
                  {hasAuth ? "configured" : "key required"}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {src.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
            <Switch
              checked={enabled && (!src.requiresAuth || hasAuth)}
              disabled={src.userToggleable === false || (src.requiresAuth && !hasAuth)}
              onCheckedChange={onChange}
              aria-label={`Enable ${src.name}`}
            />
          </div>
        </button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/60 p-3 pt-3 text-xs">
          <p className="text-muted-foreground leading-relaxed">{src.description}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-background p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Privacy Model
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-semibold">
                <PrivIcon className="h-3.5 w-3.5" /> {privacyLabel[src.privacy]}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Scopes
              </div>
              <div className="mt-0.5 truncate font-mono text-[10px]">
                {src.scope.join(", ")}
              </div>
            </div>
            {src.rateLimitHints && (
              <div className="col-span-2 rounded-xl border border-border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rate limits
                </div>
                <div className="mt-0.5">{src.rateLimitHints}</div>
              </div>
            )}
            {src.envKey && (
              <div className="col-span-2 rounded-xl border border-border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Environment key
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <code className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">
                    {src.envKey}
                  </code>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Set this variable in your Vite env (.env.production / .env.local).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
            <div className="col-span-2 flex flex-wrap gap-2">
              {src.homepage && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full text-[10px]"
                >
                  <a href={src.homepage} target="_blank" rel="noreferrer noopener nofollow">
                    <ExternalLink className="mr-1 h-3 w-3" /> Homepage
                  </a>
                </Button>
              )}
              {src.terms && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full text-[10px]"
                >
                  <a href={src.terms} target="_blank" rel="noreferrer noopener nofollow">
                    Terms
                  </a>
                </Button>
              )}
              {src.privacyPolicy && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full text-[10px]"
                >
                  <a href={src.privacyPolicy} target="_blank" rel="noreferrer noopener nofollow">
                    Privacy Policy
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SourcesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sourceToggles = useSettings((s) => s.sourceToggles);
  const resetToggles = useSettings((s) => s.resetSourceToggles);
  const externalOpted = useSettings((s) => s.externalLookupsOptedIn);
  const set = useSettings((s) => s.set);
  const [tab, setTab] = useState<"all" | "network" | "reputation" | "local">("all");

  const authEnv = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const s of OSINT_SOURCES) if (s.envKey) out[s.envKey] = !!import.meta.env[s.envKey];
    return out;
  }, []);

  const shownSources = useMemo(() => {
    switch (tab) {
      case "local":
        return OSINT_SOURCES.filter((s) => s.privacy === "local" || s.privacy === "offline");
      case "network":
        return OSINT_SOURCES.filter(
          (s) => s.privacy === "direct" || s.privacy === "proxied",
        );
      case "reputation":
        return listSourcesByCategory("reputation").concat(listSourcesByCategory("blocklist"));
      default:
        return OSINT_SOURCES;
    }
  }, [tab]);

  const grouped = useMemo(() => {
    const map = new Map<SourceCategory, OsintSource[]>();
    for (const s of shownSources) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [shownSources]);

  const enabledCount = Object.values(sourceToggles).filter(Boolean).length;
  const networkCount = OSINT_SOURCES.filter(
    (s) => s.privacy !== "local" && s.privacy !== "offline" && sourceToggles[s.id],
  ).length;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back", "Back")}
            </button>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-primary" />
              <span>{t("sources.title", "Intelligence Sources & Feed Registry")}</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {t(
                "sources.subtitle",
                "Enable providers you trust. All lookups are user-controlled and opt-in per provider.",
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToggles}
            className="h-8 text-xs text-muted-foreground rounded-xl"
          >
            Reset Defaults
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DatabaseZap className="h-3.5 w-3.5" /> Enabled
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {enabledCount} <span className="text-xs font-medium text-muted-foreground">/ {OSINT_SOURCES.length}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wifi className="h-3.5 w-3.5" /> Network outbound
            </div>
            <div
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                networkCount > 0 ? "text-warning" : "text-success",
              )}
            >
              {networkCount}
            </div>
          </div>
        </div>

        {!externalOpted && networkCount > 0 && (
          <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-warning">
                  External lookups require explicit consent.
                </p>
                <p className="mt-0.5 text-warning/80">
                  These sources will make network requests revealing the scanned
                  target (domain, IP, URL) to third parties. Enable the global opt-in
                  in Privacy &amp; Settings before network sources will execute.
                </p>
                <Button
                  size="sm"
                  className="mt-2 h-8 rounded-xl text-[11px]"
                  onClick={() => navigate("/privacy-settings")}
                >
                  Review consent
                </Button>
              </div>
            </div>
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 rounded-2xl">
            <TabsTrigger value="all" className="rounded-xl text-xs">All</TabsTrigger>
            <TabsTrigger value="local" className="rounded-xl text-xs">Local</TabsTrigger>
            <TabsTrigger value="network" className="rounded-xl text-xs">Network</TabsTrigger>
            <TabsTrigger value="reputation" className="rounded-xl text-xs">Reputation</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-3 space-y-3">
            <SourceGroups
              grouped={grouped}
              toggles={sourceToggles}
              authEnv={authEnv}
              set={set}
            />
          </TabsContent>
          <TabsContent value="local" className="mt-3 space-y-3">
            <SourceGroups
              grouped={grouped}
              toggles={sourceToggles}
              authEnv={authEnv}
              set={set}
            />
          </TabsContent>
          <TabsContent value="network" className="mt-3 space-y-3">
            <SourceGroups
              grouped={grouped}
              toggles={sourceToggles}
              authEnv={authEnv}
              set={set}
            />
          </TabsContent>
          <TabsContent value="reputation" className="mt-3 space-y-3">
            <SourceGroups
              grouped={grouped}
              toggles={sourceToggles}
              authEnv={authEnv}
              set={set}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SourceGroups({
  grouped,
  toggles,
  authEnv,
  set,
}: {
  grouped: [SourceCategory, OsintSource[]][];
  toggles: Record<string, boolean>;
  authEnv: Record<string, boolean>;
  set: (patch: Partial<{ sourceToggles: Record<string, boolean> }>) => void;
}) {
  return (
    <div className="space-y-4">
      {grouped.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          No sources in this group.
        </div>
      ) : (
        grouped.map(([cat, sources]) => {
          const Icon = catIcon[cat];
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {catLabel[cat]}
                </h2>
                <span className="text-[10px] text-muted-foreground">· {sources.length}</span>
              </div>
              <div className="space-y-2">
                {sources.map((s) => (
                  <SourceRow
                    key={s.id}
                    src={s}
                    enabled={!!toggles[s.id]}
                    hasAuth={s.envKey ? !!authEnv[s.envKey] : true}
                    onChange={(v) =>
                      set({ sourceToggles: { ...toggles, [s.id]: v } })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
