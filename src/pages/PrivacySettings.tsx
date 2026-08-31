import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Zap,
  Volume2,
  Vibrate,
  Camera,
  Network,
  Database,
  Languages,
  ShieldAlert,
  ExternalLink,
  Moon,
  FileText,
  LockKeyhole,
  Scale,
  List,
  Trash2,
  RotateCcw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/lib/settings";
import { Label } from "@/components/ui/label";
import { db, DEFAULT_CASE_LIMIT } from "@/lib/db";
import { toast } from "sonner";
import { APP_NAME, APP_VERSION } from "@/lib/app-meta";
import { DataStorageManager } from "@/components/settings/DataStorageManager";

function SettingRow({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
  action,
}: {
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <Label className="cursor-pointer text-sm font-medium leading-none">
          {label}
        </Label>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">
        {action ??
          (onCheckedChange !== undefined ? (
            <Switch
              checked={!!checked}
              onCheckedChange={onCheckedChange}
              aria-label={label}
            />
          ) : null)}
      </div>
    </div>
  );
}

function NavRow({
  label,
  description,
  icon: Icon,
  onClick,
  iconRight,
  badge,
}: {
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  iconRight?: React.ComponentType<{ className?: string }>;
  badge?: string;
}) {
  const Right = iconRight ?? ExternalLink;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-secondary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {badge && (
            <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Right className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function PrivacySettingsScreen() {
  const navigate = useNavigate();
  const {
    t: translate,
    i18n,
  } = useTranslation();

  const sound = useSettings((s) => s.sound);
  const vibrate = useSettings((s) => s.vibrate);
  const autoStartCamera = useSettings((s) => s.autoStartCamera);
  const confirmBeforeOpen = useSettings((s) => s.confirmBeforeOpenDestinations);
  const externalOpted = useSettings((s) => s.externalLookupsOptedIn);
  const telemetry = useSettings((s) => s.telemetryEnabled);
  const theme = useSettings((s) => s.theme);
  const retention = useSettings((s) => s.caseRetentionDays);
  const set = useSettings((s) => s.set);

  const clearAll = async () => {
    const ok = window.confirm(
      "Delete ALL cases, scans, and investigations from this device? This is permanent.",
    );
    if (!ok) return;
    await Promise.all([
      db.cases.clear(),
      db.scans.clear(),
      db.investigations.clear(),
    ]);
    toast.success("All local data cleared.");
  };

  const resetApp = async () => {
    const ok = window.confirm(
      "Reset ScanIQ to factory defaults? This wipes all local data, resets settings, and shows onboarding again.",
    );
    if (!ok) return;
    await Promise.all([
      db.cases.clear(),
      db.scans.clear(),
      db.investigations.clear(),
    ]);
    localStorage.removeItem("scaniq-settings");
    location.reload();
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2">
        <button
          onClick={() => navigate(-1)}
          className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {translate("common.back", "Back")}
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <span>{translate("privacySettings.title", "Privacy & Security Settings")}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {translate(
            "privacySettings.subtitle",
            "ScanIQ is free, open-source, and local-first. Configure scanning, privacy, and intelligence permissions.",
          )}
        </p>
      </div>

      <div className="space-y-4">
        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3.5 w-3.5" /> Scanner Behavior
          </h2>
          <div className="space-y-2">
            <SettingRow
              label={translate("privacySettings.beep", "Beep on scan")}
              icon={Volume2}
              checked={sound}
              onCheckedChange={(v) => set({ sound: v })}
            />
            <SettingRow
              label={translate("privacySettings.vibrate", "Vibrate on scan")}
              icon={Vibrate}
              checked={vibrate}
              onCheckedChange={(v) => set({ vibrate: v })}
            />
            <SettingRow
              label={translate(
                "privacySettings.autoStartCamera",
                "Enable Camera auto-start when Camera mode is selected",
              )}
              description="Camera access is never triggered on initial page load. When enabled, selecting the Camera mode tab will automatically request sensor startup."
              icon={Camera}
              checked={autoStartCamera}
              onCheckedChange={(v) => set({ autoStartCamera: v })}
            />
            <SettingRow
              label={translate(
                "privacySettings.confirmOpen",
                "Confirm before opening destinations",
              )}
              description="Never auto-navigate. Always prompt before visiting a URL or opening other apps."
              icon={ShieldAlert}
              checked={confirmBeforeOpen}
              onCheckedChange={(v) => set({ confirmBeforeOpenDestinations: v })}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Network className="h-3.5 w-3.5" /> Intelligence & Privacy
          </h2>
          <div className="space-y-2">
            <SettingRow
              label={translate(
                "privacySettings.optin",
                "Enable external network lookups",
              )}
              description={
                externalOpted
                  ? "DNS, RDAP, reputation, and other networked sources you individually toggle in Sources will run during investigations."
                  : "Nothing leaves your device except when you explicitly open an external link — even if a source is enabled in the catalog."
              }
              icon={LockKeyhole}
              checked={externalOpted}
              onCheckedChange={(v) => {
                const ok =
                  v
                    ? window.confirm(
                        "By enabling external lookups, you understand that domains, IPs, URLs, and/or hashes of scanned targets will be sent to third-party services whose privacy policies govern how they use your queries. Proceed only if you consent.\n\nYou can still enable/disable sources individually in the Sources catalog.",
                      )
                    : true;
                if (ok) set({ externalLookupsOptedIn: v });
              }}
            />
            <SettingRow
              label={translate(
                "privacySettings.telemetry",
                "Anonymous app-level telemetry",
              )}
              description="Disabling ensures no event pings at all. We never send scanned content."
              icon={Zap}
              checked={telemetry}
              onCheckedChange={(v) => set({ telemetryEnabled: v })}
            />
            <NavRow
              label={translate("privacySettings.sources", "Manage sources")}
              description="Enable / disable individual intelligence services."
              icon={Database}
              onClick={() => navigate("/sources")}
              badge="Opt-in"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Database className="h-3.5 w-3.5" /> Data & Local Storage (Backup / Restore)
          </h2>
          <DataStorageManager />
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Database className="h-3.5 w-3.5" /> Case Retention
          </h2>
          <div className="space-y-2">
            <SettingRow
              label={translate(
                "privacySettings.retention",
                "Case retention (default: 90 days)",
              )}
              description={`${retention} days. Older cases will be silently pruned to preserve your privacy. Max: ${DEFAULT_CASE_LIMIT} simultaneous cases.`}
              icon={RotateCcw}
              action={
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-[11px]"
                    onClick={() => set({ caseRetentionDays: 30 })}
                  >
                    30d
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-[11px]"
                    onClick={() => set({ caseRetentionDays: 90 })}
                  >
                    90d
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl text-[11px]"
                    onClick={() => set({ caseRetentionDays: 365 })}
                  >
                    365d
                  </Button>
                </div>
              }
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Moon className="h-3.5 w-3.5" /> Appearance & Language
          </h2>
          <div className="space-y-2">
            <SettingRow
              label="Theme"
              icon={Moon}
              action={
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={theme === "dark" ? "default" : "outline"}
                    className="h-8 rounded-xl text-[11px]"
                    onClick={() => set({ theme: "dark" })}
                  >
                    Dark
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === "light" ? "default" : "outline"}
                    className="h-8 rounded-xl text-[11px]"
                    onClick={() => set({ theme: "light" })}
                  >
                    Light
                  </Button>
                </div>
              }
            />
            <NavRow
              label={translate("language.title", "Language")}
              description={i18n.resolvedLanguage || i18n.language}
              icon={Languages}
              onClick={() => navigate("/language")}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Data, Legal & About
          </h2>
          <div className="space-y-2">
            <NavRow
              label={translate("privacy.title", "Privacy & Data")}
              description="How ScanIQ processes and retains your data."
              icon={LockKeyhole}
              onClick={() => navigate("/privacy")}
            />
            <NavRow
              label="Terms of Use"
              description="Usage terms for this open-source OSINT tool."
              icon={Scale}
              onClick={() => navigate("/terms")}
            />
            <NavRow
              label="Open Source Licenses"
              description="Third-party software included in ScanIQ."
              icon={List}
              onClick={() => navigate("/licenses")}
            />
            <NavRow
              label={`About ${APP_NAME}`}
              description={`v${APP_VERSION} · free, open-source OSINT scanner`}
              icon={Info}
              onClick={() => navigate("/about")}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Destructive Actions
          </h2>
          <div className="space-y-2">
            <SettingRow
              label="Clear all local data"
              description="Remove every case, scan, and investigation stored on this device."
              icon={Trash2}
              action={
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 rounded-xl text-[11px]"
                  onClick={clearAll}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Clear
                </Button>
              }
            />
            <SettingRow
              label="Reset ScanIQ to defaults"
              description="Full factory reset. Consider exporting notes first."
              icon={RotateCcw}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-xl text-[11px] border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={resetApp}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
