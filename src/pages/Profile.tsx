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
  Crown,
  Sparkles,
} from "lucide-react";
import { shareApp } from "@/lib/share";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const [showCheckout, setShowCheckout] = useState(false);

  const isDark = settings.theme === "dark";
  const isPro = settings.isPro;

  const toggleTheme = (dark: boolean) => {
    const val = dark ? "dark" : "light";
    settings.set({ theme: val });
    document.documentElement.classList.toggle("dark", dark);
  };

  const activatePro = () => {
    settings.set({ isPro: true });
    setShowCheckout(false);
    toast.success("ScanIQ Pro unlocked successfully!");
  };

  const currentLangCode = i18n.resolvedLanguage || i18n.language || "en";
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) ||
    SUPPORTED_LANGUAGES.find((l) => currentLangCode.startsWith(l.code)) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">{t("profile.title")}</h1>

      {isPro ? (
        <div className="mb-5 overflow-hidden rounded-3xl bg-primary/10 border border-primary/20 p-5 shadow-card">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Crown className="h-3.5 w-3.5 fill-primary" /> ScanIQ Pro Active
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Premium Unlocked</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            You have unlimited history size, CSV bulk export features, and custom QR generator colors active.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => settings.set({ isPro: false })}
            className="rounded-xl text-xs h-8 border-primary/30 text-primary hover:bg-primary/5"
          >
            Disable Pro Developer Mode
          </Button>
        </div>
      ) : (
        <div className="mb-5 overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elegant">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
            <Crown className="h-3.5 w-3.5" /> {t("profile.proHeader", "ScanIQ Pro")}
          </div>
          <h2 className="mb-2 text-xl font-bold">{t("profile.proTitle", "Unlock Unlimited Scanning")}</h2>
          <p className="mb-4 text-xs opacity-90">{t("profile.proBody", "Unlimited history, bulk export to CSV, and custom color styles.")}</p>
          <Button
            variant="secondary"
            onClick={() => setShowCheckout(true)}
            className="rounded-full bg-white text-primary hover:bg-white/90 h-10 px-4 text-xs"
          >
            <Sparkles className="mr-2 h-3.5 w-3.5" /> {t("profile.upgrade", "Upgrade Now")}
          </Button>
        </div>
      )}

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
        <SettingRow
          icon={Shield}
          label={t("profile.telemetry", "Send Diagnostic Reports")}
          control={<Switch checked={settings.telemetryEnabled} onCheckedChange={(v) => settings.set({ telemetryEnabled: v })} />}
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

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-xs rounded-3xl border border-border bg-card p-5 text-center shadow-lg">
          <DialogHeader className="items-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Crown className="h-7 w-7 fill-primary" />
            </div>
            <DialogTitle className="text-lg text-foreground">Google Play Purchase</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Simulated secure checkout for ScanIQ Pro.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-2xl bg-secondary/40 p-4 text-left space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>ScanIQ Pro (Life)</span>
              <span>$0.00 (Free Trial)</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Developer simulation. Unlocks all premium features instantly.
            </p>
          </div>

          <div className="space-y-2">
            <Button onClick={activatePro} className="w-full h-12 rounded-2xl text-sm">
              Unlock Pro Mode
            </Button>
            <Button variant="ghost" onClick={() => setShowCheckout(false)} className="w-full text-xs text-muted-foreground h-10">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
