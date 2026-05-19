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
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Star,
} from "lucide-react";
import type { ScanRecord, SafetyStatus } from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";

interface Props {
  scan: ScanRecord | null;
  onClose: () => void;
}

const typeLabel: Record<string, string> = {
  url: "Link",
  wifi: "Wi-Fi network",
  vcard: "Contact",
  email: "Email",
  sms: "SMS",
  phone: "Phone",
  geo: "Location",
  product: "Product",
  text: "Text",
};

function SafetyBadge({ status }: { status?: SafetyStatus }) {
  if (!status || status === "unchecked") return null;
  if (status === "safe")
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success/90">
        <ShieldCheck className="mr-1 h-3 w-3" /> Safe
      </Badge>
    );
  if (status === "suspicious")
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
        <ShieldAlert className="mr-1 h-3 w-3" /> Suspicious
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <ShieldAlert className="mr-1 h-3 w-3" /> Risky
    </Badge>
  );
}

export function ResultSheet({ scan, onClose }: Props) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setFavorite(!!scan?.favorite);
  }, [scan]);

  if (!scan) return null;
  const parsed = parseScanContent(scan.content, scan.format);

  const copy = async () => {
    await navigator.clipboard.writeText(scan.content);
    toast.success("Copied to clipboard");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: scan.content });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  const toggleFav = async () => {
    const next = !favorite;
    setFavorite(next);
    await db.scans.update(scan.id, { favorite: next });
    toast(next ? "Added to favorites" : "Removed from favorites");
  };

  const isSafeUrl = (url: string) => {
    try {
      const u = new URL(url);
      return ["http:", "https:", "mailto:", "tel:", "sms:", "geo:"].includes(u.protocol);
    } catch {
      return false;
    }
  };

  const openUrl = () => {
    const urlToOpen = parsed.type === "url" ? parsed.data.url : scan.content;
    if (!isSafeUrl(urlToOpen)) {
      toast.error("Blocked potentially unsafe link");
      return;
    }
    window.open(urlToOpen, "_blank", "noopener,noreferrer");
  };

  const renderActions = () => {
    switch (parsed.type) {
      case "url":
        return (
          <Button onClick={openUrl} className="w-full" size="lg">
            <ExternalLink className="mr-2 h-4 w-4" /> Open link
          </Button>
        );
      case "wifi":
        return (
          <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Wifi className="h-4 w-4" /> {parsed.data.ssid || "Wi-Fi"}
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div>Encryption: {parsed.data.encryption}</div>
              {parsed.data.password && <div>Password: {parsed.data.password}</div>}
            </div>
            <Button onClick={() => {
              navigator.clipboard.writeText(parsed.data.password || "");
              toast.success("Password copied");
            }} className="mt-3 w-full" variant="secondary">
              Copy password
            </Button>
          </div>
        );
      case "phone":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`tel:${parsed.data.number}`}>
              <Phone className="mr-2 h-4 w-4" /> Call {parsed.data.number}
            </a>
          </Button>
        );
      case "email":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`mailto:${parsed.data.to}`}>
              <Mail className="mr-2 h-4 w-4" /> Email {parsed.data.to}
            </a>
          </Button>
        );
      case "sms":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`sms:${parsed.data.number}`}>
              <MessageSquare className="mr-2 h-4 w-4" /> Text {parsed.data.number}
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
          }} className="w-full" size="lg">
            <UserPlus className="mr-2 h-4 w-4" /> Save contact
          </Button>
        );
      case "geo":
        return (
          <Button asChild className="w-full" size="lg">
            <a href={`https://www.google.com/maps?q=${encodeURIComponent(parsed.data.coords)}`} target="_blank" rel="noopener noreferrer">
              <MapPin className="mr-2 h-4 w-4" /> Open in maps
            </a>
          </Button>
        );
      case "product":
        return (
          <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
            Product lookup coming soon.
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={!!scan} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t-0 p-6">
        <SheetHeader className="mb-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <Badge variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
              {typeLabel[parsed.type]} · {scan.format.replace(/_/g, " ")}
            </Badge>
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
          <SheetTitle className="break-words text-xl leading-snug">{parsed.display || scan.content}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {renderActions()}

          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={copy} className="h-12">
              <Copy className="h-4 w-4" />
              <span className="text-xs">Copy</span>
            </Button>
            <Button variant="secondary" onClick={share} className="h-12">
              <Share2 className="h-4 w-4" />
              <span className="text-xs">Share</span>
            </Button>
            <Button variant="secondary" disabled className="h-12 opacity-60" title="AI explain — coming soon">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs">Explain</span>
            </Button>
          </div>

          <details className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Raw content</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-foreground/80">{scan.content}</pre>
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}
