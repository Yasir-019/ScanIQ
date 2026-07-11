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
  QrCode,
  ChevronRight,
  Languages,
  Shield,
  ClipboardCopy,
  WifiIcon,
  Zap,
  FileText,
  Code,
  Info,
} from "lucide-react";
import { shareApp } from "@/lib/share";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

export default function ProfileScreen() {
  const settings = useSettings();
  const isDark = settings.theme === "dark";
  const { t, i18n } = useTranslation();
  const currentLangCode = i18n.resolvedLanguage || i18n.language || "en";
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) ||
    SUPPORTED_LANGUAGES.find((l) => currentLangCode.startsWith(l.code)) ||
    SUPPORTED_LANGUAGES[0];

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    settings.set({ theme: next });
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">{t("profile.title")}</h1>


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
        <Link
          to="/privacy"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.privacy")}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/terms"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.terms", "Terms of Service")}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/licenses"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Code className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.licenses", "Open Source Licenses")}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/about"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{t("profile.about")}</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Automation section */}
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
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("profile.shareSection")}
        </p>
        <button
          onClick={shareApp}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t("profile.shareLink")}</div>
            <div className="text-xs text-muted-foreground">{t("profile.shareLinkSub")}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <Link
          to="/share-qr"
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <QrCode className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t("profile.shareQR")}</div>
            <div className="text-xs text-muted-foreground">{t("profile.shareQRSub")}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        <p className="mb-1 font-medium text-foreground">{t("profile.about")}</p>
        <p>{t("profile.aboutBody")}</p>
      </div>
    </div>
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
