import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/lib/settings";
import { Switch } from "@/components/ui/switch";
import {
  Moon,
  Sun,
  Volume2,
  Vibrate,
  Link2,
  Share2,
  ChevronRight,
  Languages,
  Shield,
  ClipboardCopy,
  WifiIcon,
  Zap,
  FileText,
  Code,
  Info,
  Globe,
  Github,
} from "lucide-react";
import { shareApp } from "@/lib/share";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { APP_NAME, APP_REPO_URL, APP_LICENSE, APP_VERSION } from "@/lib/app-meta";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();

  const isDark = settings.theme === "dark";

  const toggleTheme = (dark: boolean) => {
    const val = dark ? "dark" : "light";
    settings.set({ theme: val });
    document.documentElement.classList.toggle("dark", dark);
  };

  const currentLangCode = i18n.resolvedLanguage || i18n.language || "en";
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) ||
    SUPPORTED_LANGUAGES.find((l) => currentLangCode.startsWith(l.code)) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("profile.title", "Settings")}</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        {t("profile.subtitle", "Offline by default. No accounts, no tracking, no paid tiers.")}
      </p>

      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <SettingRow
          icon={isDark ? Moon : Sun}
          label={t("profile.darkMode")}
          control={<Switch checked={isDark} onCheckedChange={toggleTheme} />}
        />
        <SettingRow
          icon={Volume2}
          label={t("profile.beep")}
          control={<Switch checked={settings.sound} onCheckedChange={(v) => settings.set({ sound: v })} />}
        />
        <SettingRow
          icon={Vibrate}
          label={t("profile.vibrate")}
          control={<Switch checked={settings.vibrate} onCheckedChange={(v) => settings.set({ vibrate: v })} />}
        />
        <Link
          to="/language"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Languages className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.language")}</div>
          <span className="text-sm text-muted-foreground" dir={currentLang.dir} lang={currentLang.code}>
            {currentLang.nativeLabel}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Data handling — privacy-first defaults */}
      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="mr-1 inline h-3 w-3" />
          {t("profile.dataSection", "Data handling")}
        </p>
        <SettingRow
          icon={Globe}
          label={t("profile.onlineEnrichment", "Online enrichment (opt-in)")}
          control={
            <Switch
              checked={settings.onlineEnrichment}
              onCheckedChange={(v) => settings.set({ onlineEnrichment: v })}
            />
          }
        />
        <SettingRow
          icon={Shield}
          label={t("profile.telemetry", "Send diagnostic reports")}
          control={
            <Switch
              checked={settings.telemetryEnabled}
              onCheckedChange={(v) => settings.set({ telemetryEnabled: v })}
            />
          }
        />
        <p className="px-3 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "profile.dataNote",
            "All analysis runs locally. Enrichment and diagnostics stay off unless you turn them on.",
          )}
        </p>
      </div>

      {/* Automation — acting on untrusted input is opt-in */}
      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="mr-1 inline h-3 w-3" />
          {t("profile.automationSection")}
        </p>
        <SettingRow
          icon={Link2}
          label={t("profile.autoOpen")}
          control={<Switch checked={settings.autoOpenUrls} onCheckedChange={(v) => settings.set({ autoOpenUrls: v })} />}
        />
        <SettingRow
          icon={ClipboardCopy}
          label={t("profile.autoCopy")}
          control={<Switch checked={settings.autoCopyText} onCheckedChange={(v) => settings.set({ autoCopyText: v })} />}
        />
        <SettingRow
          icon={WifiIcon}
          label={t("profile.autoWifi")}
          control={<Switch checked={settings.autoConnectWifi} onCheckedChange={(v) => settings.set({ autoConnectWifi: v })} />}
        />
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <NavRow to="/privacy" icon={Shield} label={t("profile.privacy")} />
        <NavRow to="/terms" icon={FileText} label={t("profile.terms", "Terms of use")} />
        <NavRow to="/licenses" icon={Code} label={t("profile.licenses", "Open source licenses")} />
        <NavRow to="/about" icon={Info} label={t("profile.about", "About ScanIQ")} />
        <a
          href={APP_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Github className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.source", "Source code")}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </a>
        <button
          onClick={shareApp}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t("profile.shareLink", "Share the project")}</div>
            <div className="text-xs text-muted-foreground">
              {t("profile.shareLinkSub", "Send someone the repository link")}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        <p className="mb-1 font-medium text-foreground">{APP_NAME}</p>
        <p className="text-xs">
          v{APP_VERSION} · {APP_LICENSE} licensed · free and open source forever.
        </p>
      </div>
    </div>
  );
}

function NavRow({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link to={to} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 text-sm font-medium">{label}</div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function SettingRow({
  icon: Icon,
  label,
  control,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{label}</div>
      {control}
    </div>
  );
}
