import { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  KeyRound,
  Shield,
  ShieldCheck,
  ExternalLink,
  Lock,
  DatabaseZap,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings";
import {
  IntegrationManager,
  type IntegrationItem,
  type IntegrationProviderId,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";

const categoryBadges: Record<string, { label: string; classes: string }> = {
  reputation: {
    label: "Reputation",
    classes: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  "threat-intel": {
    label: "Threat Intel",
    classes: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  network: {
    label: "Network / ASN",
    classes: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  infrastructure: {
    label: "Infrastructure",
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

const IntegrationsScreen = memo(function IntegrationsScreen() {
  const apiKeys = useSettings((s) => s.apiKeys);
  const sourceToggles = useSettings((s) => s.sourceToggles);
  const externalOpted = useSettings((s) => s.externalLookupsOptedIn);

  // Dialog State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<IntegrationProviderId>("virustotal");
  const [inputKey, setInputKey] = useState("");
  const [showKeyText, setShowKeyText] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<IntegrationProviderId | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Compute all items
  const allIntegrations: IntegrationItem[] = useMemo(() => {
    return IntegrationManager.listAll(apiKeys, sourceToggles);
  }, [apiKeys, sourceToggles]);

  const configuredIntegrations = useMemo(() => {
    return allIntegrations.filter((item) => item.isConfigured);
  }, [allIntegrations]);

  const availableIntegrations = useMemo(() => {
    return allIntegrations.filter((item) => !item.isConfigured);
  }, [allIntegrations]);

  const selectedMeta = useMemo(() => {
    return IntegrationManager.getMetadata(selectedProviderId);
  }, [selectedProviderId]);

  // Open add dialog for specific provider
  const handleOpenAddModal = (providerId?: IntegrationProviderId) => {
    if (providerId) {
      setSelectedProviderId(providerId);
    } else {
      // Find first unconfigured provider, or default to virustotal
      const firstUnconfigured = availableIntegrations[0]?.provider.id || "virustotal";
      setSelectedProviderId(firstUnconfigured);
    }
    setInputKey("");
    setShowKeyText(false);
    setIsAddModalOpen(true);
  };

  // Open update dialog
  const handleOpenUpdateModal = (providerId: IntegrationProviderId) => {
    setSelectedProviderId(providerId);
    setInputKey("");
    setShowKeyText(false);
    setIsAddModalOpen(true);
  };

  // Save / Connect action
  const handleSaveIntegration = async () => {
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      toast.error("Please enter a valid API key.");
      return;
    }

    setIsValidating(true);
    try {
      const testResult = await IntegrationManager.testConnection(selectedProviderId, cleanKey);
      if (testResult.success) {
        IntegrationManager.saveKey(selectedProviderId, cleanKey);
        toast.success(`${selectedMeta?.name || "Provider"} connected successfully!`);
        setIsAddModalOpen(false);
        setInputKey("");
      } else {
        toast.warning(testResult.message || "Key format warning. Stored in settings.");
        IntegrationManager.saveKey(selectedProviderId, cleanKey);
        setIsAddModalOpen(false);
      }
    } catch {
      IntegrationManager.saveKey(selectedProviderId, cleanKey);
      toast.success(`${selectedMeta?.name} key saved.`);
      setIsAddModalOpen(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Test individual connection
  const handleTestConnection = async (providerId: IntegrationProviderId) => {
    setTestingId(providerId);
    try {
      const res = await IntegrationManager.testConnection(providerId);
      if (res.success) {
        toast.success(`Connection verified: ${res.message}`);
      } else {
        toast.error(`Connection check failed: ${res.message}`);
      }
    } catch {
      toast.error("Failed to verify connection.");
    } finally {
      setTestingId(null);
    }
  };

  // Remove action
  const handleRemoveIntegration = (providerId: IntegrationProviderId) => {
    const meta = IntegrationManager.getMetadata(providerId);
    IntegrationManager.removeKey(providerId);
    toast.info(`${meta?.name || "Integration"} removed.`);
    setDeleteConfirmId(null);
  };

  // Toggle switch
  const handleToggle = (providerId: IntegrationProviderId, enabled: boolean) => {
    IntegrationManager.toggleIntegration(providerId, enabled);
    const meta = IntegrationManager.getMetadata(providerId);
    toast.success(`${meta?.name} ${enabled ? "enabled" : "disabled"}.`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. HEADER & TOP CONTROLS                                                  */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/30">
              <KeyRound className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  External Integrations
                </h1>
                <Badge variant="outline" className="text-[10px] uppercase font-mono border-primary/30 bg-primary/10 text-primary">
                  BYOK Model
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Bring Your Own Key (BYOK) for third-party OSINT and threat intelligence providers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleOpenAddModal()}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Integration</span>
            </Button>

            <Link to="/sources">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl">
                <DatabaseZap className="h-3.5 w-3.5" />
                <span>Intelligence Feeds</span>
              </Button>
            </Link>
            <Link to="/privacy-settings">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border hover:bg-secondary rounded-xl">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Privacy & Settings</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Security Model Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>100% Free Core Functionality</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ScanIQ functions completely without API keys. Local heuristics, DNS lookups, RDAP, and crt.sh are 100% free and registrationless.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>Local Isolated Key Storage</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              API credentials remain strictly inside your browser sandbox. Keys are never transmitted to ScanIQ or logged in reports.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Shield className="h-4 w-4 text-amber-500" />
              <span>Opt-In Network Execution</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              External queries are only dispatched when explicitly enabled in your Privacy & Settings workspace.
            </p>
          </div>
        </div>

        {/* Global External Consent Status Pill */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-secondary/40">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${externalOpted ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <div>
              <div className="text-xs font-bold text-foreground">
                Global External Intelligence Status: {externalOpted ? "Active (Outbound Lookups Enabled)" : "Sandbox Hold (Local Heuristics Only)"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {externalOpted
                  ? "Configured provider endpoints will be queried during threat investigations."
                  : "All external network calls are held in sandbox. Enable external consent to query connected providers."}
              </div>
            </div>
          </div>

          <Link to="/privacy-settings">
            <Button variant="outline" size="sm" className="text-xs h-7 rounded-xl border-border">
              Review Consent
            </Button>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CONFIGURED INTEGRATIONS SECTION                                       */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Configured Integrations ({configuredIntegrations.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {configuredIntegrations.length} Active Credentials
          </span>
        </div>

        {configuredIntegrations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 sm:p-10 text-center space-y-3">
            <KeyRound className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">No integrations configured yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                ScanIQ is operating in pure local-first offline mode. You can connect external threat feeds below to enrich scan dossiers.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenAddModal()}
              className="text-xs rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Connect First Provider</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configuredIntegrations.map((item) => {
              const meta = item.provider;
              const cat = categoryBadges[meta.category] || categoryBadges.reputation;
              const isTesting = testingId === meta.id;

              return (
                <div
                  key={meta.id}
                  className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Top Row: Provider & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground">{meta.name}</h3>
                          <Badge variant="outline" className={cn("text-[9px] uppercase font-mono", cat.classes)}>
                            {cat.label}
                          </Badge>
                        </div>
                        <a
                          href={meta.website}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <span>{meta.website.replace("https://", "")}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono flex items-center gap-1 py-0.5 px-2",
                          item.status === "connected"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : item.status === "disabled"
                            ? "border-border bg-secondary/50 text-muted-foreground"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        )}
                      >
                        {item.status === "connected" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Connected</span>
                          </>
                        ) : item.status === "disabled" ? (
                          <span>Disabled</span>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            <span>Connection Error</span>
                          </>
                        )}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {meta.description}
                    </p>

                    {/* Masked Key & Storage Source */}
                    <div className="p-3 rounded-2xl bg-secondary/40 border border-border space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium">Stored API Credential:</span>
                        <Badge variant="outline" className="text-[9px] font-mono bg-background">
                          {item.source === "environment" ? "Env Var (.env.local)" : "User Settings Vault"}
                        </Badge>
                      </div>
                      <div className="font-mono text-xs text-foreground font-bold tracking-wider">
                        {item.maskedKey || "••••••••••••••••"}
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isTesting}
                          onClick={() => handleTestConnection(meta.id)}
                          className="h-8 text-xs gap-1 rounded-xl border-border hover:bg-secondary"
                        >
                          <RefreshCw className={cn("h-3 w-3", isTesting && "animate-spin text-primary")} />
                          <span>{isTesting ? "Testing…" : "Test Connection"}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUpdateModal(meta.id)}
                          className="h-8 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Update</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(meta.id)}
                          className="h-8 text-xs gap-1 rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Remove</span>
                        </Button>
                      </div>

                      {/* Enable / Disable Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {item.enabled ? "Active" : "Disabled"}
                        </span>
                        <Switch
                          checked={item.enabled}
                          onCheckedChange={(val) => handleToggle(meta.id, val)}
                          aria-label={`Toggle ${meta.name}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. AVAILABLE PROVIDERS CATALOG                                           */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span>Available Threat Intel Providers ({availableIntegrations.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            Supported BYOK Feeds
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableIntegrations.map((item) => {
            const meta = item.provider;
            const cat = categoryBadges[meta.category] || categoryBadges.reputation;

            return (
              <div
                key={meta.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground">{meta.name}</h3>
                        <Badge variant="outline" className={cn("text-[9px] uppercase font-mono", cat.classes)}>
                          {cat.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Free tier: {meta.freeTier}
                      </p>
                    </div>

                    <Badge variant="outline" className="text-[10px] border-border text-muted-foreground bg-secondary/50 font-mono">
                      Not Configured
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {meta.description}
                  </p>

                  <div className="p-3 rounded-2xl bg-secondary/30 border border-border text-xs space-y-1">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Privacy Protocol</div>
                    <p className="text-[11px] text-muted-foreground">{meta.privacy}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <a
                    href={meta.portalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>Get Free API Key</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>

                  <Button
                    size="sm"
                    onClick={() => handleOpenAddModal(meta.id)}
                    className="h-8 text-xs gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Connect Provider</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ADD / UPDATE INTEGRATION DIALOG                                        */}
      {/* ========================================================================= */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                Connect {selectedMeta?.name || "Provider"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide your personal API key. Keys remain client-side only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            {/* Provider Selector */}
            <div className="space-y-1.5">
              <label htmlFor="provider-selector" className="font-semibold text-foreground">Selected Provider</label>
              <select
                id="provider-selector"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value as IntegrationProviderId)}
                className="w-full h-10 px-3 rounded-2xl bg-secondary/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {IntegrationManager.listSupported().map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.name} ({p.freeTier})
                  </option>
                ))}
              </select>
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="api-key-input" className="font-semibold text-foreground">API Key / Token</label>
                {selectedMeta && (
                  <a
                    href={selectedMeta.portalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Get Key on {selectedMeta.name}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>

              <div className="relative">
                <Input
                  id="api-key-input"
                  type={showKeyText ? "text" : "password"}
                  placeholder={selectedMeta?.formatHint || "Paste API key here..."}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="pr-10 h-10 rounded-2xl bg-secondary/40 border-border text-xs font-mono"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeyText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/80 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Zero-Exposure Key Isolation</span>
              </div>
              <p>
                Your key is never sent to ScanIQ maintainers, analytics, or shared cloud servers. It is used strictly for direct browser-to-provider intelligence queries.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              disabled={isValidating || !inputKey.trim()}
              onClick={handleSaveIntegration}
              className="text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Validating…</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Connect & Save</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. REMOVE CONFIRMATION DIALOG                                             */}
      {/* ========================================================================= */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Remove Integration Credential?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            This will permanently remove the stored API key from your browser. You can reconnect at any time.
          </DialogDescription>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirmId && handleRemoveIntegration(deleteConfirmId)}
              className="text-xs rounded-xl font-semibold"
            >
              Confirm Removal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default IntegrationsScreen;
