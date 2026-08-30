import { memo, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Share2,
  SearchCheck,
  ShieldCheck,
  ShieldAlert,
  FileCode2,
  Globe,
  Radio,
  Wifi,
  CreditCard,
  User,
  ArrowRight,
} from "lucide-react";
import type { ScanRecord, ScanContentType } from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SeverityBadge } from "@/components/investigation/CyberBadges";
import { cn } from "@/lib/utils";

interface Props {
  scan: ScanRecord | null;
  onClose: () => void;
  onInvestigate?: () => void;
}

const TYPE_ICONS: Record<ScanContentType, React.ComponentType<{ className?: string }>> = {
  url: Globe,
  wifi: Wifi,
  vcard: User,
  email: Globe,
  sms: Radio,
  phone: Radio,
  geo: Globe,
  product: FileCode2,
  text: FileCode2,
  payment: CreditCard,
};

export const ResultSheet = memo(function ResultSheet({
  scan,
  onClose,
  onInvestigate,
}: Props) {
  const { t } = useTranslation();

  const parsed = useMemo(() => {
    if (!scan) return null;
    return parseScanContent(scan.content, scan.format);
  }, [scan]);

  if (!scan || !parsed) return null;

  const TypeIcon = TYPE_ICONS[parsed.type] || FileCode2;
  const isRisky = scan.safetyStatus === "malicious" || scan.safetyStatus === "suspicious";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scan.content);
      toast.success(t("result.copied", "Payload copied to clipboard"));
    } catch {
      toast.error(t("errors.copyFailed", "Failed to copy payload"));
    }
  };

  const share = async () => {
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

  return (
    <Sheet open={!!scan} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 sm:p-6 shadow-2xl max-w-3xl mx-auto"
      >
        <SheetHeader className="text-left space-y-2 pb-3 border-b border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <TypeIcon className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-xs uppercase font-mono bg-secondary/60">
                {scan.format.replace(/_/g, " ")} · {parsed.type.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {scan.safetyStatus && scan.safetyStatus !== "unchecked" && (
                <SeverityBadge
                  severity={
                    scan.safetyStatus === "malicious"
                      ? "high"
                      : scan.safetyStatus === "suspicious"
                      ? "medium"
                      : "informational"
                  }
                />
              )}
            </div>
          </div>

          <SheetTitle className="text-base sm:text-lg font-bold text-foreground break-all leading-snug">
            {parsed.display || scan.content}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Inspection Notice */}
          <div
            className={cn(
              "p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1",
              isRisky
                ? "bg-destructive/10 border-destructive/30 text-destructive-foreground dark:text-red-200"
                : "bg-secondary/40 border-border text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {isRisky ? (
                <ShieldAlert className="h-4 w-4 text-destructive" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-primary" />
              )}
              <span>Inspection-First Protocol</span>
            </div>
            <p>
              ScanIQ has isolated and analyzed this payload safely in your browser. Destinations and protocols are never automatically launched or visited without your explicit consent.
            </p>
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={() => onInvestigate?.()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-all text-sm"
          >
            <SearchCheck className="h-4 w-4" />
            <span>Open Investigation Workspace</span>
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          {/* Secondary Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={copy}
              className="h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Raw Data</span>
            </Button>

            <Button
              variant="outline"
              onClick={share}
              className="h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share Payload</span>
            </Button>
          </div>

          {/* Raw Payload Technical View */}
          <details className="rounded-xl border border-border bg-background p-3 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
              View Raw Decoded Content ({scan.content.length} bytes)
            </summary>
            <pre className="mt-2.5 p-2.5 rounded-lg bg-secondary/50 font-mono text-[11px] text-foreground/90 whitespace-pre-wrap break-all border border-border/60">
              {scan.content}
            </pre>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
});
