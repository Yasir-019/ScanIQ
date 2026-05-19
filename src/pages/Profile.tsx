import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Moon, Sun, Volume2, Vibrate, Link2, Crown, Share2, ChevronRight, Shield, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ProfileScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const isDark = settings.theme === "dark";
  const isPro = settings.isPro;

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    settings.set({ theme: next });
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleUpgrade = () => {
    if (isPro) {
      toast.success("You are already a Pro user!");
      return;
    }
    // Simulate upgrade process
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Connecting to payment gateway...",
        success: () => {
          settings.upgradeToPro();
          return "Welcome to ScanIQ Pro!";
        },
        error: "Payment failed. Please try again.",
      }
    );
  };

  return (
    <div className="safe-top h-full overflow-y-auto px-4 pb-6 pt-4">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Profile</h1>

      <div className={cn(
        "mb-5 overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-elegant transition-all",
        isPro ? "bg-gradient-to-br from-amber-400 to-orange-600" : "bg-gradient-hero"
      )}>
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
          <Crown className="h-3.5 w-3.5" /> {isPro ? "ScanIQ Pro Active" : "ScanIQ Free Tier"}
        </div>
        <h2 className="mb-2 text-xl font-bold">
          {isPro ? "Premium Features Enabled" : "Unlock unlimited scanning"}
        </h2>
        <p className="mb-4 text-sm opacity-90">
          {isPro 
            ? "You have full access to cloud sync, AI insights, and custom branding." 
            : "Cloud sync, unlimited AI explains, custom QR branding, bulk export."}
        </p>
        {!isPro && (
          <Button 
            onClick={handleUpgrade}
            variant="secondary" 
            className="rounded-full bg-white text-primary hover:bg-white/90"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Upgrade
          </Button>
        )}
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <SettingRow
          icon={isDark ? Moon : Sun}
          label="Dark mode"
          control={<Switch checked={isDark} onCheckedChange={toggleTheme} />}
        />
        <SettingRow
          icon={Volume2}
          label="Beep on scan"
          control={<Switch checked={settings.sound} onCheckedChange={(v) => settings.set({ sound: v })} />}
        />
        <SettingRow
          icon={Vibrate}
          label="Vibrate on scan"
          control={<Switch checked={settings.vibrate} onCheckedChange={(v) => settings.set({ vibrate: v })} />}
        />
        <SettingRow
          icon={Link2}
          label="Auto-open URLs"
          control={<Switch checked={settings.autoOpenUrls} onCheckedChange={(v) => settings.set({ autoOpenUrls: v })} />}
        />
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <button 
          onClick={() => navigate("/share")}
          className="flex w-full items-center gap-3 px-3 py-3 transition hover:bg-muted/50 rounded-2xl"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left text-sm font-medium">Share App</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="mb-5 rounded-3xl border border-border bg-card p-2 shadow-card">
        <button 
          className="flex w-full items-center gap-3 px-3 py-3 transition hover:bg-muted/50 rounded-2xl"
          onClick={() => toast.info("Privacy Policy coming soon")}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left text-sm font-medium">Privacy Policy</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button 
          className="flex w-full items-center gap-3 px-3 py-3 transition hover:bg-muted/50 rounded-2xl"
          onClick={() => toast.info("Terms of Service coming soon")}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left text-sm font-medium">Terms of Service</div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        <p className="mb-1 font-medium text-foreground">About ScanIQ</p>
        <p>v1.0 · Scan anything. Understand instantly.</p>
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
      <div className="flex-1 text-sm font-medium">{label}</div>
      {control}
    </div>
  );
}
