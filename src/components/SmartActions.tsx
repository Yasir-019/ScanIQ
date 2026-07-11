import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  Wifi,
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  MapPin,
  CreditCard,
  Languages,
  Copy,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafetyWarningCard } from "@/components/SafetyWarningCard";
import type { ScanRecord } from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import type { SafetyResult } from "@/lib/url-safety";
import { toast } from "sonner";

interface SmartActionsProps {
  scan: ScanRecord;
  safety: SafetyResult;
  primaryAction: string;
  onCopy: () => void;
  onOpenUrl: () => void;
  onTranslateText: () => void;
  onOpenPayment: () => void;
  recordAction: (act: string) => void;
}

export const SmartActions = memo(function SmartActions({
  scan,
  safety,
  primaryAction,
  onCopy,
  onOpenUrl,
  onTranslateText,
  onOpenPayment,
  recordAction,
}: SmartActionsProps) {
  const { t } = useTranslation();
  const parsed = parseScanContent(scan.content, scan.format);

  switch (parsed.type) {
    case "url": {
      const isMalicious = safety.level === "malicious";
      const isSuspicious = safety.level === "suspicious";
      return (
        <div className="space-y-3 w-full">
          <SafetyWarningCard safety={safety} />
          <Button
            onClick={onOpenUrl}
            className="w-full h-12 rounded-2xl text-sm"
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
        </div>
      );
    }
    case "wifi":
      return (
        <div className="rounded-2xl border border-border bg-secondary/35 p-4 text-sm w-full space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Wifi className="h-4 w-4 text-primary" /> {parsed.data.ssid || t("result.wifi")}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>{t("result.encryption")}: {parsed.data.encryption}</div>
            {parsed.data.password && <div>{t("result.password")}: {parsed.data.password}</div>}
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(parsed.data.password || "");
              toast.success(t("result.passwordCopied"));
              recordAction("copy_password");
            }}
            className="mt-2 w-full h-10 rounded-xl text-xs"
            variant={primaryAction === "copy_password" ? "default" : "secondary"}
          >
            {t("result.copyPassword")}
          </Button>
        </div>
      );
    case "phone":
      return (
        <Button asChild className="w-full h-12 rounded-2xl text-sm" size="lg">
          <a href={`tel:${parsed.data.number}`} onClick={() => recordAction("call")}>
            <Phone className="mr-2 h-4 w-4" /> {t("result.callNumber", { n: parsed.data.number })}
          </a>
        </Button>
      );
    case "email":
      return (
        <Button asChild className="w-full h-12 rounded-2xl text-sm" size="lg">
          <a href={`mailto:${parsed.data.to}`} onClick={() => recordAction("send_email")}>
            <Mail className="mr-2 h-4 w-4" /> {t("result.emailTo", { n: parsed.data.to })}
          </a>
        </Button>
      );
    case "sms":
      return (
        <Button asChild className="w-full h-12 rounded-2xl text-sm" size="lg">
          <a href={`sms:${parsed.data.number}`} onClick={() => recordAction("send_sms")}>
            <MessageSquare className="mr-2 h-4 w-4" /> {t("result.textNumber", { n: parsed.data.number })}
          </a>
        </Button>
      );
    case "vcard":
      return (
        <Button
          onClick={() => {
            const blob = new Blob([parsed.data.raw], { type: "text/vcard" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${parsed.data.name || "contact"}.vcf`;
            a.click();
            URL.revokeObjectURL(url);
            recordAction("save_contact");
          }}
          className="w-full h-12 rounded-2xl text-sm"
          size="lg"
        >
          <UserPlus className="mr-2 h-4 w-4" /> {t("result.saveContact")}
        </Button>
      );
    case "geo":
      return (
        <Button asChild className="w-full h-12 rounded-2xl text-sm" size="lg">
          <a
            href={`https://www.google.com/maps?q=${encodeURIComponent(parsed.data.coords)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordAction("open_maps")}
          >
            <MapPin className="mr-2 h-4 w-4" /> {t("result.openInMaps")}
          </a>
        </Button>
      );
    case "payment":
      return (
        <div className="space-y-3 w-full animate-slide-up">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <CreditCard className="h-4 w-4" /> {t("result.paymentDetected")}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {parsed.data.payee && <div>{t("result.payee")}: {parsed.data.payee}</div>}
              {parsed.data.amount && <div>{t("result.amount")}: {parsed.data.amount}</div>}
              <div className="text-[10px] font-mono uppercase opacity-75">{parsed.data.scheme}</div>
            </div>
          </div>
          <Button onClick={onOpenPayment} className="w-full h-12 rounded-2xl text-sm" size="lg">
            <CreditCard className="mr-2 h-4 w-4" /> {t("result.openPayment")}
          </Button>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2 w-full">
          {primaryAction === "translate" ? (
            <>
              <Button onClick={onTranslateText} className="w-full h-12 rounded-2xl text-sm" size="lg">
                <Languages className="mr-2 h-4 w-4" /> {t("result.translate")}
              </Button>
              <Button onClick={onCopy} className="w-full h-12 rounded-2xl text-sm" size="lg" variant="secondary">
                <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onCopy} className="w-full h-12 rounded-2xl text-sm" size="lg">
                <Copy className="mr-2 h-4 w-4" /> {t("common.copy")}
              </Button>
              <Button onClick={onTranslateText} className="w-full h-12 rounded-2xl text-sm" size="lg" variant="secondary">
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
          className="w-full h-12 rounded-2xl text-sm"
          size="lg"
        >
          <Search className="mr-2 h-4 w-4" />
          {t("result.searchProduct", "Search Product")}
        </Button>
      );
    default:
      return null;
  }
});
