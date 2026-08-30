import { memo } from "react";
import { Link } from "react-router-dom";
import {
  KeyRound,
  Shield,
  ShieldCheck,
  ExternalLink,
  Lock,
  ArrowRight,
  DatabaseZap,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings";

interface IntegrationService {
  id: string;
  name: string;
  category: "reputation" | "threat-intel" | "network" | "infrastructure";
  description: string;
  website: string;
  freeTier: string;
  docsUrl: string;
  envVar: string;
  privacy: "Direct API Query" | "Proxied Lookup";
}

const SUPPORTED_INTEGRATIONS: IntegrationService[] = [
  {
    id: "virustotal",
    name: "VirusTotal",
    category: "reputation",
    description: "Multi-engine malware, domain, URL, and file hash analysis aggregating 70+ antivirus scanners.",
    website: "https://virustotal.com",
    freeTier: "Free Public API (500 requests/day, 4 req/min)",
    docsUrl: "https://developers.virustotal.com/reference/overview",
    envVar: "VITE_VIRUSTOTAL_KEY",
    privacy: "Direct API Query",
  },
  {
    id: "urlscan",
    name: "URLScan.io",
    category: "threat-intel",
    description: "Automated URL sandbox execution, DOM analysis, IP relationship mapping, and screenshot intelligence.",
    website: "https://urlscan.io",
    freeTier: "Free Community API (5,000 public scans/month)",
    docsUrl: "https://urlscan.io/docs/api/",
    envVar: "VITE_URLSCAN_KEY",
    privacy: "Direct API Query",
  },
  {
    id: "abuseipdb",
    name: "AbuseIPDB",
    category: "reputation",
    description: "Crowdsourced IP reputation database identifying malicious addresses engaged in spam, DDoS, and port scans.",
    website: "https://abuseipdb.com",
    freeTier: "Free Webmaster API (1,000 checks/day)",
    docsUrl: "https://docs.abuseipdb.com/",
    envVar: "VITE_ABUSEIPDB_KEY",
    privacy: "Direct API Query",
  },
  {
    id: "safebrowsing",
    name: "Google Safe Browsing",
    category: "threat-intel",
    description: "Google's threat intelligence API identifying malware, unwanted software, and social engineering domains.",
    website: "https://safebrowsing.google.com",
    freeTier: "Free API with standard quota (10,000 req/day)",
    docsUrl: "https://developers.google.com/safe-browsing/v4/lookup-api",
    envVar: "VITE_SAFEBROWSING_KEY",
    privacy: "Direct API Query",
  },
  {
    id: "ipinfo",
    name: "IPinfo.io",
    category: "network",
    description: "High-accuracy IP geolocation, autonomous system (ASN) organization details, and hosting infrastructure.",
    website: "https://ipinfo.io",
    freeTier: "Free Core API (50,000 requests/month)",
    docsUrl: "https://ipinfo.io/developers",
    envVar: "VITE_IPINFO_TOKEN",
    privacy: "Direct API Query",
  },
  {
    id: "urlvoid",
    name: "URLVoid",
    category: "reputation",
    description: "Reputation cross-referencing engine querying multiple domain blocklists and web safety engines.",
    website: "https://urlvoid.com",
    freeTier: "Free Tier Available with API Key",
    docsUrl: "https://www.urlvoid.com/api/",
    envVar: "VITE_URLVOID_KEY",
    privacy: "Direct API Query",
  },
];

const IntegrationsScreen = memo(function IntegrationsScreen() {
  const settings = useSettings();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-3 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <KeyRound className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                External Integrations
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-primary/30 bg-primary/10 text-primary">
                  BYOK Model
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Bring Your Own Key (BYOK) for third-party OSINT and threat intelligence providers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/sources">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary">
                <DatabaseZap className="h-3.5 w-3.5" />
                <span>Intelligence Feeds</span>
              </Button>
            </Link>
            <Link to="/privacy-settings">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Privacy & Settings</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Security & Privacy Guarantee Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>100% Free Core Functionality</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ScanIQ operates fully offline without any API keys. Local heuristics, DNS lookups, RDAP, and crt.sh require no registration.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>Client-Side Key Storage</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When configured, your personal API keys stay strictly on your device inside LocalStorage / environment variables.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Shield className="h-4 w-4 text-amber-500" />
              <span>Opt-In Network Execution</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              External lookups are blocked until global external consent is explicitly granted in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Global Lookup Status Pill */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${settings.externalLookupsOptedIn ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <div>
            <div className="text-xs font-bold text-foreground">
              Global External Intelligence Status: {settings.externalLookupsOptedIn ? "Enabled" : "Disabled (Local Sandbox Mode)"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {settings.externalLookupsOptedIn
                ? "Configured provider endpoints will be queried when an investigation is launched."
                : "All outbound requests are blocked. ScanIQ runs strictly client-side heuristics."}
            </div>
          </div>
        </div>
        <Link to="/privacy-settings">
          <Button variant="outline" size="sm" className="text-xs h-8 border-border">
            Configure Consent
          </Button>
        </Link>
      </div>

      {/* Integrations Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            Supported Intelligence Providers ({SUPPORTED_INTEGRATIONS.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            Configure via <code className="text-primary font-mono text-[11px]">.env.local</code> or Settings
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUPPORTED_INTEGRATIONS.map((service) => {
            const hasEnvKey = Boolean(import.meta.env[service.envVar]);
            const isConfigured = hasEnvKey || Boolean(settings.apiKeys?.[service.id]);

            return (
              <div
                key={service.id}
                className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-colors space-y-3.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{service.name}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-mono bg-secondary/40">
                          {service.category}
                        </Badge>
                      </div>
                      <a
                        href={service.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        <span>{service.website.replace("https://", "")}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium flex items-center gap-1 ${
                        isConfigured
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground bg-secondary/50"
                      }`}
                    >
                      {isConfigured ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Configured</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          <span>Unconfigured</span>
                        </>
                      )}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="text-muted-foreground">Free Tier:</span>
                    <span className="text-foreground font-medium">{service.freeTier}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="text-muted-foreground">Env Variable:</span>
                    <code className="text-primary font-mono text-[10px] bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                      {service.envVar}
                    </code>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <a
                      href={service.docsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>API Documentation</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>

                    <Link to="/privacy-settings">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                        <span>Manage in Settings</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default IntegrationsScreen;
