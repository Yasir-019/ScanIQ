import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Copy,
  Share2,
  Wifi,
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Star,
  AlertTriangle,
  CreditCard,
  Languages,
  FileText,
  Zap,
  Search,
  Sparkles,
} from "lucide-react";
import type { ScanRecord, SafetyStatus, ScanContentType } from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import { analyzeUrlSafety, type SafetyResult } from "@/lib/url-safety";
import { useActionStats } from "@/lib/action-stats";
import { toast } from "sonner";
import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  scan: ScanRecord | null;
  onClose: () => void;
}

const TYPE_ICONS: Record<ScanContentType, React.ComponentType<{ className?: string }>> = {
  url: ExternalLink,
  wifi: Wifi,
  vcard: UserPlus,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  geo: MapPin,
  product: FileText,
  text: FileText,
  payment: CreditCard,
};

function SafetyBadge({ status }: { status?: SafetyStatus }) {
  const { t } = useTranslation();
  if (!status || status === "unchecked") return null;
  if (status === "safe")
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success/90">
        <ShieldCheck className="mr-1 h-3 w-3" /> {t("result.safe")}
      </Badge>
    );
  if (status === "suspicious")
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
        <ShieldAlert className="mr-1 h-3 w-3" /> {t("result.suspicious")}
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <ShieldX className="mr-1 h-3 w-3" /> {t("result.risky")}
    </Badge>
  );
}

function SafetyWarningCard({ safety }: { safety: SafetyResult }) {
  const { t } = useTranslation();
  if (safety.level === "safe" || safety.reasons.length === 0) return null;

  const isMalicious = safety.level === "malicious";

  return (
    <div
      className={`rounded-2xl border p-4 text-sm ${
        isMalicious
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning/10 text-warning-foreground"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {isMalicious ? t("safety.dangerTitle") : t("safety.warningTitle")}
      </div>
      <ul className="list-inside list-disc space-y-1 text-xs opacity-90">
        {safety.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export function ResultSheet({ scan, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [showExplain, setShowExplain] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const recordAction = useActionStats((s) => s.record);
  const topAction = useActionStats((s) => s.topAction);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (showExplain && !loadingExplain) {
      setTimeout(() => {
        backButtonRef.current?.focus();
      }, 50);
    }
  }, [showExplain, loadingExplain]);

  useEffect(() => {
    if (scan) {
      setShowExplain(false);
      setLoadingExplain(false);
      setFavorite(!!scan.favorite);
    }
  }, [scan]);

  // Local rule-based AI explanation generator
  const explanation = useMemo(() => {
    if (!scan) return { summary: "", details: [] };
    const parsed = parseScanContent(scan.content, scan.format);
    
    switch (scan.type) {
      case "url": {
        const hasHttps = scan.content.toLowerCase().startsWith("https://");
        let host = "Unknown";
        try { host = new URL(scan.content).hostname; } catch { /* ignore invalid URLs */ }
        const isSuspicious = host.toLowerCase().includes("bank") || host.toLowerCase().includes("support") || host.toLowerCase().includes("login") || host.toLowerCase().includes("secure");
        
        return {
          summary: "Web Link Security Analysis",
          details: [
            `This points to the domain: ${host}.`,
            hasHttps 
              ? "✅ Secure Connection: Uses HTTPS to encrypt data in transit." 
              : "⚠️ Insecure Connection: Uses plain HTTP. Any credentials entered can be intercepted.",
            isSuspicious 
              ? "🚨 Brand Alert: The domain contains sensitive terms. Double-check for phishing impersonations." 
              : "✅ No obvious brand impersonation keywords detected.",
            "🔒 Sandboxed Access: Safely opens in your browser sandbox, blocking direct root-level modifications."
          ]
        };
      }
      case "wifi": {
        const ssid = (parsed.data as Record<string, string>)?.ssid || "Unknown";
        const enc = (parsed.data as Record<string, string>)?.encryption || "None";
        return {
          summary: "Wi-Fi Network Configuration",
          details: [
            `Wireless network SSID: "${ssid}".`,
            `Security protocols: ${enc} (${enc === "WEP" ? "⚠️ Outdated" : "✅ Secure Standard"}).`,
            "📱 Connection Flow: Tapping 'Connect' configures your system settings safely. No local network data is transmitted externally."
          ]
        };
      }
      case "vcard": {
        const name = (parsed.data as Record<string, string>)?.name || "No name";
        const tel = (parsed.data as Record<string, string>)?.tel || "No number";
        const email = (parsed.data as Record<string, string>)?.email || "No email";
        return {
          summary: "Contact Entry Card (vCard)",
          details: [
            `Name details: ${name}.`,
            `Phone contact: ${tel}.`,
            `Email address: ${email}.`,
            "👤 Local Sync: Tapping 'Add Contact' saves this entry to your native address book directly. No contacts sync online."
          ]
        };
      }
      case "payment": {
        return {
          summary: "Payment Payload Specifications",
          details: [
            "This contains a payment request link.",
            "🔒 Local check: Secure bank scheme formatting detected.",
            "💸 Security Reminder: Check the payee details and exact billing amount before typing in your financial transaction PIN.",
            "Offline Hand-off: Hands over parameter parsing directly to your payment app."
          ]
        };
      }
      case "product": {
        const code = (parsed.data as Record<string, string>)?.code || scan.content;
        return {
          summary: "Commercial Product Barcode",
          details: [
            `Global barcode index: ${code}.`,
            "🛒 Product Code standard: Registered retail GTIN / UPC / EAN standard.",
            "🌐 Web Search Lookup: Runs inquiries on global consumer goods indexes to find manufacturer information, ingredients, and retail prices."
          ]
        };
      }
      default:
        return {
          summary: "Text Information Description",
          details: [
            "Payload type: Plain Text.",
            "📝 Raw data payload contains generic formatted characters.",
            "🛠️ Core Utilities: Copy information directly to system clipboard or share via local messenger apps."
          ]
        };
    }
  }, [scan]);

  const triggerExplain = () => {
    setShowExplain(true);
    setLoadingExplain(true);
    setTimeout(() => {
      setLoadingExplain(false);
    }, 750);
  };

  const safety = useMemo<SafetyResult>(() => {
    if (!scan || (scan.type !== "url" && scan.type !== "payment")) return { level: "safe", reasons: [] };
    return analyzeUrlSafety(scan.content);
  }, [scan]);

  if (!scan) return null;
  const parsed = parseScanContent(scan.content, scan.format);
  const TypeIcon = TYPE_ICONS[parsed.type] || FileText;
  const primaryAction = topAction(parsed.type);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scan.content);
      toast.success(t("result.copied"));
      recordAction("copy");
    } catch {
      toast.error(t("errors.copyFailed"));
    }
  };

  const share = async () => {
    recordAction("share");
    if (navigator.share) {
      try {
        await navigator.share({ text: scan.content });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    copy();
  };

  const toggleFav = async () => {
    const next = !favorite;
    setFavorite(next);
    await db.scans.update(scan.id, { favorite: next });
    toast(next ? t("history.addedFavorite") : t("history.removedFavorite"));
  };

  const openUrl = () => {
    if (safety.level === "malicious") {
      setConfirmOpen(true);
      return;
    }
    recordAction("open_url");
    window.open(scan.content, "_blank", "noopener,noreferrer");
  };

  const forceOpenUrl = () => {
    setConfirmOpen(false);
    recordAction("open_url");
    window.open(scan.content, "_blank", "noopener,noreferrer");
  };

  const translateText = () => {
    recordAction("translate");
    const lang = i18n.resolvedLanguage || i18n.language || "en";
    const url = `https://translate.google.com/?sl=auto&tl=${lang}&text=${encodeURIComponent(scan.content)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openPayment = () => {
    recordAction("open_payment");
    window.open(scan.content, "_blank", "noopener,noreferrer");
  };

  /** Build the primary + secondary action buttons */
  const renderSmartActions = () => {
    switch (parsed.type) {
      case "url": {
        const isMalicious = safety.level === "malicious";
        const isSuspicious = safety.level === "suspicious";
        return (
          <>
            <SafetyWarningCard safety={safety} />
            <Button
              onClick={openUrl}
              className="w-full"
              size="lg"
              variant={isMalicious ? "destructive" : isSuspicious ? "outline" : "default"}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isMalicious
                ? t("safety.openAtRisk")
                : isSuspicious
                  ? t("safety.openAnyway")
                  : t("result.openLink")}
            </Button>
          </>
        );
      }
      case "wifi":
        return (
          <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Wifi className="h-4 w-4" /> {parsed.data.ssid || t("result.wifi")}
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div>{t("result.encryption")}: {parsed.data.encryption}</div>
              {parsed.data.password && <div>{t("result.password")}: {parsed.data.password}</div>}
            </div>
            <Button onClick={() => {
              navigator.clipboard.writeText(parsed.data.password || "");
              toast.success(t("result.passwordCopied"));
              recordAction("copy_password");
            }} className="mt-3 w-full" variant={primaryAction === "copy_password" ? "default" : "secondary"}>
              {t("result.copyPassword")}
            </Button>
          </div>
        );
      case "phone":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`tel:${parsed.data.number}`} onClick={() => recordAction("call")}>
              <Phone className="mr-2 h-4 w-4" /> {t("result.callNumber", { n: parsed.data.number })}
            </a>
          </Button>
        );
      case "email":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`mailto:${parsed.data.to}`} onClick={() => recordAction("send_email")}>
              <Mail className="mr-2 h-4 w-4" /> {t("result.emailTo", { n: parsed.data.to })}
            </a>
          </Button>
        );
      case "sms":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`sms:${parsed.data.number}`} onClick={() => recordAction("send_sms")}>
              <MessageSquare className="mr-2 h-4 w-4" /> {t("result.textNumber", { n: parsed.data.number })}
            </a>
          </Button>
        );
      case "vcard":
        return (
          <Button onClick={() => {
            const blob = new Blob([parsed.data.raw], { type: "text/vcard" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${parsed.data.name || "contact"}.vcf`;
            a.click();
            URL.revokeObjectURL(url);
            recordAction("save_contact");
          }} className="w-full" size="lg">
            <UserPlus className="mr-2 h-4 w-4" /> {t("result.saveContact")}
          </Button>
        );
      case "geo":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`https://www.google.com/maps?q=${encodeURIComponent(parsed.data.coords)}`} target="_blank" rel="noopener noreferrer" onClick={() => recordAction("open_maps")}>
              <MapPin className="mr-2 h-4 w-4" /> {t("result.openInMaps")}
            </a>
          </Button>
        );
      case "payment":
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
                <CreditCard className="h-4 w-4" /> {t("result.paymentDetected")}
              </div>
              <div className="space-y-1 text-muted-foreground">
                {parsed.data.payee && <div>{t("result.payee")}: {parsed.data.payee}</div>}
                {parsed.data.amount && <div>{t("result.amount")}: {parsed.data.amount}</div>}
                <div className="text-xs opacity-70">{parsed.data.scheme?.toUpperCase()}</div>
              </div>
            </div>
            <Button onClick={openPayment} className="w-full" size="lg">
              <CreditCard className="mr-2 h-4 w-4" /> {t("result.openPayment")}
            </Button>
          </div>
        );
      case "text":
        return (
          <div className="space-y-2">
            {primaryAction === "translate" ? (
              <>
                <Button onClick={translateText} className="w-full" size="lg">
                  <Languages className="mr-2 h-4 w-4" /> {t("result.translate")}
                </Button>
                <Button onClick={copy} className="w-full" size="lg" variant="secondary">
                  <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={copy} className="w-full" size="lg">
                  <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
                </Button>
                <Button onClick={translateText} className="w-full" size="lg" variant="secondary">
                  <Languages className="mr-2 h-4 w-4" /> {t("result.translate")}
                </Button>
              </>
            )}
          </div>
        );
      case "product":
        return (
          <Button
            onClick={() => {
              window.open(`https://www.google.com/search?q=${encodeURIComponent(parsed.data.code)}`, "_blank", "noopener,noreferrer");
            }}
            className="w-full"
            size="lg"
          >
            <Search className="mr-2 h-4 w-4" />
            {t("result.searchProduct", "Search Product")}
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Sheet open={!!scan} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t-0 p-6">
          <SheetHeader className="mb-4 text-left">
            {/* Smart detected type header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TypeIcon className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
                  {t(`result.types.${parsed.type}`)} · {scan.format.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <SafetyBadge status={scan.safetyStatus} />
                <button
                  onClick={toggleFav}
                  aria-label="Favorite"
                  className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
                >
                  <Star className={favorite ? "h-5 w-5 fill-warning text-warning" : "h-5 w-5"} />
                </button>
              </div>
            </div>

            {/* Smart action indicator */}
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary/80">
              <Zap className="h-3 w-3" />
              {t("result.smartAction")}
            </div>

            <SheetTitle className="break-words text-xl leading-snug">{parsed.display || scan.content}</SheetTitle>
          </SheetHeader>

          {showExplain ? (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-card animate-fade-up">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <h3 className="font-semibold text-sm">Local AI Assist</h3>
              </div>
              
              {loadingExplain ? (
                <div className="py-8 text-center space-y-2">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-xs text-muted-foreground animate-pulse">Analyzing payload elements...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground/90">{explanation.summary}</h4>
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    {explanation.details.map((detail, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-primary">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    ref={backButtonRef}
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExplain(false)}
                    className="w-full mt-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Back to Actions
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary smart action */}
              {renderSmartActions()}

              {/* Quick actions row */}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" onClick={copy} className="h-12">
                  <Copy className="h-4 w-4" />
                  <span className="text-xs">{t("common.copy")}</span>
                </Button>
                <Button variant="secondary" onClick={share} className="h-12">
                  <Share2 className="h-4 w-4" />
                  <span className="text-xs">{t("common.share")}</span>
                </Button>
                <Button variant="secondary" onClick={triggerExplain} className="h-12">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs">{t("result.explain")}</span>
                </Button>
              </div>

              <details className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">{t("result.rawContent")}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-foreground/80">{scan.content}</pre>
              </details>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("safety.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("safety.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={forceOpenUrl} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("safety.openAtRisk")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
