import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Share2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Star,
  FileText,
  Zap,
  Sparkles,
} from "lucide-react";
import type { ScanRecord, SafetyStatus, ScanContentType } from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import { analyzeUrlSafety, type SafetyResult } from "@/lib/url-safety";
import { useActionStats } from "@/lib/action-stats";
import { toast } from "sonner";
import { generateLocalAIExplanation } from "@/lib/scan/ai-explain";
import { SmartActions } from "@/components/SmartActions";
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
  url: FileText,
  wifi: FileText,
  vcard: FileText,
  email: FileText,
  sms: FileText,
  phone: FileText,
  geo: FileText,
  product: FileText,
  text: FileText,
  payment: FileText,
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

// SafetyWarningCard is now imported from a separate file.

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
  const explanation = useMemo(() => generateLocalAIExplanation(scan), [scan]);

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

  // Smart actions rendering logic has been extracted into a separate component.

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
              <SmartActions
                scan={scan}
                safety={safety}
                primaryAction={primaryAction}
                onCopy={copy}
                onOpenUrl={openUrl}
                onTranslateText={translateText}
                onOpenPayment={openPayment}
                recordAction={recordAction}
              />

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
